# Security SOC Dashboard

실시간 네트워크 침입 탐지 시스템 (IDS) 대시보드입니다.  
CICIDS2017 데이터셋으로 학습한 XGBoost 모델이 네트워크 트래픽을 7개 유형으로 분류하고, React 대시보드에서 실시간 시각화합니다.

---

## 시스템 아키텍처

```
[트래픽 소스]
  ├── producer.js  (시뮬레이션 모드: 1초마다 랜덤 트래픽 생성)
  └── capture.py   (실제 모드: Raw Socket 캡처, 관리자 권한 필요)
         │ Kafka Producer
         ▼
  Kafka (Docker :9092)
         │ Kafka Consumer
         ▼
  backend/index.js (Node.js :4000)
     ├──► ML 서버 /predict (FastAPI :8000) ──► XGBoost 분류 + 확률
     ├──► PostgreSQL (Docker :5432)         ──► 이벤트 / 인시던트 저장
     ├──► alertManager.js                  ──► 임계값 기반 경보
     └──► WebSocket                        ──► 실시간 브로드캐스트
              │
              ▼
     React 대시보드 (:3000)
       ├── 모니터링      — 실시간 차트 + 경보 테이블 + 위험 팝업
       ├── 공격 패턴     — 공격 유형 상세 + MITRE ATT&CK 매핑
       ├── 보안 리포트   — 통계 / 트렌드 / 히트맵 / PDF·CSV 내보내기
       ├── 인시던트      — 보안 사건 관리 (생성·상태 전환·메모)
       └── 재학습        — XGBoost 모델 재학습 (SSE 실시간 로그)
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
| 프론트엔드 | React 18 + Vite + Chart.js + react-chartjs-2 |
| 인프라 | Docker Compose |

---

## 분류 클래스

| 레이블 | 설명 | MITRE 전술 |
|--------|------|-----------|
| BENIGN | 정상 트래픽 | — |
| DoS | 서비스 거부 (Hulk, GoldenEye, Slowloris, Slowhttptest) | Impact (TA0040) |
| DDoS | 분산 서비스 거부 | Impact (TA0040) |
| PortScan | 포트 스캔 | Discovery (TA0007) |
| BruteForce | 무차별 대입 (FTP-Patator, SSH-Patator) | Credential Access (TA0006) |
| WebAttack | 웹 공격 (SQL Injection, XSS, Brute Force) | Initial Access (TA0001) |
| Botnet | 봇넷 C&C 통신 | Command and Control (TA0011) |

---

## 프로젝트 구조

```
security-soc/
├── docker-compose.yml              # PostgreSQL + Zookeeper + Kafka
├── backend/
│   ├── index.js                    # Express 서버 진입점
│   ├── db.js                       # PostgreSQL (traffic_events + incidents 테이블)
│   ├── maintenance.js              # 오래된 이벤트 자동 정리 (DATA_RETENTION_DAYS)
│   ├── .env                        # 환경 변수
│   ├── kafka/
│   │   ├── consumer.js             # Kafka Consumer → ML 분류 → DB 저장 → WS 브로드캐스트
│   │   └── producer.js             # 시뮬레이션 모드용 Kafka Producer
│   ├── websocket/
│   │   └── ws.js                   # WebSocket 브로드캐스트 (traffic_event / alert 타입)
│   ├── alerts/
│   │   └── alertManager.js         # 슬라이딩 윈도우 임계값 경보 + 규칙 CRUD
│   ├── routes/
│   │   ├── api.js                  # REST API 엔드포인트
│   │   └── retrain.js              # 모델 재학습 SSE 스트리밍 라우터
│   └── tests/
│       ├── unit/                   # Jest 단위 테스트
│       └── integration/            # Supertest 통합 테스트
├── ml-server/
│   ├── main.py                     # FastAPI ML 서버 (/predict, /health, /metrics)
│   ├── train.py                    # XGBoost 학습 + metrics.json 저장
│   ├── capture.py                  # 실시간 패킷 캡처 → Kafka
│   ├── model/                      # 학습된 모델 파일 (git 제외)
│   │   ├── xgboost_model.pkl
│   │   ├── label_encoder.pkl
│   │   ├── feature_names.pkl
│   │   └── metrics.json            # 클래스별 F1·Precision·Recall
│   ├── data/                       # CICIDS2017 CSV (git 제외)
│   ├── tests/
│   │   ├── test_unit.py
│   │   └── test_integration.py
│   └── start_capture_admin.bat     # 관리자 권한 캡처 실행 배치파일
└── frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx                             # React Router (5개 페이지)
        ├── pages/
        │   ├── MonitoringPage.jsx              # 실시간 모니터링
        │   ├── AttackPatternsPage.jsx          # 공격 패턴 + MITRE ATT&CK
        │   ├── ReportPage.jsx                  # 보안 리포트
        │   ├── IncidentsPage.jsx               # 인시던트 관리
        │   └── RetrainPage.jsx                 # 모델 재학습 UI
        ├── components/
        │   ├── Sidebar/                        # 사이드 내비게이션
        │   ├── TrafficChart/                   # 실시간 라인 차트
        │   ├── AlertTable/                     # 이벤트 테이블 (검색·위험도·상세 모달)
        │   ├── AlertToast/                     # 공격 탐지 토스트
        │   ├── AlertHistoryPanel/              # 경보 히스토리 (최대 50건)
        │   ├── AlertRulesPanel/                # 임계값·윈도우 슬라이더
        │   ├── CriticalAlertModal/             # 고위험 전체화면 경보 + 경보음
        │   ├── HealthPanel/                    # ML·DB 상태 + 모델 성능 토글
        │   ├── TrendChart/                     # 일별 공격 트렌드 + 선형회귀 라인
        │   ├── HourlyHeatmap/                  # 시간대 × 공격유형 히트맵
        │   └── DateRangePicker/                # 날짜 범위 선택
        ├── context/
        │   └── ThemeContext.jsx                # 라이트/다크 테마 토큰
        ├── hooks/
        │   ├── useWebSocket.js                 # WebSocket 훅 (자동 재연결)
        │   └── useNotification.js              # 브라우저 Notification API
        └── utils/
            └── reportPDF.js                    # 브라우저 인쇄 API 기반 PDF
