import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/app/globals.css'],
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
