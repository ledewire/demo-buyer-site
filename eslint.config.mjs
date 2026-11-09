import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import security from 'eslint-plugin-security'

const eslintConfig = [
  { ignores: ['.next/**', 'coverage/**', 'node_modules/**', 'next-env.d.ts'] },
  ...nextVitals,
  ...nextTypescript,
  security.configs.recommended,
  {
    // eslint-config-next 16 brings eslint-plugin-react-hooks 7, whose React Compiler rules
    // flag code that passed on 15. Off until #86 adopts them.
    rules: {
      'react-hooks/error-boundaries': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-regexp': 'warn',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-expressions': 'off',
      'security/detect-object-injection': 'off',
    },
  },
  {
    // The bin/ script tests drive real git in a fresh mkdtemp sandbox: every path is
    // derived from that temp dir, never from input.
    files: ['bin/**/*.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
]

export default eslintConfig
