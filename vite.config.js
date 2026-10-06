import { defineConfig } from 'vite';

export default defineConfig({
  build: { rollupOptions: { input: { game: 'index.html', leaderboard: 'leaderboard.html' } } },
  server: {
    host: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
    allowedHosts: [
      '.trycloudflare.com'
    ]
  }
});
