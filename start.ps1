# Security SOC - 통합 실행 스크립트
# 관리자 권한 자동 요청 (capture.py Raw Socket 필요)

param(
    [switch]$NoCapture,    # capture.py 없이 시작
    [switch]$NoBrowser     # 브라우저 자동 오픈 생략
)

# ── 관리자 권한 자동 상승 ─────────────────────────────────────────────────────
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    if ($NoCapture) { $argList += " -NoCapture" }
    if ($NoBrowser) { $argList += " -NoBrowser" }
    Start-Process powershell -ArgumentList $argList -Verb RunAs
    exit
}

$ROOT = Split-Path -Parent $PSCommandPath

function Write-Step { param($msg) Write-Host "`n[SOC] $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "  ERR $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "      $msg" -ForegroundColor Gray }

# ── 헬스 체크 함수 ────────────────────────────────────────────────────────────
function Wait-Http {
    param([string]$url, [int]$timeoutSec = 60, [string]$label = $url)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -eq 200) { Write-Ok "$label 응답 확인"; return $true }
        } catch {}
        Start-Sleep -Seconds 2
    }
    Write-Fail "$label 응답 없음 (${timeoutSec}s 초과)"
    return $false
}

function Wait-Port {
    param([int]$port, [int]$timeoutSec = 30, [string]$label = "포트 $port")
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        $conn = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
        if ($conn.TcpTestSucceeded) { Write-Ok "$label 열림"; return $true }
        Start-Sleep -Seconds 2
    }
    Write-Fail "$label 열리지 않음"
    return $false
}

# ── 배너 ─────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host @"
╔══════════════════════════════════════════╗
║      Security SOC - 통합 실행 스크립트      ║
║  XGBoost IDS  |  Kafka  |  React 대시보드  ║
╚══════════════════════════════════════════╝
"@ -ForegroundColor Yellow

# ── Step 1: Docker 컨테이너 ──────────────────────────────────────────────────
Write-Step "1/5  Docker 인프라 시작 (PostgreSQL + Zookeeper + Kafka)"
Set-Location $ROOT
$dockerOut = docker compose up -d 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose up 실패. Docker Desktop이 실행 중인지 확인하세요."
    Write-Info $dockerOut
    Read-Host "엔터를 눌러 종료"
    exit 1
}
Write-Ok "컨테이너 시작 요청 완료"

# Kafka 준비 대기 (최대 60초)
Write-Info "Kafka 준비 대기 중..."
$kafkaReady = $false
for ($i = 0; $i -lt 30; $i++) {
    $result = docker exec soc-kafka kafka-topics --bootstrap-server localhost:9092 --list 2>&1
    if ($LASTEXITCODE -eq 0) { $kafkaReady = $true; break }
    Start-Sleep -Seconds 2
}
if ($kafkaReady) { Write-Ok "Kafka 준비 완료" }
else { Write-Fail "Kafka 준비 시간 초과 — 계속 진행합니다 (자동 재연결됨)" }

# ── Step 2: ML 서버 ───────────────────────────────────────────────────────────
Write-Step "2/5  ML 서버 시작 (FastAPI + XGBoost, :8000)"
$mlServerPath = Join-Path $ROOT "ml-server"
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$mlServerPath'; python main.py; pause`"" `
    -WindowStyle Normal

if (-not (Wait-Http -url "http://127.0.0.1:8000/health" -timeoutSec 60 -label "ML 서버")) {
    Write-Fail "ML 서버 기동 실패. 수동으로 확인하세요."
}

# ── Step 3: 백엔드 ────────────────────────────────────────────────────────────
Write-Step "3/5  백엔드 시작 (Node.js + Express + WebSocket, :4000)"
$backendPath = Join-Path $ROOT "backend"
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$backendPath'; node index.js; pause`"" `
    -WindowStyle Normal

if (-not (Wait-Port -port 4000 -timeoutSec 30 -label "백엔드 :4000")) {
    Write-Fail "백엔드 기동 실패. 수동으로 확인하세요."
}

# ── Step 4: 프론트엔드 ────────────────────────────────────────────────────────
Write-Step "4/5  프론트엔드 시작 (React + Vite)"
$frontendPath = Join-Path $ROOT "frontend"
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$frontendPath'; npm run dev; pause`"" `
    -WindowStyle Normal

# Vite는 포트를 자동 배정하므로 잠시 대기 후 포트 탐색
Start-Sleep -Seconds 5
$frontendPort = $null
foreach ($port in @(5173, 3000, 3001, 3002, 3003)) {
    $conn = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
    if ($conn.TcpTestSucceeded) { $frontendPort = $port; break }
}
if ($frontendPort) { Write-Ok "프론트엔드 :$frontendPort 열림" }
else { Write-Info "프론트엔드 포트 탐지 실패 — 잠시 후 브라우저를 직접 열어주세요" }

# ── Step 5: 패킷 캡처 ─────────────────────────────────────────────────────────
if (-not $NoCapture) {
    Write-Step "5/5  패킷 캡처 시작 (Windows Raw Socket)"
    $captureScript = Join-Path $ROOT "ml-server\capture.py"
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"python '$captureScript' --raw; pause`"" `
        -WindowStyle Normal
    Write-Ok "capture.py 시작 (Docker IP 필터 적용)"
} else {
    Write-Step "5/5  패킷 캡처 건너뜀 (--NoCapture 옵션)"
}

# ── 완료 요약 ─────────────────────────────────────────────────────────────────
$dashUrl = if ($frontendPort) { "http://localhost:$frontendPort" } else { "http://localhost:5173" }

Write-Host "`n" + "─" * 46 -ForegroundColor Yellow
Write-Host "  전체 서비스 기동 완료" -ForegroundColor Green
Write-Host "─" * 46 -ForegroundColor Yellow
Write-Host "  대시보드   : $dashUrl" -ForegroundColor White
Write-Host "  백엔드 API : http://localhost:4000/api/events" -ForegroundColor White
Write-Host "  ML 서버    : http://localhost:8000/health" -ForegroundColor White
Write-Host "─" * 46 -ForegroundColor Yellow
Write-Host "  종료하려면 stop.ps1 또는 stop.bat 실행" -ForegroundColor Gray
Write-Host ""

# 브라우저 자동 오픈
if (-not $NoBrowser -and $frontendPort) {
    Start-Sleep -Seconds 2
    Start-Process $dashUrl
}
