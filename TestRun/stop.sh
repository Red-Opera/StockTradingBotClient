#!/bin/bash

APP_NAME="trader-client"

echo "====================================="
echo "애플리케이션 종료를 시작합니다."
echo "====================================="

# PM2에서 실행 중인지 확인
pm2 list | grep $APP_NAME > /dev/null

if [ $? -ne 0 ]; then
    echo "실행 중인 애플리케이션이 없습니다."
    exit 0
fi

echo "실행 중인 애플리케이션을 종료합니다."

pm2 stop $APP_NAME
pm2 delete $APP_NAME

echo "====================================="
echo "애플리케이션이 정상적으로 종료되었습니다."
echo "====================================="
