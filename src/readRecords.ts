import type { Database } from '@sqlite.org/sqlite-wasm';

/** Raw record row from StandardRecords joined with StandardRecordGroups. */
export interface RawRecord {
  /** Record database row identifier */
  id: number;
  /** Unique record GUID */
  guid: string;
  /** ISO 8601 creation timestamp */
  createdDateTime: string;
  /** ISO 8601 modification timestamp */
  modifiedDateTime: string;
  /** Root parameter type id (links to RecordParameterTypes) */
  rootParameterTypeId: number;
  /** Group database row identifier */
  groupId: number;
  /** Unique group GUID */
  groupGuid: string;
  /** Optional group name */
  groupName: string | null;
}

/**
 * Query all measurement records with their group information.
 * @param database - Opened SQLite database handle
 * @returns Array of raw record rows
 */
export function readRecords(database: Database): RawRecord[] {
  const rows = database.selectObjects(`
    SELECT
      r.Id           AS id,
      r.Guid         AS guid,
      r.CreatedDateTime   AS createdDateTime,
      r.ModifiedDateTime  AS modifiedDateTime,
      r.RootParameterTypeId AS rootParameterTypeId,
      g.Id           AS groupId,
      g.Guid         AS groupGuid,
      g.GivenName    AS groupName
    FROM StandardRecords r
    JOIN StandardRecordGroups g ON r.GroupId = g.Id
    ORDER BY r.Id
  `);

  return rows as unknown as RawRecord[];
}
