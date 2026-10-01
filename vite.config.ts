import { defineConfig } from 'vite-plus';
import { fileURLToPath } from 'node:url';
import { banner } from './scripts/userscript-banner.ts';

export default defineConfig({
  build: {
    target: ['chrome110', 'firefox115'],
    lib: {
      entry: fileURLToPath(new URL('./src/userscript.ts', import.meta.url)),
      name: 'SKKBrowserIME',
      formats: ['iife'],
      fileName: () => 'skk-ime.user.js',
    },
    minify: false,
    sourcemap: false,
    rolldownOptions: { output: { banner } },
  },
  test: { include: ['test/*.test.ts'], environment: 'node', restoreMocks: true },
  lint: {
    ignorePatterns: ['dist/**', 'test-results/**', 'test/editors/**/profiles/**'],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: [
      'dist/**',
      'test-results/**',
      'test/editors/**/profiles/**',
      'src/kana-table.ts',
    ],
    singleQuote: true,
  },
});
