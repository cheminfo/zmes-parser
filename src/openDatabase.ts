import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

import { sqlite3WasmGzBase64 } from './sqlite3WasmGzBase64.ts';

/**
 * Decode a base64-encoded gzip-compressed buffer using the native
 * DecompressionStream API (available in Node.js 18+ and modern browsers).
 * @param base64 - Base64-encoded gzip data
 * @returns The decompressed ArrayBuffer
 */
async function decompressBase64Gzip(base64: string): Promise<ArrayBuffer> {
  const compressed = Uint8Array.from(
    atob(base64),
    (character) => character.codePointAt(0) as number,
  );
  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/** Lazily decompress the embedded wasm (once). */
let wasmBinaryPromise: Promise<ArrayBuffer> | undefined;
function getWasmBinary(): Promise<ArrayBuffer> {
  wasmBinaryPromise ??= decompressBase64Gzip(sqlite3WasmGzBase64);
  return wasmBinaryPromise;
}

/** Result of opening a .zmes database. */
export interface OpenDatabaseResult {
  /** The opened SQLite database handle */
  database: Database;
  /** The sqlite3 runtime instance (needed for constants and cleanup) */
  sqlite3: Sqlite3Static;
}

/**
 * Initialize the SQLite WASM runtime and deserialize an ArrayBuffer
 * into an in-memory SQLite database.
 * @param data - Raw bytes of a .zmes file (SQLite3 database)
 * @returns The opened database handle and sqlite3 runtime
 */
export async function openDatabase(
  data: ArrayBuffer,
): Promise<OpenDatabaseResult> {
  const wasmBinary = await getWasmBinary();
  // @ts-expect-error wasmBinary is a valid Emscripten option not exposed in the type declarations
  const sqlite3 = await sqlite3InitModule({ wasmBinary });
  const uint8 = new Uint8Array(data);

  const database = new sqlite3.oo1.DB();
  if (database.pointer === undefined) {
    throw new Error('Failed to create SQLite database handle');
  }
  const dataPointer = sqlite3.wasm.allocFromTypedArray(uint8);
  const resultCode = sqlite3.capi.sqlite3_deserialize(
    database.pointer,
    'main',
    dataPointer,
    uint8.byteLength,
    uint8.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
      sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
  );
  database.checkRc(resultCode);

  return { database, sqlite3 };
}
