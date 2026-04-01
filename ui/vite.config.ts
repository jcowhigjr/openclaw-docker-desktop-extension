import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'build'
  },
  server: {
    port: 3000,
    strictPort: true
  }
});