```

---

## 시작하기

### 사전 요구사항

- Docker Desktop
- Node.js 18+
- Python 3.10+ (Anaconda 권장)

### 1. Docker 인프라 시작

```bash
docker compose up -d
```

컨테이너 3개 실행: `soc-postgres` (5432) · `soc-zookeeper` · `soc-kafka` (9092)

> **재시작 시 주의**: `docker compose up -d` 대신 `docker compose down && docker compose up -d`로  
> 컨테이너를 완전히 재생성하면 Kafka의 Zookeeper 노드 충돌을 방지할 수 있습니다.

### 2. ML 서버 의존성 설치

```bash
cd ml-server
pip install fastapi uvicorn xgboost scikit-learn joblib numpy pandas kafka-python
```

### 3. 모델 학습 (최초 1회 or 재학습 시)

CICIDS2017 CSV 파일을 `ml-server/data/MachineLearningCSV/MachineLearningCVE/`에 위치시킨 후:

```bash
python train.py
# → model/xgboost_model.pkl, label_encoder.pkl, feature_names.pkl, metrics.json 생성
```

또는 웹 대시보드 **재학습** 페이지에서 버튼 클릭으로 실행 가능 (SSE 실시간 로그 출력)

### 4. ML 서버 실행

```bash
cd ml-server
python main.py
# → http://localhost:8000
```

### 5. 백엔드 실행

```bash
cd backend
npm install
npm run dev      # nodemon (개발)
# 또는
node index.js    # 프로덕션
# → http://localhost:4000
```

### 6. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 7. 패킷 캡처 (실제 모드, 관리자 권한 필요)

```bash
# .env에서 REAL_CAPTURE=true 설정 후

# 방법 1: 배치파일 (Windows UAC 승인)
ml-server/start_capture_admin.bat

# 방법 2: 관리자 터미널에서 직접 실행
python ml-server/capture.py --raw
```

시뮬레이션 모드로 실행하려면 `.env`에서 `REAL_CAPTURE=true`를 주석 처리하세요.

---

## 환경 변수 (`backend/.env`)

```env
PORT=4000
KAFKA_BROKER=127.0.0.1:9092       # localhost는 IPv6 문제로 127.0.0.1 권장
KAFKA_TOPIC=network-traffic
KAFKA_GROUP_ID=soc-consumer-group
ML_SERVER_URL=http://127.0.0.1:8000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=security_soc
DB_USER=postgres
DB_PASSWORD=postgres
REAL_CAPTURE=true                  # true: capture.py 사용 / 주석: JS 시뮬레이터
DATA_RETENTION_DAYS=7              # 이벤트 보존 기간 (일)
```

---

## API 엔드포인트

### 백엔드 (`:4000`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 서버·ML·DB 상태 확인 |
| GET | `/api/events` | 이벤트 목록 (`?limit&label&from&to&minConfidence`) |
| GET | `/api/stats` | 레이블별 집계 (`?from&to`) |
| GET | `/api/events/hourly` | 시간대별 집계 (`?from&to`) |
| GET | `/api/events/daily` | 일별 집계 (`?from&to`) |
| GET | `/api/events/export` | CSV 다운로드 |
| GET | `/api/alert-rules` | 경보 규칙 전체 조회 |
| PUT | `/api/alert-rules/:label` | 경보 규칙 수정 (threshold, windowSec) |
| GET | `/api/incidents` | 인시던트 목록 (`?status&label`) |
| POST | `/api/incidents` | 인시던트 생성 |
| PUT | `/api/incidents/:id` | 인시던트 수정 (상태·메모) |
| DELETE | `/api/incidents/:id` | 인시던트 삭제 |
| POST | `/api/retrain/start` | 모델 재학습 시작 (SSE 스트림) |
| POST | `/api/retrain/stop` | 재학습 강제 중단 |
| GET | `/api/retrain/status` | 재학습 진행 여부 |
| WS | `ws://localhost:4000` | 실시간 이벤트 스트림 |

