const fs = require('fs');
const text = fs.readFileSync('FULL_MASTER_PROMPT.md', 'utf8');

function printSection(title, nextTitle) {
  const start = text.indexOf(title);
  if (start === -1) return;
  const end = nextTitle ? text.indexOf(nextTitle, start) : text.length;
  console.log(`\n=================== ${title} ===================`);
  console.log(text.substring(start, end !== -1 ? end : text.length));
}

printSection('# PHASE 3', '# PHASE 4');
printSection('# PHASE 6', '# PHASE 7');
printSection('# PHASE 7', '# PHASE 8');
printSection('# PHASE 8', '# PHASE 9');
printSection('# PHASE 9', '# PHASE 10');
printSection('# PHASE 10', '# PHASE 11');
