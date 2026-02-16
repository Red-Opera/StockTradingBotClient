# =====================================
# React TypeScript 배포 스크립트
# 파일명: run.ps1
# =====================================

$SERVER_USER = "ubuntu"
$SERVER_IP   = ""
$REMOTE_PATH = "~/Trader/WebTestClient"
$ARCHIVE     = "client-test.tar.gz"
$SSH_KEY     = ""      # SSH 키 경로
$PROJECT_PATH = "D:\Development\Trader\StockTradingBotClient"

# 현재 스크립트 위치 확인
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$ARCHIVE_PATH = Join-Path $SCRIPT_DIR $ARCHIVE

# 경로 유효성 검사
if (-Not (Test-Path $PROJECT_PATH)) {
    Write-Host "ERROR: 입력한 경로가 존재하지 않습니다: $PROJECT_PATH" -ForegroundColor Red
    exit 1
}

Write-Host "배포할 폴더: $PROJECT_PATH" -ForegroundColor Green
Write-Host "압축 파일 저장 위치: $ARCHIVE_PATH" -ForegroundColor Cyan

# ==============================
Write-Host "====================================="
Write-Host "제외할 폴더 및 파일 패턴"
Write-Host "====================================="
$EXCLUDE_PATTERNS = @(
    ".git"
    ".vs"
    ".vscode"
    "node_modules"
    "*.log"
    ".env"
    ".env.local"
    "dist"
    "build"
    "coverage"
    ".cache"
    "tmp"
    "temp"
)

Write-Host "제외 패턴: $($EXCLUDE_PATTERNS -join ', ')" -ForegroundColor Yellow

# ==============================
Write-Host "====================================="
Write-Host "임시 복사 제거: 프로젝트에서 직접 압축 생성 (더 빠름)"
Write-Host "====================================="

# TestRun/run.sh가 프로젝트에 있는지 확인
$projectRunSh = Join-Path $PROJECT_PATH "TestRun\run.sh"
if (Test-Path $projectRunSh) {
    Write-Host "✓ TestRun/run.sh 파일 확인됨: $projectRunSh" -ForegroundColor Green
} else {
    Write-Host "WARNING: TestRun/run.sh 파일을 찾을 수 없습니다: $projectRunSh" -ForegroundColor Yellow
}

# 압축 생성: 프로젝트 디렉토리에서 직접 tar 생성 (빠른 압축 레벨)
# GZIP 환경변수로 빠른 압축을 지정
$oldGzip = $env:GZIP
$env:GZIP = '-1'

# 제외 인자 준비
$excludeArgs = @()
foreach ($p in $EXCLUDE_PATTERNS) {
    $excludeArgs += "--exclude=$p"
}
# TestRun 내부의 PowerShell 배포 스크립트(run.ps1)만 제외하고 TestRun/run.sh는 포함
# 다양한 tar 구현과 경로 형태 차이로 인한 누락을 방지하기 위해 여러 패턴 형태를 추가
$excludeArgs += "--exclude=TestRun/run.ps1"
$excludeArgs += "--exclude=./TestRun/run.ps1"
$excludeArgs += "--exclude=TestRun\\run.ps1"
$excludeArgs += "--exclude=.\\TestRun\\run.ps1"

# tar 인자 배열 생성
$tarArgs = @('-C', $PROJECT_PATH, '-czf', $ARCHIVE_PATH) + $excludeArgs + '.'

Write-Host "압축 진행 중... (빠른 모드)" -ForegroundColor Cyan
$tarExit = & tar @tarArgs
$tarResult = $LASTEXITCODE

# GZIP 환경 복원
if ($null -ne $oldGzip) { $env:GZIP = $oldGzip } else { Remove-Item Env:\GZIP -ErrorAction SilentlyContinue }

if ($tarResult -ne 0) {
    Write-Host "ERROR: tar 명령 실패 (종료 코드: $tarResult)" -ForegroundColor Red
    if (Test-Path $ARCHIVE_PATH) { Remove-Item $ARCHIVE_PATH -Force }
    exit 1
}

# 압축 파일 존재 확인
if (-Not (Test-Path $ARCHIVE_PATH)) {
    Write-Host "ERROR: 압축 파일이 생성되지 않았습니다: $ARCHIVE_PATH" -ForegroundColor Red
    exit 1
}

# 압축된 파일 목록(처음 20개)
Write-Host "압축 파일 내부 목록 (처음 20개):" -ForegroundColor Cyan
try {
    $contents = & tar -tzf $ARCHIVE_PATH 2>$null | Select-Object -First 20
    foreach ($line in $contents) { Write-Host "  - $line" -ForegroundColor Gray }
    $totalCount = (& tar -tzf $ARCHIVE_PATH 2>$null | Measure-Object).Count
    if ($totalCount -gt 20) { Write-Host "  ... 외 $($totalCount - 20)개 파일" -ForegroundColor Gray }
} catch {
    Write-Host "WARNING: 압축 내부 목록을 가져오지 못했습니다." -ForegroundColor Yellow
}

# 압축 파일 크기 확인
$archiveSize = (Get-Item $ARCHIVE_PATH).Length / 1MB
Write-Host "✓ 압축 파일 크기: $([math]::Round($archiveSize, 2)) MB" -ForegroundColor Green

