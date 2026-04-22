# Security SOC - 서비스 상태 확인

function Check-Http {
    param([string]$url, [string]$label)
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Write-Host "  [UP]  $label" -ForegroundColor Green
    } catch {
        Write-Host "  [DOWN] $label" -ForegroundColor Red
    }
}

function Check-Port {
    param([int]$port, [string]$label)
    $conn = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
    if ($conn.TcpTestSucceeded) {
        Write-Host "  [UP]  $label (:$port)" -ForegroundColor Green
    } else {
        Write-Host "  [DOWN] $label (:$port)" -ForegroundColor Red
    }
}

Write-Host "`n[SOC] 서비스 상태 확인`n" -ForegroundColor Cyan

# Docker 컨테이너
Write-Host "── Docker ──────────────────────────" -ForegroundColor Yellow
$containers = @("soc-postgres", "soc-zookeeper", "soc-kafka")
foreach ($c in $containers) {
    $status = docker inspect --format "{{.State.Status}}" $c 2>&1
    if ($status -eq "running") {
        Write-Host "  [UP]  $c" -ForegroundColor Green
    } else {
        Write-Host "  [DOWN] $c ($status)" -ForegroundColor Red
    }
}

# 앱 서비스
Write-Host "`n── 앱 서비스 ───────────────────────" -ForegroundColor Yellow
Check-Http -url "http://127.0.0.1:8000/health" -label "ML 서버   (FastAPI :8000)"
Check-Port -port 4000 -label "백엔드     (Node.js)"
$found = $false
foreach ($port in @(5173, 3000, 3001, 3002, 3003)) {
    $conn = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
    if ($conn.TcpTestSucceeded) {
        Write-Host "  [UP]  프론트엔드 (Vite :$port) → http://localhost:$port" -ForegroundColor Green
        $found = $true; break
    }
}
if (-not $found) { Write-Host "  [DOWN] 프론트엔드 (Vite)" -ForegroundColor Red }

# 프로세스 확인
Write-Host "`n── 프로세스 ─────────────────────────" -ForegroundColor Yellow
$pyProcs = Get-Process python -ErrorAction SilentlyContinue
if ($pyProcs) {
    Write-Host "  [UP]  Python 프로세스 $($pyProcs.Count)개 실행 중" -ForegroundColor Green
} else {
    Write-Host "  [DOWN] Python 프로세스 없음" -ForegroundColor Red
}
$nodeProcs = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcs) {
    Write-Host "  [UP]  Node.js 프로세스 $($nodeProcs.Count)개 실행 중" -ForegroundColor Green
} else {
    Write-Host "  [DOWN] Node.js 프로세스 없음" -ForegroundColor Red
}

Write-Host ""
