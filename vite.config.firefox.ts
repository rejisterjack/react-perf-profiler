import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { mkdirSync } from 'fs';

// Firefox manifest for MV2
import firefoxManifest from './src/manifest-firefox.json' assert { type: 'json' };

/**
 * Custom plugin to handle Firefox extension build without CRX plugin's MV3 enforcement.
 * Copies the manifest and handles extension-specific build steps.
 */
function firefoxExtensionPlugin(): Plugin {
  return {
    name: 'firefox-extension',
    enforce: 'post',
    apply: 'build',
    generateBundle() {
      // Emit the manifest.json to the output
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(firefoxManifest, null, 2),
      });
    },
    writeBundle(options) {
      // Ensure icons directory exists for static assets
      const outDir = options.dir || 'dist-firefox';
      try {
        mkdirSync(resolve(outDir, 'icons'), { recursive: true });
      } catch (error) {
        // Directory may already exist or there was a permission issue
        // This is non-fatal as the build will fail later if icons are truly missing
        if (error instanceof Error && !error.message.includes('EEXIST')) {
          console.warn('[firefox-extension-plugin] Warning: Could not create icons directory:', error.message);
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      include: '**/*.{jsx,tsx}',
    }),
    firefoxExtensionPlugin(),
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
    // Firefox-specific output directory (separate from Chrome's dist)
    outDir: 'dist-firefox',
    // Empty output directory before build
    emptyOutDir: true,
    sourcemap: mode === 'development',
    rollupOptions: {
      input: {
        // Firefox MV2 uses background scripts (not service workers)
        background: resolve(__dirname, 'src/background/index.ts'),
        // Content script entry point
        content: resolve(__dirname, 'src/content/index.ts'),
        // DevTools page entry
        devtools: resolve(__dirname, 'src/devtools/index.ts'),
        // Panel entry point (main.tsx, not index.tsx)
        panel: resolve(__dirname, 'src/panel/main.tsx'),
        // Popup entry
        popup: resolve(__dirname, 'src/popup/index.tsx'),
      },
      output: {
        // Disable manual chunks for extension compatibility
        manualChunks: undefined,
        // Firefox MV2 compatible output format
        entryFileNames: (chunkInfo) => {
          // Keep background.js, content.js at root for manifest reference
          if (['background', 'content'].includes(chunkInfo.name)) {
            return '[name].js';
          }
          return 'assets/[name].js';
        },
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name ?? '';
          // Keep icon paths simple for manifest reference
          if (/\.(svg|png|jpg|jpeg|gif|ico)$/.test(info)) {
            return 'icons/[name][extname]';
          }
          // HTML files at root
          if (/\.html$/.test(info)) {
            return '[name][extname]';
          }
          // CSS and other assets
          return 'assets/[name][extname]';
        },
        // Use ES modules for multiple entry points (required for code splitting)
        format: 'es',
        // Allow dynamic imports for code splitting
        inlineDynamicImports: false,
      },
    },
    minify: mode === 'production',
    // Firefox chunk size warnings
    chunkSizeWarningLimit: 1000,
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
    exclude: ['node_modules', 'dist', 'dist-firefox', 'tests/e2e'],
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
