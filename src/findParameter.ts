import type { ZmesParameter } from './types.ts';

/**
 * Find a parameter by name in a flat list of children (direct children only).
 * @param children - List of parameters to search
 * @param name - Name to search for
 * @returns The matching parameter, or undefined if not found
 */
export function findParameter(
  children: ZmesParameter[],
  name: string,
): ZmesParameter | undefined {
  return children.find((child) => child.name === name);
}

/**
 * Recursively search for a parameter by name in the parameter tree.
 * @param parameter - Root parameter node to search from
 * @param name - Name to search for
 * @returns The matching parameter, or undefined if not found
 */
export function findParameterDeep(
  parameter: ZmesParameter,
  name: string,
): ZmesParameter | undefined {
  if (parameter.name === name) {
    return parameter;
  }
  if (parameter.children) {
    for (const child of parameter.children) {
      const found = findParameterDeep(child, name);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}
