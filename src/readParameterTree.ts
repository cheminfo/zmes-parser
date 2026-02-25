import type { Database } from '@sqlite.org/sqlite-wasm';

/** A parameter type definition from RecordParameterTypes. */
export interface ParameterType {
  /** Database row identifier */
  id: number;
  /** Unique GUID */
  guid: string;
  /** Uniform Resource Name */
  urn: string;
  /** Human-readable name */
  friendlyName: string;
  /** Data type enum value */
  dataType: number;
  /** Optional description */
  description: string | null;
  /** Optional units URN */
  dataUnitsUrn: string | null;
}

/** A tree node from RecordParameterTreeNodes. */
export interface TreeNode {
  /** Database row identifier */
  id: number;
  /** Foreign key to RecordParameterTypes */
  parameterTypeId: number;
  /** Foreign key to parent tree node (null for root) */
  parentNodeId: number | null;
  /** Ordering among siblings */
  siblingIndex: number;
  /** The resolved parameter type for this node */
  parameterType: ParameterType;
  /** Child nodes, populated during tree building */
  children: TreeNode[];
}

/**
 * Load all parameter types from RecordParameterTypes into a Map.
 * @param database - Opened SQLite database handle
 * @returns Map of type id to ParameterType
 */
function loadParameterTypes(database: Database): Map<number, ParameterType> {
  const rows = database.selectObjects(`
    SELECT
      Id                AS id,
      Guid              AS guid,
      UniformResourceName AS urn,
      FriendlyName      AS friendlyName,
      ParameterDataType AS dataType,
      Description       AS description,
      DataUnitsUrn      AS dataUnitsUrn
    FROM RecordParameterTypes
  `);

  const types = new Map<number, ParameterType>();
  for (const row of rows) {
    const parameterType = row as unknown as ParameterType;
    types.set(parameterType.id, parameterType);
  }
  return types;
}

/**
 * Build the hierarchical parameter tree for a given root parameter type.
 *
 * Queries all tree nodes that share the given root type, resolves their
 * parameter types, and assembles them into a tree structure.
 * @param database - Opened SQLite database handle
 * @param rootParameterTypeId - The root parameter type id for the record
 * @returns The root TreeNode with all children populated
 */
export function buildParameterTree(
  database: Database,
  rootParameterTypeId: number,
): TreeNode {
  const parameterTypes = loadParameterTypes(database);

  const rows = database.selectObjects(
    `
    SELECT
      Id              AS id,
      ParameterTypeId AS parameterTypeId,
      ParentNodeId    AS parentNodeId,
      SiblingIndex    AS siblingIndex
    FROM RecordParameterTreeNodes
    WHERE RootParameterTypeId = ?
    ORDER BY SiblingIndex
  `,
    [rootParameterTypeId],
  );

  // Index all nodes by id
  const nodeMap = new Map<number, TreeNode>();
  for (const row of rows) {
    const rawNode = row as unknown as {
      id: number;
      parameterTypeId: number;
      parentNodeId: number | null;
      siblingIndex: number;
    };
    const parameterType = parameterTypes.get(rawNode.parameterTypeId);
    if (!parameterType) {
      throw new Error(
        `Unknown parameter type id ${rawNode.parameterTypeId} for tree node ${rawNode.id}`,
      );
    }
    nodeMap.set(rawNode.id, {
      ...rawNode,
      parameterType,
      children: [],
    });
  }

  // Assemble tree by linking children to parents
  let root: TreeNode | undefined;
  for (const node of nodeMap.values()) {
    if (node.parentNodeId === null) {
      root = node;
    } else {
      const parent = nodeMap.get(node.parentNodeId);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  if (!root) {
    throw new Error(
      `No root tree node found for RootParameterTypeId ${rootParameterTypeId}`,
    );
  }

  // Sort children by sibling index at each level
  sortChildren(root);

  return root;
}

/**
 * Recursively sort children of each tree node by sibling index.
 * @param node - The tree node whose children to sort
 */
function sortChildren(node: TreeNode): void {
  node.children = node.children.toSorted(
    (a, b) => a.siblingIndex - b.siblingIndex,
  );
  for (const child of node.children) {
    sortChildren(child);
  }
}
