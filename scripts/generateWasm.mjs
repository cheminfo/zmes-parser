import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const wasm = readFileSync(
  'node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm',
);
const compressed = gzipSync(wasm);
const base64 = compressed.toString('base64');

writeFileSync(
  'src/sqlite3WasmGzBase64.ts',
  `// Auto-generated — do not edit. Regenerate with: npm run generate-wasm\nexport const sqlite3WasmGzBase64 =\n  "${base64}";\n`,
);

// eslint-disable-next-line no-console
console.log(
  `Generated sqlite3WasmGzBase64.ts (${(wasm.length / 1024).toFixed(0)} KB wasm → ${(base64.length / 1024).toFixed(0)} KB gzip+base64)`,
);
