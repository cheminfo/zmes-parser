import { expect, test } from 'vitest';

import { decodeBlob } from '../decodeBlob.ts';

test('decode empty blob returns empty Float64Array', () => {
  const result = decodeBlob(new Uint8Array(0));

  expect(result).toBeInstanceOf(Float64Array);
  expect(result).toHaveLength(0);
});

test('decode blob with no marker returns empty Float64Array', () => {
  const result = decodeBlob(new Uint8Array([0x00, 0x01, 0x02, 0x03]));

  expect(result).toBeInstanceOf(Float64Array);
  expect(result).toHaveLength(0);
});

test('decode a minimal single-entry blob', () => {
  // Construct a minimal blob with one entry:
  // Some padding + marker (6 bytes) + double (8 bytes)
  const marker = [0x06, 0x01, 0x01, 0x01, 0x02, 0x01];

  // IEEE 754 double for 42.5 in little-endian
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, 42.5, true);
  const doubleBytes = Array.from(new Uint8Array(buffer));

  const blob = new Uint8Array([...marker, ...doubleBytes]);
  const result = decodeBlob(blob);

  expect(result).toBeInstanceOf(Float64Array);
  expect(result).toHaveLength(1);
  expect(result[0]).toBe(42.5);
});

test('decode a blob with multiple entries', () => {
  const marker = [0x06, 0x01, 0x01, 0x01, 0x02, 0x01];
  const values = [1, 2.5, 100.75];
  const bytes: number[] = [];

  for (const value of values) {
    bytes.push(...marker);
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, true);
    bytes.push(...new Uint8Array(buffer));
  }

  // Add some header padding before the first marker
  const header = new Array(10).fill(0);
  const blob = new Uint8Array([...header, ...bytes]);

  const result = decodeBlob(blob);

  expect(result).toBeInstanceOf(Float64Array);
  expect(result).toHaveLength(3);
  expect(result[0]).toBe(1);
  expect(result[1]).toBe(2.5);
  expect(result[2]).toBe(100.75);
});
