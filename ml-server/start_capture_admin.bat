@echo off
:: 관리자 권한으로 capture.py 실행 (Raw Socket 모드)
echo [SOC] 실시간 패킷 캡처 시작 (관리자 권한 필요)
powershell -Command "Start-Process python -ArgumentList 'C:\Users\smhrd\Desktop\security-soc\ml-server\capture.py --raw' -Verb RunAs -WindowStyle Normal"
