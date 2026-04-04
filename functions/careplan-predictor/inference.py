import json
import logging
import os
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import torch
from azure.cosmos import CosmosClient

from model import TimeAwareClinicalTransformer

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global state — loaded once on cold start
# ---------------------------------------------------------------------------
_model = None
_token_vocab = None
_target_vocab = None
_idx_to_class = None
_careplan_mapping = None
_cosmos_client = None
_database = None

CAREPLAN_PREFIX = "CAREP_"

# Training hyperparameters (must match the notebook)
D_MODEL = 64
NHEAD = 2
NUM_LAYERS = 1
DROPOUT = 0.3

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")

# Cosmos DB container names used for the unified timeline
CONTAINER_NAMES = [
    "allergies",
    "careplans",
    "conditions",
    "immunizations",
    "medications",
    "observations",
]
ENCOUNTER_CONTAINER = "encounters"

# Mapping from container name → (date column in Cosmos docs, EVENT_CODE prefix)
CONTAINER_CONFIG = {
    "allergies":     ("START", "ALLG_"),
    "careplans":     ("START", "CAREP_"),
    "conditions":    ("START", "COND_"),
    "immunizations": ("DATE",  "IMM_"),
    "medications":   ("START", "MED_"),
    "observations":  ("DATE",  "OBS_"),
}


def _load_artifacts():
    """Load model weights and vocabulary files once at cold start."""
    global _model, _token_vocab, _target_vocab, _idx_to_class, _careplan_mapping

    with open(os.path.join(ARTIFACTS_DIR, "token_vocab.json")) as f:
        _token_vocab = json.load(f)

    with open(os.path.join(ARTIFACTS_DIR, "target_vocab.json")) as f:
        _target_vocab = json.load(f)

    with open(os.path.join(ARTIFACTS_DIR, "careplan_mapping.json")) as f:
        _careplan_mapping = json.load(f)

    _idx_to_class = {v: k for k, v in _target_vocab.items()}

    vocab_size = len(_token_vocab)
    num_careplans = len(_target_vocab)

    _model = TimeAwareClinicalTransformer(
        vocab_size=vocab_size,
        num_careplans=num_careplans,
        d_model=D_MODEL,
        nhead=NHEAD,
        num_layers=NUM_LAYERS,
        dropout=DROPOUT,
    )

    weights_path = os.path.join(ARTIFACTS_DIR, "care_plan_suggestor_transformer.pth")
    state_dict = torch.load(weights_path, map_location="cpu", weights_only=True)
    _model.load_state_dict(state_dict)
    _model.eval()
    logger.info(
        "Model loaded: vocab_size=%d, num_careplans=%d", vocab_size, num_careplans
    )


def _get_database():
    """Return a cached Cosmos DB database client."""
    global _cosmos_client, _database
    if _database is None:
        endpoint = os.environ["COSMOS_DB_ENDPOINT"]
        key = os.environ["COSMOS_DB_KEY"]
        db_name = os.environ.get("COSMOS_DB_DATABASE", "clinical")
        _cosmos_client = CosmosClient(endpoint, credential=key)
        _database = _cosmos_client.get_database_client(db_name)
    return _database


# ---------------------------------------------------------------------------
# Cosmos DB queries
# ---------------------------------------------------------------------------

def _query_container(container_name: str, patient_id: str) -> list[dict]:
    """Query a single Cosmos DB container for all records belonging to a patient."""
    db = _get_database()
    container = db.get_container_client(container_name)
    query = "SELECT * FROM c WHERE c.PATIENT = @patient_id"
    parameters = [{"name": "@patient_id", "value": patient_id}]
    items = list(
        container.query_items(
            query=query,
            parameters=parameters,
            enable_cross_partition_query=True,
        )
    )
    return items


def _query_patient_data(patient_id: str) -> dict[str, list[dict]]:
    """Query all clinical containers for a patient. Returns dict keyed by container name."""
    data = {}
    for name in CONTAINER_NAMES:
        data[name] = _query_container(name, patient_id)
    data[ENCOUNTER_CONTAINER] = _query_container(ENCOUNTER_CONTAINER, patient_id)
    return data


# ---------------------------------------------------------------------------
# Preprocessing — mirrors the notebook exactly
# ---------------------------------------------------------------------------

def _build_unified_timeline(patient_data: dict[str, list[dict]]) -> pd.DataFrame:
    """
    Build a unified timeline from raw Cosmos DB records.
    Mirrors the notebook's build_unified_timeline() function.
    """
    frames = []

    for container_name in CONTAINER_NAMES:
        records = patient_data[container_name]
        if not records:
            continue

        date_col, prefix = CONTAINER_CONFIG[container_name]

        rows = []
        for rec in records:
            timestamp = rec.get(date_col)
            code = rec.get("CODE")
            encounter = rec.get("ENCOUNTER")
            patient = rec.get("PATIENT")
            if timestamp is None or code is None:
                continue
            rows.append(
                {
                    "TIMESTAMP": timestamp,
                    "PATIENT": patient,
                    "ENCOUNTER": encounter,
                    "EVENT_CODE": f"{prefix}{code}",
                }
            )

        if rows:
            frames.append(pd.DataFrame(rows))

    if not frames:
        return pd.DataFrame()

    unified = pd.concat(frames, ignore_index=True)
    unified = unified.sort_values(by=["PATIENT", "TIMESTAMP"])
    return unified


