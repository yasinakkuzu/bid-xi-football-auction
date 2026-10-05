/**
 * Dependency-free streaming CSV reader for the import pipeline.
 *
 * The Transfermarkt appearances dump is far too large to hold in memory, so this
 * module parses it incrementally with a small state machine that survives chunk
 * boundaries: a quoted field, an escaped `""` pair or a `\r\n` terminator may be
 * split across two reads without corrupting the row.
 *
 * Only the header names are trusted; callers map columns by name through the
 * `headerIndex` object, never by position.
 */
import { createReadStream } from 'node:fs';

/** Default read size (1 MiB) for {@link forEachCsvRow}. */
const DEFAULT_CHUNK_SIZE = 1 << 20;

/**
 * Build the incremental CSV state machine.
 *
 * `emit(row)` is called once per finished, non-blank row. Blank lines (a single
 * empty field) are skipped, which keeps trailing newlines and padding lines from
 * producing phantom records.
 *
 * @param {(row: string[]) => void} emit
 * @returns {{ push: (chunk: string) => void, end: () => void }}
 */
function createParser(emit) {
  let field = '';
  let row = [];
  let inQuotes = false;
  let rowStarted = false;
  // A closing-or-escaping quote seen as the very last character of a chunk. The
  // decision has to wait until the next chunk reveals whether it was `""`.
  let pendingQuote = false;

  const finishRow = () => {
    row.push(field);
    field = '';
    rowStarted = false;
    const finished = row;
    row = [];
    if (finished.length === 1 && finished[0] === '') return;
    emit(finished);
  };

  const push = (chunk) => {
    if (!chunk) return;
    let i = 0;
    if (pendingQuote) {
      pendingQuote = false;
      if (chunk[0] === '"') {
        field += '"';
        i = 1;
      } else {
        inQuotes = false;
      }
    }
    for (; i < chunk.length; i++) {
      const char = chunk[i];
      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < chunk.length) {
            if (chunk[i + 1] === '"') {
              field += '"';
              i += 1;
            } else {
              inQuotes = false;
            }
          } else {
            pendingQuote = true;
          }
        } else {
          field += char;
        }
        continue;
      }
      if (char === '"') {
        inQuotes = true;
        rowStarted = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
        rowStarted = true;
      } else if (char === '\n') {
        finishRow();
      } else if (char !== '\r') {
        // A bare CR outside quotes is dropped so CRLF is read as a plain LF.
        field += char;
        rowStarted = true;
      }
    }
  };

  const end = () => {
    if (pendingQuote) {
      pendingQuote = false;
      inQuotes = false;
    }
    if (field === '' && row.length === 0 && !rowStarted) return;
    finishRow();
  };

  return { push, end };
}

/**
 * Parse a single CSV line into its fields.
 *
 * Handles quoted commas, escaped quotes (`""`) and a trailing CR. A quoted field
 * may contain a literal newline; in that case only the first row is returned.
 *
 * @param {unknown} line
 * @returns {string[]} Fields; `['']` for an empty line.
 */
export function parseCsvLine(line) {
  const rows = [];
  const parser = createParser((row) => rows.push(row));
  parser.push(String(line ?? ''));
  parser.end();
  return rows.length > 0 ? rows[0] : [''];
}

/**
 * Stream a CSV file and invoke `onRow` for every data row after the header.
 *
 * The file is never fully buffered: at most one chunk plus the current row and
 * field are held in memory. Rows shorter than the header are padded with `''`
 * so callers can index by header position without bounds checks.
 *
 * @param {string} filePath
 * @param {(fields: string[], headerIndex: Record<string, number>) => unknown} onRow
 *   Receives the padded field array and a frozen header-name → column-index map.
 * @param {{ chunkSize?: number }} [options] `chunkSize` is the stream read size
 *   in bytes; smaller values are useful to exercise chunk-boundary handling.
 * @returns {Promise<void>} Resolves once the whole file has been read.
 */
export async function forEachCsvRow(filePath, onRow, { chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
  if (typeof onRow !== 'function') throw new TypeError('forEachCsvRow: onRow must be a function');
  let header = null;
  let headerIndex = null;
  const deferred = [];
  const parser = createParser((row) => {
    if (header === null) {
      const fields = row.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, '') : value));
      header = fields;
      headerIndex = Object.freeze(Object.fromEntries(fields.map((name, index) => [name, index])));
      return;
    }
    while (row.length < header.length) row.push('');
    const result = onRow(row, headerIndex);
    // Async callbacks are supported, but a synchronous callback (the hot path)
    // never pays for a promise.
    if (result && typeof result.then === 'function') deferred.push(result);
  });

  const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: chunkSize });
  for await (const chunk of stream) {
    parser.push(chunk);
    if (deferred.length > 0) await Promise.all(deferred.splice(0));
  }
  parser.end();
  if (deferred.length > 0) await Promise.all(deferred.splice(0));
}
