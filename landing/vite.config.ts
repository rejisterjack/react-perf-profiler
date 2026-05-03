import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  root: '.',
  base: '/react-perf-profiler/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode === 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-animations': ['framer-motion', 'gsap'],
        },
      },
    },
  },
  css: {
    devSourcemap: true,
  },
  server: {
    port: 4000,
    strictPort: false,
  },
}));
