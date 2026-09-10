import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // 部署站点: DEPLOY_TARGET=biz 时以域名根目录(biz.ibanbu.com)部署,资源用根相对路径;
  // 默认(www.ibanbu.com/OneBiz)与本地开发(/1B)行为保持不变
  const isBiz = process.env.DEPLOY_TARGET === 'biz';
  const base = isBiz ? '/' : mode === 'production' ? '/OneBiz/' : '/1B/';
  const outDir = isBiz ? 'dist-biz' : 'dist-www';
  return {
    base,
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      port: 5173,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      outDir,
      rollupOptions: {
        input: {
          main: 'index.html',
          presales: 'presales.html',
        },
      },
    },
  };
});
