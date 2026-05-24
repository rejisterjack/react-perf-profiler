import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'React Perf Profiler',
    version: '1.0.0',
    description: 'Chrome DevTools extension for profiling React component performance',
    permissions: ['activeTab', 'scripting', 'storage', 'alarms'],
    host_permissions: ['<all_urls>'],
  },
  vite: () => ({
    resolve: {
      alias: {
        '@': '.',
      },
    },
    plugins: [tailwindcss()],
  }),
});
