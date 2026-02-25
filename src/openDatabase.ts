import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

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
  const sqlite3 = await sqlite3InitModule();
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
