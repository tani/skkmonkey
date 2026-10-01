import { defineConfig } from 'vite-plus';
import { fileURLToPath } from 'node:url';
import { banner } from './scripts/userscript-banner.ts';

export default defineConfig({
  build: {
    target: ['chrome110', 'firefox115'],
    lib: {
      entry: fileURLToPath(new URL('./target/userscript/main.js', import.meta.url)),
      name: 'SKKBrowserIME',
      formats: ['iife'],
      fileName: () => 'skk-ime.user.js',
    },
    minify: true,
    sourcemap: false,
    rolldownOptions: { output: { banner } },
  },
  lint: {
    ignorePatterns: ['dist/**', 'test-results/**', 'test/editors/**', 'target/**', 'project/**'],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: [
      'dist/**',
      'test-results/**',
      'test/editors/**/profiles/**',
      'target/**',
      'project/**',
      'src/**/*.scala',
      'build.sbt',
    ],
    singleQuote: true,
  },
});
