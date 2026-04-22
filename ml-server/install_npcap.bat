@echo off
echo Npcap 설치 중... (관리자 권한 필요)
powershell -Command "Start-Process '%~dp0..\..\..\Users\smhrd\AppData\Local\Temp\npcap-installer.exe' -ArgumentList '/S /winpcap_mode=yes' -Verb RunAs -Wait"
echo 설치 완료. 이 창을 닫아도 됩니다.
pause