# ==============================
Write-Host "`n====================================="
Write-Host "서버 디렉토리를 생성합니다."
Write-Host "====================================="
$SSH_TARGET = "${SERVER_USER}@${SERVER_IP}"
ssh -i "$SSH_KEY" "$SSH_TARGET" "mkdir -p $REMOTE_PATH"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: 서버 디렉토리 생성에 실패했습니다." -ForegroundColor Red
    Remove-Item $ARCHIVE_PATH
    exit 1
}
Write-Host "✓ 서버 디렉토리 준비 완료" -ForegroundColor Green

# ==============================
Write-Host "`n====================================="
Write-Host "서버로 파일을 업로드합니다."
Write-Host "====================================="
$REMOTE_TARGET = "${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/"
Write-Host "업로드 중: $ARCHIVE -> $REMOTE_TARGET" -ForegroundColor Cyan
scp -i "$SSH_KEY" "$ARCHIVE_PATH" "$REMOTE_TARGET"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: 파일 업로드에 실패했습니다." -ForegroundColor Red
    Remove-Item $ARCHIVE_PATH
    exit 1
}

Write-Host "✓ 파일 업로드 완료" -ForegroundColor Green

# ==============================
Write-Host "`n====================================="
Write-Host "서버 디렉토리를 초기화하고 배포합니다."
Write-Host "====================================="
Write-Host "서버에서 배포 진행 중..." -ForegroundColor Cyan

$deployCommand = "cd $REMOTE_PATH && echo '기존 파일 삭제 중 (sudo 사용)...' && sudo find . -mindepth 1 -maxdepth 1 ! -name '$ARCHIVE' -exec rm -rf {} + && echo '압축 해제 중...' && tar -xzf $ARCHIVE && rm -f $ARCHIVE && echo '' && echo '배포 완료!' && echo '총 파일 수:' && find . -type f | wc -l"

ssh -i "$SSH_KEY" "$SSH_TARGET" $deployCommand

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: 서버 배포 중 오류가 발생했습니다." -ForegroundColor Red
    Remove-Item $ARCHIVE_PATH
    exit 1
}

# 로컬 압축 파일 삭제
Remove-Item $ARCHIVE_PATH
Write-Host "`n✓ 로컬 압축 파일 정리 완료" -ForegroundColor Green

# ==============================
Write-Host "`n====================================="
Write-Host "애플리케이션 실행 (run.sh)"
Write-Host "====================================="
Write-Host "서버에서 run.sh 스크립트를 실행합니다..." -ForegroundColor Cyan

# 먼저 run.sh 파일 확인 (TestRun/run.sh 경로)
$remoteRunPath = "$REMOTE_PATH/TestRun/run.sh"
$runShExists = ssh -i "$SSH_KEY" "$SSH_TARGET" "test -f $remoteRunPath && echo 'exists' || echo 'not_found'"

if ($runShExists -notmatch "exists") {
    Write-Host "ERROR: TestRun/run.sh 파일을 찾을 수 없습니다: $remoteRunPath" -ForegroundColor Red
    exit 1
}

Write-Host "✓ TestRun/run.sh 파일 발견" -ForegroundColor Green

# BOM 제거 및 줄바꿈 문자 변환
Write-Host "파일 형식 변환 중 (BOM 제거, 줄바꿈 변환)..." -ForegroundColor Cyan
ssh -i "$SSH_KEY" "$SSH_TARGET" "sed -i '1s/^\xEF\xBB\xBF//' $remoteRunPath && sed -i 's/\r$//' $remoteRunPath"

# 실행 권한 부여
Write-Host "실행 권한 부여 중..." -ForegroundColor Cyan
ssh -i "$SSH_KEY" "$SSH_TARGET" "chmod +x $remoteRunPath"

# 스크립트 실행 (TestRun 폴더에서 실행)
Write-Host "`n스크립트 실행 중..." -ForegroundColor Cyan
ssh -i "$SSH_KEY" "$SSH_TARGET" "cd $REMOTE_PATH/TestRun && ./run.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: run.sh 실행 중 오류가 발생했습니다." -ForegroundColor Red
    Write-Host "`n디버깅 명령어:" -ForegroundColor Yellow
    Write-Host "  run.sh 내용: ssh -i `"$SSH_KEY`" $SSH_TARGET 'cat $REMOTE_PATH/TestRun/run.sh'" -ForegroundColor Gray
    Write-Host "  pm2 상태: ssh -i `"$SSH_KEY`" $SSH_TARGET 'pm2 list'" -ForegroundColor Gray
    exit 1
}

Write-Host "`n✓ 애플리케이션 실행 완료" -ForegroundColor Green

# pm2 프로세스 확인
Write-Host "`npm2 프로세스 상태:" -ForegroundColor Cyan
ssh -i "$SSH_KEY" "$SSH_TARGET" "pm2 list"

# ==============================
Write-Host "`n====================================="
Write-Host "배포 및 실행 완료!" -ForegroundColor Green
Write-Host "====================================="
Write-Host "배포된 경로: $REMOTE_PATH" -ForegroundColor Cyan
Write-Host "서버: $SERVER_IP" -ForegroundColor Cyan

pause