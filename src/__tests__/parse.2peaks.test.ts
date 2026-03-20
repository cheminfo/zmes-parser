import { openAsBlob } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { findParameter, findParameterDeep } from '../findParameter.ts';
import { parse } from '../index.ts';
import type { ZmesParameter } from '../types.ts';

const twoPeaksFilePath = join(import.meta.dirname, 'data/2peaks.zmes');

/**
 * Load and parse the 2peaks .zmes file.
 * @returns Parsed result
 */
async function loadTwoPeaksFile() {
  const blob = await openAsBlob(twoPeaksFilePath);
  const arrayBuffer = await blob.arrayBuffer();
  return parse(arrayBuffer);
}

test('full parsed result snapshot', async () => {
  const result = await loadTwoPeaksFile();
  const serializable = toSerializable(result);

  expect(serializable).toMatchSnapshot();
});

test('has two intensity peaks per record', async () => {
  const result = await loadTwoPeaksFile();

  const parameters = result.records[0]?.parameters;

  expect(parameters).toBeDefined();

  const intensityPeaks = findParameterDeep(
    parameters as ZmesParameter,
    'Particle Size Intensity Distribution Peaks ordered by area',
  );

  expect(intensityPeaks).toBeDefined();
  expect(intensityPeaks?.children).toHaveLength(2);

  const children = (intensityPeaks as ZmesParameter).children ?? [];
  const peak1 = children[0];
  const peak2 = children[1];

  expect(peak1?.name).toBe('Size Peak');
  expect(peak2?.name).toBe('Size Peak');

  const peak1Mean = findParameter(peak1?.children ?? [], 'Mean');
  const peak2Mean = findParameter(peak2?.children ?? [], 'Mean');

  expect(peak1Mean?.value).toBeCloseTo(206.73, 1);
  expect(peak2Mean?.value).toBeCloseTo(0.84, 1);

  const peak1Area = findParameter(peak1?.children ?? [], 'Area');
  const peak2Area = findParameter(peak2?.children ?? [], 'Area');

  expect(peak1Area?.value).toBeCloseTo(80.18, 1);
  expect(peak2Area?.value).toBeCloseTo(19.82, 1);
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
