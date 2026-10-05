import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Ensure container bind host, loopback, or stale ports never leak into frontend API_BASE
    'import.meta.env.VITE_API_BASE': JSON.stringify(
      process.env.VITE_API_BASE &&
      !process.env.VITE_API_BASE.includes('0.0.0.0') &&
      !process.env.VITE_API_BASE.includes('localhost') &&
      !process.env.VITE_API_BASE.includes('127.0.0.1') &&
      !process.env.VITE_API_BASE.includes('8001')
        ? process.env.VITE_API_BASE
        : ''
    ),
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
});
