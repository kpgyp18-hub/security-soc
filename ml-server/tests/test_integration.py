"""ML 서버 통합 테스트 - 실제 모델 파일을 사용해 전체 파이프라인 검증
실행 전제: python train.py 가 완료되어 model/ 디렉토리에 pkl 파일이 존재해야 함
"""
import pytest
import os
from fastapi.testclient import TestClient

MODEL_PATH = os.path.join(os.path.dirname(__file__), "../model/xgboost_model.pkl")
pytestmark = pytest.mark.skipif(
    not os.path.exists(MODEL_PATH),
    reason="모델 파일이 없습니다. train.py를 먼저 실행하세요."
)

# 실제 모델 로드
import main as ml_main
ml_main.load_model()

client = TestClient(ml_main.app)

ATTACK_PROFILES = {
    "BENIGN": {
        "flow_duration": 25000.0, "total_fwd_packets": 50.0, "total_bwd_packets": 50.0,
        "flow_bytes_per_sec": 2000.0, "flow_packets_per_sec": 20.0,
        "fwd_packet_len_mean": 250.0, "bwd_packet_len_mean": 250.0,
        "syn_flag_count": 1.0, "ack_flag_count": 5.0, "psh_flag_count": 2.0,
        "rst_flag_count": 0.0, "fin_flag_count": 1.0,
        "fwd_iat_mean": 2000.0, "bwd_iat_mean": 2000.0,
        "active_mean": 5000.0, "idle_mean": 25000.0,
        "down_up_ratio": 1.0, "avg_packet_size": 250.0,
    },
    "DoS": {
        "flow_duration": 120000.0, "total_fwd_packets": 2500.0, "total_bwd_packets": 5.0,
        "flow_bytes_per_sec": 250000.0, "flow_packets_per_sec": 2000.0,
        "fwd_packet_len_mean": 35.0, "bwd_packet_len_mean": 10.0,
        "syn_flag_count": 1.0, "ack_flag_count": 1.0, "psh_flag_count": 50.0,
        "rst_flag_count": 1.0, "fin_flag_count": 1.0,
        "fwd_iat_mean": 200.0, "bwd_iat_mean": 50.0,
        "active_mean": 1000.0, "idle_mean": 500.0,
        "down_up_ratio": 0.05, "avg_packet_size": 35.0,
    },
    "DDoS": {
        "flow_duration": 5000.0, "total_fwd_packets": 500.0, "total_bwd_packets": 2.0,
        "flow_bytes_per_sec": 500000.0, "flow_packets_per_sec": 5000.0,
        "fwd_packet_len_mean": 30.0, "bwd_packet_len_mean": 5.0,
        "syn_flag_count": 100.0, "ack_flag_count": 2.0, "psh_flag_count": 2.0,
        "rst_flag_count": 1.0, "fin_flag_count": 1.0,
        "fwd_iat_mean": 50.0, "bwd_iat_mean": 20.0,
        "active_mean": 250.0, "idle_mean": 250.0,
        "down_up_ratio": 0.02, "avg_packet_size": 30.0,
    },
    "PortScan": {
        "flow_duration": 500.0, "total_fwd_packets": 3.0, "total_bwd_packets": 1.0,
        "flow_bytes_per_sec": 200.0, "flow_packets_per_sec": 8.0,
        "fwd_packet_len_mean": 20.0, "bwd_packet_len_mean": 20.0,
        "syn_flag_count": 2.0, "ack_flag_count": 1.0, "psh_flag_count": 0.0,
        "rst_flag_count": 2.0, "fin_flag_count": 0.0,
        "fwd_iat_mean": 50.0, "bwd_iat_mean": 25.0,
        "active_mean": 100.0, "idle_mean": 100.0,
        "down_up_ratio": 0.5, "avg_packet_size": 20.0,
    },
}


class TestModelLoaded:
    def test_health_model_is_loaded(self):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["model_loaded"] is True

    def test_model_object_is_not_none(self):
        assert ml_main.model is not None
        assert ml_main.label_encoder is not None


class TestPredictionPipeline:
    @pytest.mark.parametrize("attack_type,features", ATTACK_PROFILES.items())
    def test_predict_classifies_correctly(self, attack_type, features):
        res = client.post("/predict", json=features)
        assert res.status_code == 200

        body = res.json()
        assert body["label"] == attack_type, (
            f"{attack_type} 프로파일이 {body['label']}로 분류됨 "
            f"(신뢰도: {body['confidence']:.3f})"
        )

    @pytest.mark.parametrize("attack_type,features", ATTACK_PROFILES.items())
    def test_confidence_above_threshold(self, attack_type, features):
        res = client.post("/predict", json=features)
        body = res.json()
        assert body["confidence"] >= 0.7, (
            f"{attack_type} 신뢰도가 너무 낮음: {body['confidence']:.3f}"
        )

    def test_probabilities_all_present(self):
        res = client.post("/predict", json=ATTACK_PROFILES["BENIGN"])
        probs = res.json()["probabilities"]
        expected = {"BENIGN", "DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Botnet"}
        assert set(probs.keys()) == expected

    def test_probabilities_sum_approximately_one(self):
        res = client.post("/predict", json=ATTACK_PROFILES["DoS"])
        probs = res.json()["probabilities"]
        assert abs(sum(probs.values()) - 1.0) < 0.001
