import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';

import { openDatabase } from './openDatabase.ts';
import { readParameterData } from './readParameterData.ts';
import { buildParameterTree } from './readParameterTree.ts';
import { readRecords } from './readRecords.ts';
import type { ZmesFile, ZmesRecord } from './types.ts';

/**
 * Parse a .zmes file (Malvern Panalytical Zetasizer measurement database)
 * and return a structured representation of all records and their parameters.
 *
 * The .zmes format is a SQLite3 database used by ZS XPLORER software for
 * exporting Dynamic Light Scattering (DLS) measurement data.
 * @param data - Raw bytes of the .zmes file as an ArrayBuffer
 * @returns Parsed file with schema version, metadata, and measurement records
 * @example
 * ```ts
 * import { readFileSync } from 'node:fs';
 * import { parse } from 'zmes-parser';
 *
 * const buffer = readFileSync('measurement.zmes');
 * const result = await parse(buffer.buffer);
 * console.log(result.records[0].parameters.name);
 * ```
 */
export async function parse(data: ArrayBuffer): Promise<ZmesFile> {
  const { database, sqlite3 } = await openDatabase(data);

  try {
    const schemaVersion = readSchemaVersion(database);
    const metadata = readStoreMetadata(database);
    const records = buildRecords(database, sqlite3);

    return { schemaVersion, metadata, records };
  } finally {
    database.close();
  }
}

/**
 * Read the schema version from the SchemaMeta table.
 * @param database - Opened SQLite database handle
 * @returns The current schema version number
 */
function readSchemaVersion(database: Database): number {
  const version = database.selectValue(
    'SELECT CurrentVersion FROM SchemaMeta LIMIT 1',
  );
  return (version as number) ?? 0;
}

/**
 * Read all key-value pairs from the StoreMetadata table.
 * @param database - Opened SQLite database handle
 * @returns Record of metadata key-value pairs
 */
function readStoreMetadata(database: Database): Record<string, string> {
  const rows = database.selectObjects('SELECT Key, Value FROM StoreMetadata');
  const metadata: Record<string, string> = {};
  for (const row of rows) {
    const key = row.Key as string;
    const value = row.Value as string;
    metadata[key] = value;
  }
  return metadata;
}

/**
 * Build all ZmesRecord objects from the database.
 * @param database - Opened SQLite database handle
 * @param sqlite3 - SQLite3 runtime
 * @returns Array of fully populated measurement records
 */
function buildRecords(
  database: Database,
  sqlite3: Sqlite3Static,
): ZmesRecord[] {
  const rawRecords = readRecords(database);
  const records: ZmesRecord[] = [];

  for (const raw of rawRecords) {
    const tree = buildParameterTree(database, raw.rootParameterTypeId);
    const parameters = readParameterData(database, sqlite3, raw.id, tree);

    records.push({
      id: raw.id,
      guid: raw.guid,
      group: {
        id: raw.groupId,
        guid: raw.groupGuid,
        ...(raw.groupName !== null ? { name: raw.groupName } : {}),
      },
      createdDateTime: raw.createdDateTime,
      modifiedDateTime: raw.modifiedDateTime,
      parameters,
    });
  }

  return records;
}
