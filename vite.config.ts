import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './src/manifest.json' assert { type: 'json' };

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      include: '**/*.{jsx,tsx}',
    }),
    crx({ manifest }),
  ],
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
    outDir: 'dist',
    sourcemap: mode === 'development',
    rollupOptions: {
      input: {
        // Entry points are handled by @crxjs/vite-plugin
      },
      output: {
        manualChunks: undefined,
      },
    },
    // Exclude test files from build
    minify: mode === 'production',
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', 'd3'],
  },
  server: {
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3001,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
      ],
    },
  },
}));
