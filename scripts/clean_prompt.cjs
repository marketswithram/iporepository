const fs = require('fs');
const content = fs.readFileSync('MASTER_PROMPT.md', 'utf8');
// Let's write out a clean version with actual line breaks
const clean = content.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\"/g, '"');
fs.writeFileSync('CLEAN_MASTER_PROMPT.md', clean);
const lines = clean.split('\n');
console.log('Total lines:', lines.length);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('#')) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
}
