import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './src/manifest.json' with { type: 'json' };
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      include: '**/*.{jsx,tsx}',
    }),
    crx({ manifest }),
    mode === 'analyze' && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: mode === 'test'
        ? '[local]' // Use clean class names for tests
        : mode === 'development' 
          ? '[name]__[local]___[hash:base64:5]' 
          : '[hash:base64:8]',
    },
    devSourcemap: true,
  },
  build: {
    outDir: 'dist/dist-chrome',
    sourcemap: mode === 'development',
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'src/panel/index.html'),
      },
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) {
            return;
          }
          if (id.includes('d3')) {
            return 'vendor-d3';
          }
          if (id.includes('three') || id.includes('@react-three')) {
            return 'vendor-three';
          }
          if (id.includes('@tensorflow') || id.includes('tfjs')) {
            return 'vendor-tfjs';
          }
          if (id.includes('node_modules/react-dom')) {
            return 'vendor-react-dom';
          }
          if (id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          return 'vendor';
        },
      },
    },
    // Exclude test files from build
    minify: mode === 'production',
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'd3'],
  },
}));
