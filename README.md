# zmes-parser

[![NPM version](https://img.shields.io/npm/v/zmes-parser.svg)](https://www.npmjs.com/package/zmes-parser)
[![npm download](https://img.shields.io/npm/dm/zmes-parser.svg)](https://www.npmjs.com/package/zmes-parser)
[![test coverage](https://img.shields.io/codecov/c/github/Parse zmes files/zmes-parser.svg)](https://codecov.io/gh/Parse zmes files/zmes-parser)
[![license](https://img.shields.io/npm/l/zmes-parser.svg)](https://github.com/Parse zmes files/zmes-parser/blob/main/LICENSE)

Parse Malvern Panalytical Zetasizer `.zmes` files exported by the ZS XPLORER software.

The `.zmes` format is a SQLite database containing Dynamic Light Scattering (DLS) measurement data including particle size distributions, correlation functions, instrument settings, and sample metadata.

Works in both Node.js and the browser (uses SQLite compiled to WebAssembly).

## Installation

```console
npm install zmes-parser
```

## Usage

### Parse a .zmes file

```ts
import { openAsBlob } from 'node:fs';

import { parse } from 'zmes-parser';

const blob = await openAsBlob('measurement.zmes');
const arrayBuffer = await blob.arrayBuffer();
const result = await parse(arrayBuffer);

console.log(result.records.length); // number of measurements
console.log(result.records[0].parameters); // hierarchical parameter tree
```

### Convert to MeasurementXY

The `toMeasurementXY` function converts the parsed result into the standardized [`MeasurementXY`](https://github.com/cheminfo/cheminfo-types) format:

```ts
import { parse, toMeasurementXY } from 'zmes-parser';

const result = await parse(arrayBuffer);
const measurements = toMeasurementXY(result);

// Each record produces one MeasurementXY with multiple variables:
// x - Particle diameter (nm)
// y - Intensity distribution (%)
// a - Volume distribution (%)
// b - Number distribution (%)
// c - Molecular weights (Da)
// d - Diffusion coefficients (um^2/s)
// e - Relaxation times (us)
// f - Form factor

const measurement = measurements[0];
console.log(measurement.title); // sample name
console.log(measurement.variables.x.data); // Float64Array of sizes
console.log(measurement.variables.y.data); // Float64Array of intensities
console.log(measurement.meta); // operator, timestamps, Z-average, PDI, ...
console.log(measurement.settings); // instrument info, detector angle, ...
```

## API

### `parse(data: ArrayBuffer): Promise<ZmesFile>`

Parses a `.zmes` file and returns the full hierarchical structure.

### `toMeasurementXY(zmesFile: ZmesFile): MeasurementXY<Float64Array>[]`

Converts a parsed `ZmesFile` into an array of `MeasurementXY` objects (one per record).

### `findParameterDeep(parameter: ZmesParameter, name: string): ZmesParameter | undefined`

Recursively searches the parameter tree for a node by name.

### `findParameter(children: ZmesParameter[], name: string): ZmesParameter | undefined`

Searches direct children for a parameter by name.

## License

[MIT](./LICENSE)
