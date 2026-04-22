# Security SOC Dashboard

실시간 네트워크 침입 탐지 시스템 (IDS) 대시보드입니다.  
CICIDS2017 데이터셋으로 학습한 XGBoost 모델이 실제 네트워크 트래픽을 7개 유형으로 분류하고, React 대시보드에서 실시간으로 시각화합니다.

---

## 시스템 아키텍처

```
[네트워크 인터페이스]
        │ Raw Socket 패킷 캡처 (관리자 권한)
        ▼
  capture.py (Flow 피처 추출)
        │ Kafka Producer
        ▼
  Kafka (Docker, :9092)
        │ Kafka Consumer
        ▼
  backend/index.js (Node.js, :4000)
     ├──► ML 서버 /predict (FastAPI, :8000) ──► XGBoost 분류
     ├──► PostgreSQL (Docker, :5432)         ──► 결과 저장
     └──► WebSocket                          ──► 실시간 푸시
              │
              ▼
     React 대시보드 (:3002)
```

---

## 기술 스택

| 구성 요소 | 기술 |
|-----------|------|
| 패킷 캡처 | Python Raw Socket / Scapy + Npcap |
| 메시지 큐 | Apache Kafka (Confluent 7.5.0) |
| ML 서버 | FastAPI + XGBoost + scikit-learn |
| 학습 데이터 | CICIDS2017 (8개 CSV, 약 844 MB) |
| 백엔드 | Node.js + Express + KafkaJS + ws |
| 데이터베이스 | PostgreSQL 15 |
| 프론트엔드 | React + Vite + Chart.js |
| 인프라 | Docker Compose |

---

## 분류 클래스

| 레이블 | 설명 |
|--------|------|
| BENIGN | 정상 트래픽 |
| DoS | 서비스 거부 공격 (Hulk, GoldenEye, Slowloris, Slowhttptest) |
| DDoS | 분산 서비스 거부 공격 |
| PortScan | 포트 스캔 |
| BruteForce | 무차별 대입 공격 (FTP-Patator, SSH-Patator) |
| WebAttack | 웹 공격 (SQL Injection, XSS, Brute Force) |
| Botnet | 봇넷 |

---

## 프로젝트 구조

```
security-soc/
├── docker-compose.yml          # PostgreSQL + Zookeeper + Kafka
├── backend/
│   ├── index.js                # Express 서버, Kafka Consumer, WebSocket
│   ├── db.js                   # PostgreSQL 연동 (traffic_events 테이블)
│   ├── .env                    # 환경 변수
│   ├── kafka/
│   │   ├── consumer.js         # Kafka Consumer
│   │   └── producer.js         # Kafka Producer (시뮬레이션 모드)
│   └── tests/
│       ├── unit/               # Jest 단위 테스트
│       └── integration/        # Supertest 통합 테스트
├── ml-server/
│   ├── main.py                 # FastAPI ML 서버 (/predict, /health)
│   ├── train.py                # XGBoost 모델 학습 (CICIDS2017)
│   ├── capture.py              # 실시간 패킷 캡처 → Kafka
│   ├── model/                  # 학습된 모델 파일 (git 제외)
│   │   ├── xgboost_model.pkl
│   │   ├── label_encoder.pkl
│   │   └── feature_names.pkl
│   ├── data/                   # CICIDS2017 CSV 데이터셋 (git 제외)
│   ├── tests/
│   │   ├── test_unit.py        # pytest 단위 테스트
│   │   └── test_integration.py # pytest 통합 테스트
│   └── start_capture_admin.bat # 관리자 권한 캡처 실행 배치파일
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── hooks/
    │   │   └── useWebSocket.js      # WebSocket 훅 (자동 재연결)
    │   └── components/
    │       ├── Dashboard/           # 통계 카드 + 분포 바
    │       ├── TrafficChart/        # Chart.js 실시간 라인 차트
    │       └── AlertTable/          # 이벤트 로그 테이블 + 필터
    └── package.json
```

---

## 시작하기

### 사전 요구사항

- Docker Desktop
- Node.js 18+
- Python 3.10+ (Anaconda 권장)
- Windows 환경 (Raw Socket 캡처는 Windows 전용)

