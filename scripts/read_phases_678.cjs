const fs = require('fs');
const text = fs.readFileSync('FULL_MASTER_PROMPT.md', 'utf8');

function getSection(title, nextTitle) {
  const start = text.indexOf(title);
  if (start === -1) return '';
  const end = nextTitle ? text.indexOf(nextTitle, start) : text.length;
  return text.substring(start, end !== -1 ? end : text.length);
}

console.log('--- PHASE 6 ---');
console.log(getSection('# PHASE 6', '# PHASE 7').slice(0, 2000));
console.log('--- PHASE 7 ---');
console.log(getSection('# PHASE 7', '# PHASE 8').slice(0, 2000));
console.log('--- PHASE 8 ---');
console.log(getSection('# PHASE 8', '# PHASE 9').slice(0, 2500));
