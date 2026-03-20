import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';

import { decodeBlob } from './decodeBlob.ts';
import type { TreeNode } from './readParameterTree.ts';
import type { ZmesParameter } from './types.ts';

/**
 * Data type values from RecordParameterTypes.ParameterDataType.
 * Determines which column in RecordParameterData holds the actual value.
 */
const DATA_TYPE_NONE = 0;
const DATA_TYPE_INT32_SINGLE = 1;
const DATA_TYPE_INT32 = 2;
const DATA_TYPE_DOUBLE = 4;
const DATA_TYPE_SINGLE = 5;
const DATA_TYPE_BOOLEAN = 6;
const DATA_TYPE_INT64_SINGLE = 7;
const DATA_TYPE_INT64 = 9;
const DATA_TYPE_GUID = 16;
const DATA_TYPE_TEXT = 17;
const DATA_TYPE_DICTIONARY_KEYS = 32;
const DATA_TYPE_DICTIONARY = 36;
const DATA_TYPE_GUID_LIST = 42;
const DATA_TYPE_DATE_TIME = 48;
const DATA_TYPE_DURATION = 50;
const DATA_TYPE_BLOB_ARRAY = 70;

/** Raw data row from RecordParameterData. */
interface RawDataRow {
  parameterTreeNodeId: number;
  parameterTypeId: number;
  dataBlob: Uint8Array | null;
  dataBoolean: number | null;
  dataDouble: number | null;
  dataInt32: number | null;
  dataInt64: number | null;
  dataSingle: number | null;
  dataText: string | null;
}

/**
 * Read all parameter data for a record and convert the tree into
 * the output ZmesParameter format.
 * @param database - Opened SQLite database handle
 * @param sqlite3 - SQLite3 runtime (needed for SQLITE_BLOB constant)
 * @param recordId - The record id to read data for
 * @param rootNode - The root of the parameter tree
 * @returns The root ZmesParameter with values attached
 */
export function readParameterData(
  database: Database,
  sqlite3: Sqlite3Static,
  recordId: number,
  rootNode: TreeNode,
): ZmesParameter {
  // Load all data for this record, indexed by tree node id
  const dataByNodeId = loadDataMap(database, sqlite3, recordId);

  // Recursively convert tree nodes to output format
  return convertNode(rootNode, dataByNodeId);
}

/**
 * Load all RecordParameterData rows for a record into a Map
 * keyed by ParameterTreeNodeId. Each tree node may have multiple
 * data rows (e.g. when there are multiple peaks), so the map
 * stores an array of rows per node, ordered by the Index column.
 * @param database - Opened SQLite database handle
 * @param sqlite3 - SQLite3 runtime
 * @param recordId - The record id
 * @returns Map of tree node id to array of raw data rows
 */
function loadDataMap(
  database: Database,
  sqlite3: Sqlite3Static,
  recordId: number,
): Map<number, RawDataRow[]> {
  const rows = database.selectObjects(
    `
    SELECT
      ParameterTreeNodeId AS parameterTreeNodeId,
      ParameterTypeId     AS parameterTypeId,
      "Index"             AS dataIndex,
      Data_Boolean        AS dataBoolean,
      Data_Double         AS dataDouble,
      Data_Int32          AS dataInt32,
      Data_Int64          AS dataInt64,
      Data_Single         AS dataSingle,
      Data_Text           AS dataText
    FROM RecordParameterData
    WHERE RecordId = ?
    ORDER BY "Index"
  `,
    [recordId],
  );

  // Also load blobs separately since they need special retrieval
  const blobRows = database.selectObjects(
    `
    SELECT
      ParameterTreeNodeId AS parameterTreeNodeId,
      "Index"             AS dataIndex,
      Data_Blob           AS dataBlob
    FROM RecordParameterData
    WHERE RecordId = ? AND Data_Blob IS NOT NULL
    ORDER BY "Index"
  `,
    [recordId],
  );

  const blobMap = new Map<string, Uint8Array>();
  for (const blobRow of blobRows) {
    const nodeId = blobRow.parameterTreeNodeId as number;
    const dataIndex = blobRow.dataIndex as number;
    blobMap.set(
      `${nodeId}:${dataIndex}`,
      blobRow.dataBlob as unknown as Uint8Array,
    );
  }

  const dataMap = new Map<number, RawDataRow[]>();
  for (const row of rows) {
    const raw = row as unknown as Omit<RawDataRow, 'dataBlob'> & {
      dataIndex: number;
    };
    const entry: RawDataRow = {
      parameterTreeNodeId: raw.parameterTreeNodeId,
      parameterTypeId: raw.parameterTypeId,
      dataBoolean: raw.dataBoolean,
      dataDouble: raw.dataDouble,
      dataInt32: raw.dataInt32,
      dataInt64: raw.dataInt64,
      dataSingle: raw.dataSingle,
      dataText: raw.dataText,
      dataBlob:
        blobMap.get(`${raw.parameterTreeNodeId}:${raw.dataIndex}`) ?? null,
    };
    const existing = dataMap.get(raw.parameterTreeNodeId);
    if (existing) {
      existing.push(entry);
    } else {
      dataMap.set(raw.parameterTreeNodeId, [entry]);
    }
  }

  return dataMap;
}