def _add_encounter_context(
    unified_df: pd.DataFrame, encounters: list[dict]
) -> pd.DataFrame:
    """
    Merge encounter start times and compute DAYS_SINCE_START.
    Mirrors the notebook's add_encounter_context() function.
    """
    if unified_df.empty:
        return unified_df

    # Build encounters lookup
    enc_rows = []
    for enc in encounters:
        enc_rows.append({"ENCOUNTER": enc.get("id"), "ENCOUNTER_TIME": enc.get("START")})

    if enc_rows:
        enc_df = pd.DataFrame(enc_rows)
        merged = pd.merge(unified_df, enc_df, on="ENCOUNTER", how="left")
    else:
        merged = unified_df.copy()
        merged["ENCOUNTER_TIME"] = pd.NaT

    # Convert time columns
    merged["ENCOUNTER_TIME"] = pd.to_datetime(
        merged["ENCOUNTER_TIME"], format="mixed", utc=True
    )
    merged["TIMESTAMP"] = pd.to_datetime(
        merged["TIMESTAMP"], format="mixed", utc=True
    )

    # Anchor time: prefer encounter time, fall back to event timestamp
    merged["ANCHOR_TIME"] = merged["ENCOUNTER_TIME"].fillna(merged["TIMESTAMP"])

    # Calculate days since first event for this patient
    merged["DAYS_SINCE_START"] = merged.groupby("PATIENT")["ANCHOR_TIME"].transform(
        lambda x: (x - x.min()).dt.days
    )

    # Clean up
    merged = merged.drop(columns=["ENCOUNTER_TIME", "TIMESTAMP"])
    merged = merged.sort_values(by=["PATIENT", "ANCHOR_TIME"])
    return merged


# ---------------------------------------------------------------------------
# Tokenization & Inference
# ---------------------------------------------------------------------------

def _tokenize_and_predict(context_df: pd.DataFrame) -> dict:
    """
    Tokenise a single patient's full history and run model inference.
    Uses all available events (including care plans) as context to predict
    the next care plan.
    """
    if context_df.empty:
        return None

    # Tokenize the full history
    encoded_tokens = []
    times = []
    for _, event in context_df.iterrows():
        code = event["EVENT_CODE"]
        token_id = _token_vocab.get(code, _token_vocab["<UNK>"])
        encoded_tokens.append(token_id)
        times.append(float(event["DAYS_SINCE_START"]))

    # Tensors
    tokens_tensor = torch.tensor(encoded_tokens, dtype=torch.long).unsqueeze(0)
    times_tensor = torch.log1p(torch.tensor(times, dtype=torch.float)).unsqueeze(0)
    mask_tensor = torch.zeros_like(tokens_tensor, dtype=torch.bool)

    # Inference
    with torch.no_grad():
        logits = _model(tokens_tensor, times_tensor, mask_tensor)
        probs = torch.softmax(logits, dim=1)
        top5_probs, top5_indices = torch.topk(probs, k=min(5, probs.size(1)), dim=1)

    # Map predictions
    predictions = []
    for prob, idx in zip(top5_probs.squeeze().tolist(), top5_indices.squeeze().tolist()):
        code = _idx_to_class.get(idx, str(idx))
        desc = _careplan_mapping.get(code, "Unknown care plan")
        predictions.append(
            {"code": code, "description": desc, "confidence": round(prob, 4)}
        )

    return {
        "predicted_careplan": predictions[0] if predictions else None,
        "top5_predictions": predictions,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def ensure_loaded():
    """Ensure model and artifacts are loaded (idempotent)."""
    if _model is None:
        _load_artifacts()


def predict_careplan(patient_id: str) -> dict:
    """
    End-to-end prediction pipeline:
    1. Query Cosmos DB for patient data
    2. Build unified timeline
    3. Add encounter context
    4. Tokenize and run inference
    """
    ensure_loaded()

    # 1. Query all containers
    print(f"[Step 1] Querying Cosmos DB for patient {patient_id}...")
    patient_data = _query_patient_data(patient_id)

    # Check if patient has any data
    total_records = sum(len(v) for v in patient_data.values())
    print(f"[Step 1] Retrieved {total_records} total records across {len(patient_data)} containers")
    for name, records in patient_data.items():
        print(f"  - {name}: {len(records)} records")
    if total_records == 0:
        print("[Step 1] No data found for patient. Aborting.")
        return None

    # 2. Build unified timeline
    print("[Step 2] Building unified timeline...")
    unified_df = _build_unified_timeline(patient_data)
    if unified_df.empty:
        print("[Step 2] Unified timeline is empty. Aborting.")
        return None
    print(f"[Step 2] Unified timeline has {len(unified_df)} events")

    # 3. Add encounter context
    print("[Step 3] Adding encounter context...")
    context_df = _add_encounter_context(
        unified_df, patient_data[ENCOUNTER_CONTAINER]
    )
    if context_df.empty:
        print("[Step 3] Context dataframe is empty. Aborting.")
        return None
    print(f"[Step 3] Context dataframe has {len(context_df)} rows")

    # 4. Predict
    print("[Step 4] Running tokenization and model inference...")
    result = _tokenize_and_predict(context_df)
    if result:
        print(f"[Step 4] Prediction: {result['predicted_careplan']}")
    else:
        print("[Step 4] No prediction could be made (no care plan events in history)")
    return result
