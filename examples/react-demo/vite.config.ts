import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // headers: {
    //   // Required for SharedArrayBuffer - temporarily disabled for debugging
    //   'Cross-Origin-Opener-Policy': 'same-origin',
    //   'Cross-Origin-Embedder-Policy': 'require-corp',
    // },
  },
  build: {
    // Ensure static assets from public folder are copied
    copyPublicDir: true,
  },
  optimizeDeps: {
    exclude: ['@computekit/core', '@computekit/react'],
  },
  assetsInclude: ['**/*.wasm'],
});
