import torch
import torch.nn as nn
import math


class TimeAwareClinicalTransformer(nn.Module):
    def __init__(self, vocab_size, num_careplans, d_model=128, nhead=4, num_layers=2, dropout=0.3):
        super(TimeAwareClinicalTransformer, self).__init__()

        self.d_model = d_model

        # 1. The Categorical Embedding (for Medical Codes)
        self.token_embedding = nn.Embedding(vocab_size, d_model, padding_idx=0)

        # 2. The Continuous Time Embedding
        self.time_embedding = nn.Linear(1, d_model)

        self.embedding_dropout = nn.Dropout(p=dropout)

        # 3. Transformer Stack
        encoder_layers = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layers, num_layers=num_layers)

        # 4. Classification Head
        self.fc_out = nn.Linear(d_model, num_careplans)

    def forward(self, tokens, time_deltas, pad_mask=None):
        # 1. Embeddings
        x_tokens = self.token_embedding(tokens) * math.sqrt(self.d_model)
        time_deltas = time_deltas.unsqueeze(-1).float()
        x_time = self.time_embedding(time_deltas)

        x = x_tokens + x_time
        x = self.embedding_dropout(x)

        # 2. Transformer
        output = self.transformer_encoder(x, src_key_padding_mask=pad_mask)

        # Dynamic Last Token Extraction
        if pad_mask is None:
            last_token_output = output[:, -1, :]
        else:
            actual_lengths = (~pad_mask).sum(dim=1)
            last_token_indices = actual_lengths - 1
            last_token_output = output[torch.arange(output.size(0)), last_token_indices, :]

        # 3. Predict
        logits = self.fc_out(last_token_output)

        return logits
