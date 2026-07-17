// Minimal, dependency-free CSV helpers (RFC 4180-ish). No npm csv package is
// used here so this keeps working without an `npm install` for a new dep.

// Parses CSV text into an array of rows, each row an array of string cells.
// Handles quoted fields, embedded commas/newlines, and "" as an escaped quote.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  // Normalize line endings so \r\n and \r don't produce phantom blank rows.
  const input = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row (files without a final newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty trailing rows (common with a trailing newline).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

function csvEscapeCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Builds CSV text from a header array and an array of row-arrays.
function stringifyCsv(header, rows) {
  const lines = [header.map(csvEscapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscapeCell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

module.exports = { parseCsv, stringifyCsv };
