import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { MeasurementXY } from 'cheminfo-types';
import { expect, test } from 'vitest';

import { parse, toMeasurementXY } from '../index.ts';

const testFilePath = join(import.meta.dirname, 'data/test.zmes');

/**
 * Load, parse, and convert the test .zmes file.
 * @returns Array of MeasurementXY from the test file
 */
async function loadMeasurements(): Promise<Array<MeasurementXY<Float64Array>>> {
  const buffer = await readFile(testFilePath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  const zmesFile = await parse(arrayBuffer);
  return toMeasurementXY(zmesFile);
}

test('one record produces one MeasurementXY', async () => {
  const measurements = await loadMeasurements();

  expect(measurements).toHaveLength(1);
  expect(measurements[0]?.dataType).toBe('Size measurement');
});

test('x variable contains Sizes data', async () => {
  const measurements = await loadMeasurements();
  const measurement = measurements[0];

  expect(measurement).toBeDefined();
  expect(measurement?.variables.x.data).toBeInstanceOf(Float64Array);
  expect(measurement?.variables.x.data).toHaveLength(70);
  expect(measurement?.variables.x.label).toBe('Particle diameter');
  expect(measurement?.variables.x.units).toBe('nm');
  expect(measurement?.variables.x.isDependent).toBe(false);
  expect(measurement?.variables.x.data[0]).toBeCloseTo(0.3, 5);
  expect(measurement?.variables.x.data[69]).toBeCloseTo(10000, 0);
});

test('y variable contains intensity distribution', async () => {
  const measurements = await loadMeasurements();
  const measurement = measurements[0];

  expect(measurement).toBeDefined();
  expect(measurement?.variables.y.data).toBeInstanceOf(Float64Array);
  expect(measurement?.variables.y.data).toHaveLength(70);
  expect(measurement?.variables.y.label).toBe('Intensity');
  expect(measurement?.variables.y.units).toBe('%');
  expect(measurement?.variables.y.isDependent).toBe(true);
});

test('additional variables are present (volume, number, etc.)', async () => {
  const measurements = await loadMeasurements();
  const measurement = measurements[0];

  expect(measurement).toBeDefined();

  // a = volume distribution
  expect(measurement?.variables.a).toBeDefined();
  expect(measurement?.variables.a?.label).toBe('Volume');
  expect(measurement?.variables.a?.units).toBe('%');
  expect(measurement?.variables.a?.data).toHaveLength(70);

  // b = number distribution
  expect(measurement?.variables.b).toBeDefined();
  expect(measurement?.variables.b?.label).toBe('Number');
  expect(measurement?.variables.b?.data).toHaveLength(70);

  // c = molecular weights
  expect(measurement?.variables.c).toBeDefined();
  expect(measurement?.variables.c?.label).toBe('Molecular weight');
  expect(measurement?.variables.c?.data).toHaveLength(70);

  // d = diffusion coefficients
  expect(measurement?.variables.d).toBeDefined();
  expect(measurement?.variables.d?.label).toBe('Diffusion coefficient');
  expect(measurement?.variables.d?.data).toHaveLength(70);
});

test('title is extracted from sample name', async () => {
  const measurements = await loadMeasurements();

  expect(measurements[0]?.title).toBe('SICPA-DNA FN230.A iPr');
});

test('record GUID is used as id', async () => {
  const measurements = await loadMeasurements();

  expect(measurements[0]?.id).toBe('1c90a5c0-581d-4df8-92e7-b731c635e614');
});

test('meta contains measurement metadata', async () => {
  const measurements = await loadMeasurements();
  const meta = measurements[0]?.meta;

  expect(meta?.operatorName).toBe('gbf-network');
  expect(meta?.measurementStartDateTime).toBe('2026-02-20T13:18:16.7108229Z');
  expect(meta?.qualityIndicator).toBe('GoodData');
  expect(meta?.resultState).toBe('Completed');
  expect(meta?.repeat).toBe(1);
  expect(meta?.numberOfRepeats).toBe(3);
});

test('meta contains cumulants results', async () => {
  const measurements = await loadMeasurements();
  const meta = measurements[0]?.meta;

  expect(meta?.zAverage).toBeCloseTo(363.255, 2);
  expect(meta?.polydispersityIndex).toBeCloseTo(0.2039, 3);
});

test('meta contains dispersant and material info', async () => {
  const measurements = await loadMeasurements();
  const meta = measurements[0]?.meta;

  expect(meta?.dispersantViscosity).toBeCloseTo(2.32, 1);
  expect(meta?.dispersantRI).toBeCloseTo(1.39, 1);
  expect(meta?.materialRI).toBeCloseTo(1.7, 1);
  expect(meta?.materialAbsorption).toBeCloseTo(0.01, 2);
});

test('settings contain instrument info', async () => {
  const measurements = await loadMeasurements();
  const settings = measurements[0]?.settings;

  expect(settings?.instrument).toStrictEqual({
    manufacturer: 'Malvern Panalytical',
    model: 'Zetasizer',
    serialNumber: '100038577',
    software: {
      name: 'ZS XPLORER',
      version: '4.1.0.82',
    },
  });
});

test('settings contain actual instrument parameters', async () => {
  const measurements = await loadMeasurements();
  const settings = measurements[0]?.settings;

  expect(settings?.detectorAngle).toBe(173);
  expect(settings?.numberOfRuns).toBe(20);
  expect(settings?.attenuator).toBe(6);
  expect(settings?.laserWavelength).toBe(632.8);
  expect((settings?.temperature as number) ?? 0).toBeCloseTo(25.01, 1);
});
