import json
import logging

import azure.functions as func

from inference import ensure_loaded, predict_careplan

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

# Load model at module level (cold start)
try:
    ensure_loaded()
    logging.info("Model pre-loaded successfully at module init.")
except Exception as e:
    logging.warning("Model pre-load failed (will retry on first request): %s", e)


@app.route(route="predict/{patient_id}", methods=["GET"])
def predict(req: func.HttpRequest) -> func.HttpResponse:
    """
    HTTP trigger that predicts the next care plan for a patient.

    GET /api/predict/{patient_id}

    Returns JSON:
    {
        "patient_id": "...",
        "predicted_careplan": { "code": "...", "description": "...", "confidence": 0.85 },
        "top5_predictions": [...],
        "true_careplan": { "code": "...", "description": "..." }
    }
    """
    patient_id = req.route_params.get("patient_id")
    if not patient_id:
        return func.HttpResponse(
            json.dumps({"error": "patient_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        result = predict_careplan(patient_id)
    except Exception as e:
        logging.exception("Prediction failed for patient %s", patient_id)
        return func.HttpResponse(
            json.dumps({"error": "Internal model error", "detail": str(e)}),
            status_code=500,
            mimetype="application/json",
        )

    if result is None:
        return func.HttpResponse(
            json.dumps(
                {
                    "error": "No clinical data or care plans found for this patient",
                    "patient_id": patient_id,
                }
            ),
            status_code=404,
            mimetype="application/json",
        )

    result["patient_id"] = patient_id
    return func.HttpResponse(
        json.dumps(result),
        status_code=200,
        mimetype="application/json",
    )
