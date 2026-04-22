from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import numpy as np
import os

app = FastAPI(title="IDS ML Server")

MODEL_PATH = "model/xgboost_model.pkl"
ENCODER_PATH = "model/label_encoder.pkl"

model = None
label_encoder = None


@app.on_event("startup")
def load_model():
    global model, label_encoder
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError("모델 파일이 없습니다. train.py를 먼저 실행하세요.")
    model = joblib.load(MODEL_PATH)
    label_encoder = joblib.load(ENCODER_PATH)
    print("모델 로드 완료")


class TrafficFeatures(BaseModel):
    flow_duration: float
    total_fwd_packets: float
    total_bwd_packets: float
    flow_bytes_per_sec: float
    flow_packets_per_sec: float
    fwd_packet_len_mean: float
    bwd_packet_len_mean: float
    syn_flag_count: float
    ack_flag_count: float
    psh_flag_count: float
    rst_flag_count: float
    fin_flag_count: float
    fwd_iat_mean: float
    bwd_iat_mean: float
    active_mean: float
    idle_mean: float
    down_up_ratio: float
    avg_packet_size: float


class PredictResponse(BaseModel):
    label: str
    confidence: float
    probabilities: dict


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict", response_model=PredictResponse)
def predict(features: TrafficFeatures):
    if model is None:
        raise HTTPException(status_code=503, detail="모델이 로드되지 않았습니다.")

    data = np.array([[
        features.flow_duration,
        features.total_fwd_packets,
        features.total_bwd_packets,
        features.flow_bytes_per_sec,
        features.flow_packets_per_sec,
        features.fwd_packet_len_mean,
        features.bwd_packet_len_mean,
        features.syn_flag_count,
        features.ack_flag_count,
        features.psh_flag_count,
        features.rst_flag_count,
        features.fin_flag_count,
        features.fwd_iat_mean,
        features.bwd_iat_mean,
        features.active_mean,
        features.idle_mean,
        features.down_up_ratio,
        features.avg_packet_size,
    ]])

    pred_idx = model.predict(data)[0]
    proba = model.predict_proba(data)[0]
    label = label_encoder.inverse_transform([pred_idx])[0]
    classes = label_encoder.classes_

    return PredictResponse(
        label=label,
        confidence=float(proba[pred_idx]),
        probabilities={cls: float(p) for cls, p in zip(classes, proba)},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
