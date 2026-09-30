import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2022' },
  // il processor dell'AudioWorklet è un modulo ES a sé
  worker: { format: 'es' },
});
