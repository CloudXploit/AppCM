import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    '@cm-diagnostics/core',
    '@cm-diagnostics/diagnostics',
    '@cm-diagnostics/advanced-diagnostics',
    '@cm-diagnostics/logger'
  ],
  noExternal: [
    'd3',
    'chart.js',
    '@observablehq/plot',
    'rxjs',
    'zod',
    'semver',
    'uuid',
    'node-cron'
  ]
});