/**
 * Recursively convert a TreeNode into a ZmesParameter,
 * extracting the appropriate value from the data map.
 *
 * When a tree node has multiple data rows (e.g. multiple peaks),
 * each row represents a separate instance. The node is duplicated
 * once per instance, and each child picks the corresponding row
 * at the same instance index.
 * @param node - The tree node to convert
 * @param dataMap - Map of tree node id to array of raw data rows
 * @param instanceIndex - Which instance to use when this node has multiple rows (default: 0)
 * @returns The converted ZmesParameter
 */
function convertNode(
  node: TreeNode,
  dataMap: Map<number, RawDataRow[]>,
  instanceIndex = 0,
): ZmesParameter {
  const parameter: ZmesParameter = {
    name: node.parameterType.friendlyName ?? '',
    urn: node.parameterType.urn ?? '',
  };

  const dataRows = dataMap.get(node.id);
  const dataRow = dataRows?.[instanceIndex];

  // Extract value from the data row based on the parameter's data type
  if (dataRow) {
    const value = extractValue(node.parameterType.dataType, dataRow);
    if (value !== undefined) {
      parameter.value = value;
    }
  }

  // Recursively convert children
  if (node.children.length > 0) {
    const currentInstanceCount = dataRows?.length ?? 1;
    parameter.children = [];

    for (const child of node.children) {
      const childRows = dataMap.get(child.id);
      const childInstanceCount = childRows?.length ?? 1;

      if (childInstanceCount > 1 && currentInstanceCount <= 1) {
        // This child has multiple instances (e.g. multiple peaks)
        // but the current node does not — expand the child into
        // one copy per instance, each with its own subtree.
        for (let i = 0; i < childInstanceCount; i++) {
          parameter.children.push(convertNode(child, dataMap, i));
        }
      } else {
        // Either single instance, or we're already inside a
        // multi-instance subtree — propagate the instance index.
        parameter.children.push(convertNode(child, dataMap, instanceIndex));
      }
    }
  }

  return parameter;
}

/**
 * Extract the typed value from a raw data row based on the parameter data type.
 *
 * Note: SQLite stores both Data_Single and Data_Double as its native REAL type,
 * so the WASM layer may return the value in either column. We use a fallback
 * approach for numeric types to handle this.
 * @param dataType - The ParameterDataType enum value
 * @param row - The raw data row
 * @returns The extracted value, or undefined if no value is present
 */
function extractValue(
  dataType: number,
  row: RawDataRow,
): boolean | number | string | Float64Array | undefined {
  switch (dataType) {
    case DATA_TYPE_NONE:
    case DATA_TYPE_DICTIONARY:
      return undefined;

    case DATA_TYPE_INT32_SINGLE:
    case DATA_TYPE_INT32:
      return row.dataInt32 ?? undefined;

    case DATA_TYPE_DOUBLE:
    case DATA_TYPE_SINGLE:
    case DATA_TYPE_DURATION:
      return row.dataDouble ?? row.dataSingle ?? undefined;

    case DATA_TYPE_BOOLEAN:
      return row.dataBoolean !== null ? row.dataBoolean !== 0 : undefined;

    case DATA_TYPE_INT64_SINGLE:
      return row.dataInt64 ?? row.dataInt32 ?? undefined;

    case DATA_TYPE_INT64:
      return row.dataInt64 ?? undefined;

    case DATA_TYPE_GUID:
    case DATA_TYPE_TEXT:
    case DATA_TYPE_DICTIONARY_KEYS:
    case DATA_TYPE_GUID_LIST:
    case DATA_TYPE_DATE_TIME:
      return row.dataText ?? undefined;

    case DATA_TYPE_BLOB_ARRAY:
      if (row.dataBlob) {
        return decodeBlob(row.dataBlob);
      }
      return undefined;

    default:
      return undefined;
  }
}
