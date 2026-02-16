# =====================================
# React 애플리케이션 종료 스크립트
# 파일명: stop.ps1
# =====================================

$SERVER_USER = "ubuntu"
$SERVER_IP   = ""
$REMOTE_PATH = "~/Trader/WebTestClient"
$SSH_KEY     = ""  # SSH 키 경로 (필요시 수정)

Write-Host "====================================="
Write-Host "서버에 접속하여 애플리케이션 종료를 요청합니다."
Write-Host "====================================="

# 원격 쉘에 CRLF가 전달되어 발생하는 문제를 피하기 위해 단일 행 명령으로 구성
$remoteCommand = "cd $REMOTE_PATH/TestRun && sed -i '1s/^\xEF\xBB\xBF//' stop.sh && sed -i 's/\r$//' stop.sh && chmod +x stop.sh && ./stop.sh"

ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_IP" "$remoteCommand"

if ($LASTEXITCODE -ne 0) {
    Write-Host "애플리케이션 종료 중 오류가 발생했습니다." -ForegroundColor Red
    exit 1
}

Write-Host "====================================="
Write-Host "애플리케이션 종료 요청이 완료되었습니다."
Write-Host "====================================="
