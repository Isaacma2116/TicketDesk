import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // Permite usar una caché separada al lanzar varias instancias a la vez.
    cacheDir: env.VITE_CACHE_DIR || 'node_modules/.vite',
    server: {
      port: 5173,
      // El frontend llama a /api y Vite lo reenvía al backend. Así navegador,
      // frontend y API comparten origen y la cookie SameSite=Strict funciona.
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
          changeOrigin: false,
        },
      },
    },
  };
});
