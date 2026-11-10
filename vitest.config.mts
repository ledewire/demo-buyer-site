import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// jsdom costs seconds to build, and Vitest builds one per test file. Only component
// tests (`.test.tsx`) get one; route, lib and bin tests (`.test.ts`) run under node.
// A `.test.ts` that needs a DOM (a hook test) opts in with `// @vitest-environment jsdom`.
export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic' })],
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    projects: [
      {
        extends: true,
        test: { name: 'dom', environment: 'jsdom', include: ['src/**/*.test.tsx'] },
      },
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'bin/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/app/globals.css'],
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
