/**
 * Zero-dependency ISO/IEC 18004 QR Code generator (Byte mode, ECC Level L, Versions 1–4).
 * Produces a boolean 2D matrix (`true` = dark module) suitable for SVG or React Native rendering.
 */

type QrVersionSpec = {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewords: number;
  alignment: number[];
};

const VERSION_SPECS: ReadonlyArray<QrVersionSpec> = [
  { version: 1, size: 21, dataCodewords: 19, ecCodewords: 7, alignment: [] },
  { version: 2, size: 25, dataCodewords: 34, ecCodewords: 10, alignment: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewords: 15, alignment: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewords: 20, alignment: [6, 26] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function reedSolomonGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function reedSolomonRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = reedSolomonGenerator(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function placeFinder(grid: boolean[][], reserved: boolean[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= grid.length || cc < 0 || cc >= grid.length) continue;
      const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      grid[rr][cc] = inOuter && (onBorder || inCenter);
      reserved[rr][cc] = true;
    }
  }
}

function placeAlignment(grid: boolean[][], reserved: boolean[][], centerR: number, centerC: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = centerR + r;
      const cc = centerC + c;
      grid[rr][cc] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      reserved[rr][cc] = true;
    }
  }
}

/** Encodes a UTF-8 string (up to 78 bytes) into a standard QR Code boolean matrix. */
export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec =
    VERSION_SPECS.find((s) => bytes.length + 2 <= s.dataCodewords) || VERSION_SPECS[VERSION_SPECS.length - 1];
  const payload = bytes.slice(0, spec.dataCodewords - 2);

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  // Byte mode indicator (0100) + 8-bit character count
  pushBits(0b0100, 4);
  pushBits(payload.length, 8);
  for (const b of payload) pushBits(b, 8);

  const maxBits = spec.dataCodewords * 8;
  const terminator = Math.min(4, maxBits - bits.length);
  pushBits(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    data[i] = byte;
  }
  let padToggle = true;
  for (let i = bits.length / 8; i < spec.dataCodewords; i++) {
    data[i] = padToggle ? 0xec : 0x11;
    padToggle = !padToggle;
  }

  const ec = reedSolomonRemainder(data, spec.ecCodewords);
  const allCodewords = new Uint8Array(data.length + ec.length);
  allCodewords.set(data, 0);
  allCodewords.set(ec, data.length);

  const size = spec.size;
  const grid = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  placeFinder(grid, reserved, 0, 0);
  placeFinder(grid, reserved, 0, size - 7);
  placeFinder(grid, reserved, size - 7, 0);

  if (spec.alignment.length > 0) {
    for (const r of spec.alignment) {
      for (const c of spec.alignment) {
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
        placeAlignment(grid, reserved, r, c);
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) {
      grid[6][i] = i % 2 === 0;
      reserved[6][i] = true;
    }
    if (!reserved[i][6]) {
      grid[i][6] = i % 2 === 0;
      reserved[i][6] = true;
    }
  }

  // Reserve format info areas & dark module
  for (let i = 0; i <= 8; i++) {
    if (i < size) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
  grid[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Place data bits in upward/downward 2-column zig-zag
  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;
  let upward = true;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let dx = 0; dx < 2; dx++) {
        const cc = col - dx;
        if (reserved[row][cc]) continue;
        let bit = false;
        if (bitIdx < totalBits) {
          const byte = allCodewords[bitIdx >>> 3];
          bit = ((byte >>> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        // Mask pattern 0: (row + cc) % 2 === 0
        if ((row + cc) % 2 === 0) bit = !bit;
        grid[row][cc] = bit;
      }
    }
    upward = !upward;
  }

  // Format information for ECC Level L (01) + Mask 0 (000) -> 0x77c4
  const formatBits = 0x77c4;
  const formatCoordsA: Array<[number, number]> = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  const formatCoordsB: Array<[number, number]> = [
    [size - 1, 8],
    [size - 2, 8],
    [size - 3, 8],
    [size - 4, 8],
    [size - 5, 8],
    [size - 6, 8],
    [size - 7, 8],
    [8, size - 8],
    [8, size - 7],
    [8, size - 6],
    [8, size - 5],
    [8, size - 4],
    [8, size - 3],
    [8, size - 2],
    [8, size - 1],
  ];
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >>> i) & 1) === 1;
    const [r1, c1] = formatCoordsA[i];
    const [r2, c2] = formatCoordsB[i];
    grid[r1][c1] = bit;
    grid[r2][c2] = bit;
  }

  return grid;
}

/** Builds an SVG `<path d="..." />` string from a QR boolean matrix for single-element rendering. */
export function qrMatrixToSvgPath(matrix: boolean[][], quietZone = 2): { size: number; viewBox: string; path: string } {
  const n = matrix.length;
  const total = n + quietZone * 2;
  const parts: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        parts.push(`M${c + quietZone} ${r + quietZone}h1v1h-1z`);
      }
    }
  }
  return { size: total, viewBox: `0 0 ${total} ${total}`, path: parts.join('') };
}
