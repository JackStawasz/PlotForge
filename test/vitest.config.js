import { defineConfig } from 'vitest/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Project root is two levels up: tests/js_tests/ → tests/ → project root
    root: resolve(__dirname, '..'),
  },
});