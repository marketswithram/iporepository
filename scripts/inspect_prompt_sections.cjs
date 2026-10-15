const fs = require('fs');
const content = fs.readFileSync('FULL_MASTER_PROMPT.md', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
lines.forEach((line, idx) => {
  if (line.startsWith('#')) {
    console.log(`L${idx + 1}: ${line}`);
  }
});
