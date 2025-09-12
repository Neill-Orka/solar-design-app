// vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // Define global constant replacements to handle process.env
    define: {
      'process.env': env,
    },
    // Optional: Match CRA's default build output directory
    build: {
      outDir: 'build',
    },
    server: {
      // Optional: Open the browser on server start
      open: true,
      // Optional: Configure proxy for your backend API
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        }
      }
    }
  };
});