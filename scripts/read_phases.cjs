const fs = require('fs');
const text = fs.readFileSync('FULL_MASTER_PROMPT.md', 'utf8');

function getSection(title, nextTitle) {
  const start = text.indexOf(title);
  if (start === -1) return '';
  const end = nextTitle ? text.indexOf(nextTitle, start) : text.length;
  return text.substring(start, end !== -1 ? end : text.length);
}

console.log('--- PHASE 1 ---');
console.log(getSection('# PHASE 1', '# PHASE 2').slice(0, 1500));
console.log('--- PHASE 2 ---');
console.log(getSection('# PHASE 2', '# PHASE 3').slice(0, 2000));
console.log('--- PHASE 3 ---');
console.log(getSection('# PHASE 3', '# PHASE 4').slice(0, 2500));
