import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile('src/assets/Moneyview_IPO.xlsx');
const ws = wb.Sheets['Moneyview'];

// Print all N-column and full first sheet rows 1-23
console.log('\n=== FULL MONEYVIEW SHEET (rows 1-23, all columns) ===');
const range = XLSX.utils.decode_range(ws['!ref']);
for (let R = 0; R <= 22; R++) {
  const rowData = {};
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: R, c: C });
    const cell = ws[addr];
    if (cell) {
      const col = XLSX.utils.encode_col(C);
      rowData[col] = { v: cell.v, w: cell.w, f: cell.f, t: cell.t };
    }
  }
  if (Object.keys(rowData).length > 0) {
    console.log(`Row ${R+1}:`, JSON.stringify(rowData));
  }
}

console.log('\n=== KEY PARAMETER CELLS (N1:O21) ===');
const paramCells = ['N1','N2','N3','N4','N5','N6','N7','N8','N9','N10',
                    'O1','O2','O3','O4','O5',
                    'N21','O21','P18','P19','P21'];
for (const addr of paramCells) {
  const cell = ws[addr];
  if (cell) {
    console.log(`${addr}: v=${JSON.stringify(cell.v)} w=${JSON.stringify(cell.w)} f=${JSON.stringify(cell.f)} t=${cell.t}`);
  } else {
    console.log(`${addr}: (empty)`);
  }
}

console.log('\n=== TAX COLUMN (J2:J22) ===');
for (let R = 1; R <= 21; R++) {
  const addr = `J${R+1}`;
  const cell = ws[addr];
  if (cell) {
    console.log(`${addr}: v=${cell.v} w=${cell.w} f=${JSON.stringify(cell.f)}`);
  }
}
