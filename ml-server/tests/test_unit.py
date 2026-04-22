"""ML 서버 단위 테스트 - 모델을 mock으로 교체해 라우트 로직만 검증"""
import pytest
from unittest.mock import MagicMock, patch
import numpy as np
from fastapi.testclient import TestClient
import main as ml_main


VALID_FEATURES = {
    "flow_duration": 50000.0,
    "total_fwd_packets": 1000.0,
    "total_bwd_packets": 5.0,
    "flow_bytes_per_sec": 300000.0,
    "flow_packets_per_sec": 2000.0,
    "fwd_packet_len_mean": 40.0,
    "bwd_packet_len_mean": 10.0,
    "syn_flag_count": 1.0,
    "ack_flag_count": 2.0,
    "psh_flag_count": 50.0,
    "rst_flag_count": 1.0,
    "fin_flag_count": 0.0,
    "fwd_iat_mean": 200.0,
    "bwd_iat_mean": 50.0,
    "active_mean": 1000.0,
    "idle_mean": 500.0,
    "down_up_ratio": 0.05,
    "avg_packet_size": 35.0,
}

MOCK_CLASSES = ["BENIGN", "Botnet", "BruteForce", "DDoS", "DoS", "PortScan", "WebAttack"]


def make_mock_model(pred_idx: int, proba: list):
    """예측 결과가 고정된 mock 모델 생성"""
    m = MagicMock()
    m.predict.return_value = np.array([pred_idx])
    m.predict_proba.return_value = np.array([proba])
    return m


def make_mock_encoder(label: str):
    """단일 레이블을 반환하는 mock encoder 생성"""
    e = MagicMock()
    e.inverse_transform.return_value = [label]
    e.classes_ = MOCK_CLASSES
    return e


@pytest.fixture
def client_with_model():
    """모델이 mock으로 주입된 TestClient (startup 이벤트 미실행)"""
    proba = [0.01, 0.01, 0.01, 0.01, 0.95, 0.005, 0.005]  # DoS index=4
    mock_model = make_mock_model(pred_idx=4, proba=proba)
    mock_encoder = make_mock_encoder("DoS")

    # patch.object를 쓰면 TestClient 컨텍스트 없이도 모듈 변수를 교체 가능
    with patch.object(ml_main, "model", mock_model), \
         patch.object(ml_main, "label_encoder", mock_encoder):
        yield TestClient(ml_main.app)


@pytest.fixture
def client_no_model():
    """모델이 None인 TestClient (startup 이벤트 미실행)"""
    with patch.object(ml_main, "model", None), \
         patch.object(ml_main, "label_encoder", None):
        yield TestClient(ml_main.app, raise_server_exceptions=False)


class TestHealthEndpoint:
    def test_health_ok_with_model(self, client_with_model):
        res = client_with_model.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"
        assert res.json()["model_loaded"] is True

    def test_health_model_not_loaded(self, client_no_model):
        res = client_no_model.get("/health")
        assert res.status_code == 200
        assert res.json()["model_loaded"] is False


class TestPredictEndpoint:
    def test_predict_valid_input_returns_200(self, client_with_model):
        res = client_with_model.post("/predict", json=VALID_FEATURES)
        assert res.status_code == 200

    def test_predict_response_has_required_fields(self, client_with_model):
        body = client_with_model.post("/predict", json=VALID_FEATURES).json()
        assert "label" in body
        assert "confidence" in body
        assert "probabilities" in body

    def test_predict_returns_mock_label(self, client_with_model):
        body = client_with_model.post("/predict", json=VALID_FEATURES).json()
        assert body["label"] == "DoS"

    def test_predict_confidence_is_float_in_range(self, client_with_model):
        body = client_with_model.post("/predict", json=VALID_FEATURES).json()
        assert isinstance(body["confidence"], float)
        assert 0.0 <= body["confidence"] <= 1.0

    def test_predict_probabilities_have_all_classes(self, client_with_model):
        probs = client_with_model.post("/predict", json=VALID_FEATURES).json()["probabilities"]
        assert set(probs.keys()) == set(MOCK_CLASSES)

    def test_predict_probabilities_sum_to_one(self, client_with_model):
        probs = client_with_model.post("/predict", json=VALID_FEATURES).json()["probabilities"]
        assert abs(sum(probs.values()) - 1.0) < 0.01

    def test_predict_missing_field_returns_422(self, client_with_model):
        incomplete = {k: v for k, v in VALID_FEATURES.items() if k != "flow_duration"}
        res = client_with_model.post("/predict", json=incomplete)
        assert res.status_code == 422

    def test_predict_invalid_type_returns_422(self, client_with_model):
        bad = {**VALID_FEATURES, "flow_duration": "not_a_number"}
        res = client_with_model.post("/predict", json=bad)
        assert res.status_code == 422

    def test_predict_without_model_returns_503(self, client_no_model):
        res = client_no_model.post("/predict", json=VALID_FEATURES)
        assert res.status_code == 503
