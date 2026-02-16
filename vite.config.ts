import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,      // 원하는 포트 번호 입력
        strictPort: true // 설정한 포트가 이미 사용 중일 때, 다른 포트로 넘어가지 않고 에러를 냅니다.
    }
})
