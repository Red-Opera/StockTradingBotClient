import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const devApiTarget = env.VITE_API_TARGET || 'http://localhost:4500'

    return {
        plugins: [react()],
        server: {
            // 로컬에서 npm run dev 실행 시
            port: 3000,
            strictPort: true,
            proxy: {
                '/stream': {
                    target: devApiTarget,
                    changeOrigin: true,
                }
            }
        },
        preview: {
            // 서버에서 npm run preview 실행 시 (Spring Boot와 같은 서버)
            port: 3000,
            strictPort: true,
            proxy: {
                '/stream': {
                    target: 'http://localhost:4500',
                    changeOrigin: true,
                }
            }
        }
    }
})
