# Security SOC - 전체 서비스 종료

Write-Host "`n[SOC] 전체 서비스 종료 중..." -ForegroundColor Yellow

# Python 프로세스 종료 (ML 서버 + capture.py)
$py = Get-Process python -ErrorAction SilentlyContinue
if ($py) {
    $py | Stop-Process -Force
    Write-Host "  OK  Python 프로세스 종료 (ML 서버, capture.py)" -ForegroundColor Green
} else {
    Write-Host "      Python 프로세스 없음" -ForegroundColor Gray
}

# Node 프로세스 종료 (백엔드 + 프론트엔드)
$node = Get-Process node -ErrorAction SilentlyContinue
if ($node) {
    $node | Stop-Process -Force
    Write-Host "  OK  Node.js 프로세스 종료 (백엔드, 프론트엔드)" -ForegroundColor Green
} else {
    Write-Host "      Node.js 프로세스 없음" -ForegroundColor Gray
}

# Docker 컨테이너는 유지 (데이터 보존)
# 완전히 내리려면 아래 주석 해제:
# docker compose down
# Write-Host "  OK  Docker 컨테이너 종료" -ForegroundColor Green

Write-Host "`n  Docker(Kafka/PostgreSQL)는 유지됩니다." -ForegroundColor Gray
Write-Host "  완전히 내리려면: docker compose down`n" -ForegroundColor Gray
