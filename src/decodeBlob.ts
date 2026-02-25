/**
 * 6-byte marker that precedes each IEEE 754 double in
 * .NET BinaryFormatter serialized System.Double[] arrays.
 */
const ENTRY_MARKER = new Uint8Array([0x06, 0x01, 0x01, 0x01, 0x02, 0x01]);

/** Total bytes per entry: 6 marker bytes + 8 bytes for the double. */
const ENTRY_SIZE = 14;

/**
 * Decode a .NET BinaryFormatter serialized `System.Double[]` blob
 * into a `Float64Array`.
 *
 * The binary format consists of a ~205-byte type metadata header
 * followed by repeating 14-byte entries (6-byte marker + 8-byte
 * little-endian IEEE 754 double).
 * @param blob - Raw blob bytes from the database
 * @returns Decoded array of double-precision values
 */
export function decodeBlob(blob: Uint8Array): Float64Array {
  const markerOffset = findMarker(blob);
  if (markerOffset === -1) {
    return new Float64Array(0);
  }

  const remainingBytes = blob.byteLength - markerOffset;
  const count = Math.floor(remainingBytes / ENTRY_SIZE);
  const result = new Float64Array(count);

  const dataView = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  for (let i = 0; i < count; i++) {
    result[i] = dataView.getFloat64(markerOffset + i * ENTRY_SIZE + 6, true);
  }

  return result;
}

/**
 * Find the byte offset of the first occurrence of ENTRY_MARKER in the blob.
 * @param blob - Raw blob bytes
 * @returns Byte offset of the marker, or -1 if not found
 */
function findMarker(blob: Uint8Array): number {
  const end = blob.byteLength - ENTRY_MARKER.length;
  for (let i = 0; i <= end; i++) {
    let match = true;
    for (let j = 0; j < ENTRY_MARKER.length; j++) {
      if (blob[i + j] !== ENTRY_MARKER[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i;
    }
  }
  return -1;
}