### 1. Docker 인프라 시작

```bash
docker compose up -d
```

컨테이너 3개가 올라옵니다: `soc-postgres`, `soc-zookeeper`, `soc-kafka`

### 2. ML 서버 의존성 설치 및 모델 학습

```bash
cd ml-server
pip install fastapi uvicorn xgboost scikit-learn joblib numpy pandas kafka-python
```

CICIDS2017 CSV 파일을 `ml-server/data/MachineLearningCSV/MachineLearningCVE/` 에 위치시킨 후:

```bash
python train.py
```

### 3. ML 서버 실행

```bash
cd ml-server
python main.py
# → http://localhost:8000
```

### 4. 백엔드 실행

```bash
cd backend
npm install
node index.js
# → http://localhost:4000
```

### 5. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3002 (또는 Vite가 배정한 포트)
```

### 6. 패킷 캡처 시작 (관리자 권한 필요)

```bash
# 방법 1: 배치파일 더블클릭 (UAC 승인)
ml-server/start_capture_admin.bat

# 방법 2: 관리자 권한 터미널에서 직접 실행
python ml-server/capture.py --raw
```

---

## 환경 변수 (`backend/.env`)

```env
PORT=4000
KAFKA_BROKER=localhost:9092
KAFKA_TOPIC=network-traffic
KAFKA_GROUP_ID=soc-consumer-group
ML_SERVER_URL=http://127.0.0.1:8000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=security_soc
DB_USER=postgres
DB_PASSWORD=postgres
REAL_CAPTURE=true   # true: capture.py 사용 / false: JS 시뮬레이터 사용
```

---

## capture.py 옵션

```bash
python capture.py [옵션]

  --raw               강제로 Windows Raw Socket 모드 사용 (Npcap 없을 때)
  --iface IFACE       캡처 인터페이스 지정 (scapy 모드 전용)
  --broker BROKER     Kafka 브로커 주소 (기본: localhost:9092)
  --topic TOPIC       Kafka 토픽 (기본: network-traffic)
  --timeout N         Flow 타임아웃 초 (기본: 5)
  --flush N           Kafka 전송 주기 초 (기본: 5)
  --exclude CIDR ...  추가 제외 서브넷 (기본 제외: 172.16.0.0/12, 127.0.0.0/8, 169.254.0.0/16)
  --no-exclude        IP 필터 비활성화
  --list-iface        사용 가능한 인터페이스 목록 출력
```

---

## API 엔드포인트

### 백엔드 (`:4000`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/events` | 트래픽 이벤트 목록 (`?limit=50&label=DDoS`) |
| GET | `/api/stats` | 레이블별 집계 통계 |
| WS | `ws://localhost:4000` | 실시간 이벤트 스트림 |

### ML 서버 (`:8000`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 및 모델 로드 여부 |
| POST | `/predict` | Flow 피처 → 공격 유형 분류 |

---

## 테스트

```bash
# 백엔드 단위 테스트
cd backend
npm test

# 백엔드 통합 테스트 (DB 연결 필요)
npm run test:integration

# ML 서버 단위 테스트
cd ml-server
pytest tests/test_unit.py -v

# ML 서버 통합 테스트 (모델 파일 필요)
pytest tests/test_integration.py -v
```

---

## DB 초기화

```bash
docker exec soc-postgres psql -U postgres -d security_soc \
  -c "TRUNCATE TABLE traffic_events RESTART IDENTITY;"
```

---

## 주요 설계 결정

- **Raw Socket 폴백**: Npcap/Scapy 설치 없이도 Windows Raw Socket으로 패킷 캡처 가능
- **Docker IP 필터링**: `172.16.0.0/12` 등 내부 트래픽을 제외하여 PortScan 과분류 방지
- **Flow 기반 피처**: 개별 패킷이 아닌 5-tuple Flow 단위로 피처를 추출하여 CICIDS2017 학습 피처와 일치
- **REAL_CAPTURE 모드**: 환경 변수 하나로 실제 캡처 ↔ 시뮬레이터 전환 가능
