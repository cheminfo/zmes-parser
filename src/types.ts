/**
 * A parameter node in the hierarchical measurement tree.
 * Leaf nodes have a `value`; branch nodes have `children`.
 */
export interface ZmesParameter {
  /** Friendly name from RecordParameterTypes (e.g. "Temperature") */
  name: string;
  /** Uniform Resource Name identifier (e.g. "urn:Com.Malvern.RecordParameter:...") */
  urn: string;
  /** Scalar value or typed array for blob data */
  value?: boolean | number | string | Float64Array;
  /** Child parameters forming the tree structure */
  children?: ZmesParameter[];
}

/** A single measurement record with its metadata and parameter tree. */
export interface ZmesRecord {
  /** Database row identifier */
  id: number;
  /** Unique record GUID */
  guid: string;
  /** Record group information */
  group: {
    /** Group database row identifier */
    id: number;
    /** Unique group GUID */
    guid: string;
    /** Optional group name */
    name?: string;
  };
  /** ISO 8601 timestamp when the measurement was created */
  createdDateTime: string;
  /** ISO 8601 timestamp when the measurement was last modified */
  modifiedDateTime: string;
  /** Root of the hierarchical parameter tree */
  parameters: ZmesParameter;
}

/** Parsed representation of a .zmes file. */
export interface ZmesFile {
  /** Database schema version from SchemaMeta table */
  schemaVersion: number;
  /** Key-value metadata pairs from StoreMetadata table */
  metadata: Record<string, string>;
  /** Measurement records with their parameter trees */
  records: ZmesRecord[];
}
