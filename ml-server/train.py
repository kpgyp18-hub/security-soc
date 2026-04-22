"""
CICIDS2017 실제 데이터셋으로 XGBoost 모델 학습
데이터 경로: data/MachineLearningCSV/MachineLearningCVE/*.csv
"""
import os
import glob
import warnings
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils import resample
import joblib

warnings.filterwarnings("ignore")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "MachineLearningCSV", "MachineLearningCVE")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")

# CSV 컬럼명 → 모델 피처명 매핑
COLUMN_MAP = {
    " Flow Duration":          "flow_duration",
    " Total Fwd Packets":      "total_fwd_packets",
    " Total Backward Packets": "total_bwd_packets",
    "Flow Bytes/s":            "flow_bytes_per_sec",
    " Flow Packets/s":         "flow_packets_per_sec",
    " Fwd Packet Length Mean": "fwd_packet_len_mean",
    " Bwd Packet Length Mean": "bwd_packet_len_mean",
    " SYN Flag Count":         "syn_flag_count",
    " ACK Flag Count":         "ack_flag_count",
    " PSH Flag Count":         "psh_flag_count",
    " RST Flag Count":         "rst_flag_count",
    "FIN Flag Count":          "fin_flag_count",
    " Fwd IAT Mean":           "fwd_iat_mean",
    " Bwd IAT Mean":           "bwd_iat_mean",
    "Active Mean":             "active_mean",
    "Idle Mean":               "idle_mean",
    " Down/Up Ratio":          "down_up_ratio",
    " Average Packet Size":    "avg_packet_size",
    " Label":                  "label",
}

FEATURE_NAMES = [v for v in COLUMN_MAP.values() if v != "label"]

# 원본 레이블 → 통합 레이블 매핑
LABEL_MAP = {
    "BENIGN":                      "BENIGN",
    "DDoS":                        "DDoS",
    "PortScan":                    "PortScan",
    "Bot":                         "Botnet",
    "FTP-Patator":                 "BruteForce",
    "SSH-Patator":                 "BruteForce",
    "DoS Hulk":                    "DoS",
    "DoS GoldenEye":               "DoS",
    "DoS slowloris":               "DoS",
    "DoS Slowhttptest":            "DoS",
    "Web Attack � Brute Force":  "WebAttack",
    "Web Attack � XSS":          "WebAttack",
    "Web Attack � Sql Injection": "WebAttack",
    # 샘플 극소수 → 제외
    "Infiltration":                None,
    "Heartbleed":                  None,
}

# 클래스별 최대 샘플 수 (클래스 불균형 완화)
MAX_SAMPLES_PER_CLASS = {
    "BENIGN":    150_000,
    "DoS":       80_000,
    "DDoS":      80_000,
    "PortScan":  80_000,
    "BruteForce":13_000,
    "WebAttack":  2_000,
    "Botnet":     1_900,
}


def load_data() -> pd.DataFrame:
    csv_files = sorted(glob.glob(os.path.join(DATA_DIR, "*.csv")))
    if not csv_files:
        raise FileNotFoundError(f"CSV 파일이 없습니다: {DATA_DIR}")

    print(f"[1/4] CSV 파일 {len(csv_files)}개 로드 중...")
    chunks = []
    for f in csv_files:
        print(f"      {os.path.basename(f)}")
        needed_cols = list(COLUMN_MAP.keys())
        df = pd.read_csv(f, usecols=needed_cols, low_memory=False)
        df.rename(columns=COLUMN_MAP, inplace=True)
        chunks.append(df)

    return pd.concat(chunks, ignore_index=True)


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    print("[2/4] 데이터 정제 중...")

    # 레이블 매핑 및 제외
    df["label"] = df["label"].map(LABEL_MAP)
    df.dropna(subset=["label"], inplace=True)

    # 수치형 변환 및 이상값 제거
    for col in FEATURE_NAMES:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(subset=FEATURE_NAMES, inplace=True)

    # 음수 값 클리핑 (물리적으로 불가능한 값)
    non_neg_cols = [
        "flow_duration", "total_fwd_packets", "total_bwd_packets",
        "flow_bytes_per_sec", "flow_packets_per_sec",
        "fwd_packet_len_mean", "bwd_packet_len_mean",
        "syn_flag_count", "ack_flag_count", "psh_flag_count",
        "rst_flag_count", "fin_flag_count", "avg_packet_size",
    ]
    for col in non_neg_cols:
        df[col] = df[col].clip(lower=0)

    print(f"      정제 후 전체 샘플 수: {len(df):,}")
    for label, cnt in df["label"].value_counts().items():
        print(f"      {label}: {cnt:,}")

    return df


def balance_data(df: pd.DataFrame) -> pd.DataFrame:
    print("[3/4] 클래스 불균형 처리 중...")
    balanced = []
    for label, max_n in MAX_SAMPLES_PER_CLASS.items():
        subset = df[df["label"] == label]
        if len(subset) == 0:
            print(f"      경고: {label} 샘플 없음")
            continue
        if len(subset) > max_n:
            subset = resample(subset, n_samples=max_n, random_state=42, replace=False)
        elif len(subset) < 500:
            # 500개 미만은 오버샘플링
            subset = resample(subset, n_samples=500, random_state=42, replace=True)
        print(f"      {label}: {len(subset):,}개")
        balanced.append(subset)

    result = pd.concat(balanced, ignore_index=True).sample(frac=1, random_state=42).reset_index(drop=True)
    print(f"      균형 조정 후 총 샘플: {len(result):,}")
    return result


def train(df: pd.DataFrame):
    print("[4/4] XGBoost 학습 중...")

    X = df[FEATURE_NAMES].values
    le = LabelEncoder()
    y = le.fit_transform(df["label"].values)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = XGBClassifier(
        n_estimators=300,
        max_depth=8,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
        tree_method="hist",
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )

    y_pred = model.predict(X_test)
    print("\n[분류 리포트]")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, os.path.join(MODEL_DIR, "xgboost_model.pkl"))
    joblib.dump(le, os.path.join(MODEL_DIR, "label_encoder.pkl"))
    joblib.dump(FEATURE_NAMES, os.path.join(MODEL_DIR, "feature_names.pkl"))
    print(f"\n모델 저장 완료: {MODEL_DIR}")


if __name__ == "__main__":
    df = load_data()
    df = clean_data(df)
    df = balance_data(df)
    train(df)
