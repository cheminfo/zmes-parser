import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import type { ZmesFile, ZmesParameter } from '../index.ts';
import { parse } from '../index.ts';

const testFilePath = join(import.meta.dirname, 'data/test.zmes');

/**
 * Load and parse the test .zmes file.
 * @returns Parsed ZmesFile result
 */
async function loadTestFile(): Promise<ZmesFile> {
  const fileBuffer = readFileSync(testFilePath);
  const arrayBuffer = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength,
  );
  return parse(arrayBuffer);
}

/**
 * Find a parameter by name in a flat list of children.
 * @param children - List of parameters to search
 * @param name - Name to search for
 * @returns The matching parameter, or undefined
 */
function findParameter(
  children: ZmesParameter[],
  name: string,
): ZmesParameter | undefined {
  return children.find((child) => child.name === name);
}

/**
 * Recursively search for a parameter by name in the tree.
 * @param parameter - Root parameter to search from
 * @param name - Name to search for
 * @returns The matching parameter, or undefined
 */
function findParameterDeep(
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

test('parse test.zmes file', async () => {
  const result = await loadTestFile();

  expect(result.schemaVersion).toBe(3);
  expect(result.metadata).toStrictEqual({});
  expect(result.records).toHaveLength(1);

  const record = result.records[0];

  expect(record).toBeDefined();
  expect(record?.id).toBe(1);
  expect(record?.guid).toBe('1c90a5c0-581d-4df8-92e7-b731c635e614');
  expect(record?.createdDateTime).toBe('2026-02-20 13:18:16.4711904');
  expect(record?.group.id).toBe(1);
  expect(record?.group.guid).toBe('f14ead7b-bca1-4581-a763-72b98f774ab8');
});

test('root parameter has expected top-level children', async () => {
  const result = await loadTestFile();
  const parameters = result.records[0]?.parameters;

  expect(parameters).toBeDefined();

  expect(parameters?.name).toBe('Size Measurement Result');
  expect(parameters?.children).toBeDefined();
  expect(parameters?.children).toHaveLength(24);

  const childNames = parameters?.children?.map((child) => child.name) ?? [];

  expect(childNames).toContain('Operator Name');
  expect(childNames).toContain('Software Version');
  expect(childNames).toContain('Quality Indicator');
  expect(childNames).toContain('Result State');
  expect(childNames).toContain('Actual Instrument Settings');
  expect(childNames).toContain('Sample Settings');
});

test('scalar parameter values are correctly extracted', async () => {
  const result = await loadTestFile();
  const children = result.records[0]?.parameters.children ?? [];

  // Text values
  expect(findParameter(children, 'Operator Name')?.value).toBe('gbf-network');
  expect(findParameter(children, 'Software Version')?.value).toBe('4.1.0.82');
  expect(findParameter(children, 'Quality Indicator')?.value).toBe('GoodData');
  expect(findParameter(children, 'Result State')?.value).toBe('Completed');

  // DateTime values
  expect(
    findParameter(children, 'Measurement Start Date And Time')?.value,
  ).toBe('2026-02-20T13:18:16.7108229Z');

  // Int64 values
  expect(findParameter(children, 'Repeat')?.value).toBe(1);
  expect(findParameter(children, 'Number Of Repeats')?.value).toBe(3);
});

test('actual instrument settings are extracted', async () => {
  const result = await loadTestFile();
  const parameters = result.records[0]?.parameters;

  expect(parameters).toBeDefined();

  // Attenuator (Int32, dataType=1) — nested inside Actual Instrument Settings
  const attenuator = findParameterDeep(
    parameters as ZmesParameter,
    'Attenuator',
  );

  expect(attenuator?.value).toBe(6);

  // Number Of Runs (Int64, dataType=9)
  const numberOfRuns = findParameterDeep(
    parameters as ZmesParameter,
    'Number Of Runs',
  );

  expect(numberOfRuns?.value).toBe(20);
});

test('sample settings contain sample name', async () => {
  const result = await loadTestFile();
  const children = result.records[0]?.parameters.children ?? [];
  const sampleSettings = findParameter(children, 'Sample Settings');

  expect(sampleSettings).toBeDefined();

  const sampleName = findParameterDeep(
    sampleSettings as ZmesParameter,
    'Sample Name',
  );

  expect(sampleName?.value).toBe('SICPA-DNA FN230.A iPr');
});

test('blob arrays are decoded correctly (Sizes distribution)', async () => {
  const result = await loadTestFile();
  const parameters = result.records[0]?.parameters;

  expect(parameters).toBeDefined();

  const sizes = findParameterDeep(parameters as ZmesParameter, 'Sizes');

  expect(sizes).toBeDefined();
  expect(sizes?.value).toBeInstanceOf(Float64Array);

  const sizesArray = sizes?.value as Float64Array;

  expect(sizesArray).toHaveLength(70);
  expect(sizesArray[0]).toBeCloseTo(0.3, 5);
  expect(sizesArray[69]).toBeCloseTo(10000, 0);
});

test('full parsed result snapshot', async () => {
  const result = await loadTestFile();
  const serializable = toSerializable(result);

  expect(serializable).toMatchSnapshot();
});

/**
 * Recursively convert a parsed result into a JSON-serializable object
 * by replacing Float64Array instances with plain number arrays.
 * @param value - Any value from the parsed result
 * @returns A JSON-serializable copy
 */
function toSerializable(value: unknown): unknown {
  if (value instanceof Float64Array) {
    return Array.from(value);
  }
  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = toSerializable(val);
    }
    return result;
  }
  return value;
}
