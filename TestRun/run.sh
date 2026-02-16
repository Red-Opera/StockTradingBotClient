#!/bin/bash
APP_NAME="trader-client"
APP_DIR=~/Trader/WebTestClient
PORT=3000

echo "====================================="
echo "애플리케이션 실행을 시작합니다."
echo "====================================="

# 환경 변수 로드 (Node/NVM 경로 확보)
export PATH=$PATH:/usr/local/bin:$HOME/.npm-global/bin:/usr/bin:/bin
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh" # nvm 로드 방식 개선

# 애플리케이션 디렉토리 이동
cd "$APP_DIR" || { echo "ERROR: 디렉토리를 찾을 수 없습니다."; exit 1; }

echo "Node.js 버전: $(node -v)"
echo "npm 버전: $(npm -v)"

# 의존성 설치 (빌드를 위해 전체 설치 필요)
echo "의존성 설치 중 (빌드 도구 포함)..."
npm install  # <--- [수정됨] --omit=dev를 제거하여 tsc, vite를 설치합니다.
if [ $? -ne 0 ]; then
    echo "ERROR: 의존성 설치 실패"
    exit 1
fi

# 프로젝트 빌드 (TypeScript + Vite)
echo "프로젝트 빌드 중..."
# 만약 npx가 tsc를 못 찾으면 ./node_modules/.bin/tsc 로 직접 지정할 수도 있습니다.
npx tsc -b && npx vite build
if [ $? -ne 0 ]; then
    echo "ERROR: 빌드 실패"
    exit 1
fi

# 기존 PM2 프로세스 종료 및 정리 (불필요한 에러 방지)
echo "기존 프로세스 정리"
pm2 delete "$APP_NAME" 2>/dev/null

# PM2로 preview 서버 실행
echo "Preview 서버 실행 (포트: $PORT)"
# Vite의 preview 모드는 빌드된 'dist' 폴더를 서빙합니다.
pm2 start npm --name "$APP_NAME" -- run preview -- --host 0.0.0.0 --port "$PORT"

if [ $? -ne 0 ]; then
    echo "ERROR: PM2 실행 실패"
    exit 1
fi

# PM2 상태 저장 (재부팅 시 자동 시작용)
pm2 save

echo "====================================="
echo "애플리케이션이 정상적으로 실행되었습니다."
echo "====================================="
pm2 list