### ML 서버 (`:8000`)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 및 모델 로드 여부 |
| POST | `/predict` | 피처 18개 → 레이블 + 확률 반환 |
| GET | `/metrics` | 클래스별 F1·Precision·Recall (metrics.json) |

---

## 주요 기능

### 실시간 모니터링
- WebSocket으로 탐지 이벤트 실시간 수신
- DDoS·DoS·BruteForce 탐지 시 전체화면 경보 팝업 + AudioContext 경보음
- 브라우저 Notification API 알림 (HIGH 위험도 이벤트)
- 경보 히스토리 패널 (최대 50건, 위험도 뱃지)
- 공격 유형별 임계값·윈도우 슬라이더 실시간 조정

### 공격 패턴
- 6개 공격 유형 상세 설명 (탐지 지표, XGBoost 피처 특성, 대응 방법)
- MITRE ATT&CK 전술·기술 매핑 (카드 클릭 시 공식 사이트 연결)

### 보안 리포트
- 프리셋 기간 (오늘·3일·7일·전체) 및 직접 날짜 범위 선택
- 요약 카드 4개 (전체 이벤트·공격 탐지·정상 트래픽·최다 공격 유형)
- 일별 공격 트렌드 차트 (스택 바 + 선형회귀 트렌드 라인)
- 시간대 × 공격유형 히트맵
- PDF 출력 (브라우저 인쇄 API), CSV 내보내기 (18개 피처 포함)

### 인시던트 관리
- 인시던트 생성 (severity·label·title·notes)
- 상태 전환: open → investigating → resolved
- 메모 편집, 삭제

### 모델 재학습
- 웹 UI에서 버튼 클릭으로 `train.py` 실행
- SSE(Server-Sent Events)로 stdout/stderr 실시간 스트리밍
- 5단계 진행 표시기 (CSV 로드 → 정제 → 불균형 처리 → 학습 → 완료)
- 강제 중단 버튼, 로그 창 초기화

---

## 테스트

```bash
# 백엔드 단위 테스트
cd backend && npm test

# 백엔드 통합 테스트 (DB 연결 필요)
cd backend && npm run test:integration

# ML 서버 단위 테스트
cd ml-server && pytest tests/test_unit.py -v

# ML 서버 통합 테스트 (모델 파일 필요)
cd ml-server && pytest tests/test_integration.py -v
```

---

## DB 초기화

```bash
# 이벤트 전체 삭제
docker exec soc-postgres psql -U postgres -d security_soc \
  -c "TRUNCATE TABLE traffic_events RESTART IDENTITY;"

# 인시던트 전체 삭제
docker exec soc-postgres psql -U postgres -d security_soc \
  -c "TRUNCATE TABLE incidents RESTART IDENTITY;"
```

---

## 주요 설계 결정

- **Kafka 브로커 주소**: `localhost` 대신 `127.0.0.1` 사용 (Windows IPv6 우선 해석 문제 방지)
- **Raw Socket 폴백**: Npcap/Scapy 없이도 Windows Raw Socket으로 패킷 캡처 가능
- **Docker IP 필터링**: `172.16.0.0/12` 등 내부 트래픽 제외로 PortScan 과분류 방지
- **Flow 기반 피처**: 5-tuple Flow 단위 피처 추출로 CICIDS2017 학습 피처와 일치
- **슬라이딩 윈도우 경보**: 공격 유형별 독립 윈도우로 임계값 초과 시 WebSocket 경보 전송
- **SSE 재학습**: 긴 작업인 train.py를 child_process로 실행, stdout을 SSE로 스트리밍
- **MITRE ATT&CK**: 6개 공격 유형에 전술·기술 매핑, 공식 사이트 딥링크 제공
- **라이트/다크 테마**: ThemeContext 토큰 시스템으로 전체 UI 일관성 유지
- **PDF/CSV 내보내기**: PDF는 브라우저 인쇄 API, CSV는 서버 스트리밍 다운로드
