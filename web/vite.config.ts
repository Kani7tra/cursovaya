import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// В режиме разработки запросы /api перенаправляются на сервер (порт 5000)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:5000' },
  },
});
