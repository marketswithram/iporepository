const fs = require('fs');
const transcriptPath = 'C:/Users/sudar/.gemini/antigravity-ide/brain/a9d435d7-3bc6-44ee-8d1b-0ba9b4bb5386/.system_generated/logs/transcript.jsonl';
if (!fs.existsSync(transcriptPath)) {
  console.log('No transcript file found');
  process.exit(1);
}
const content = fs.readFileSync(transcriptPath, 'utf8');
const match = content.match(/Antigravity Master Implementation Prompt[\s\S]*?(?=",\s*"created_at")/);
if (match) {
  fs.writeFileSync('MASTER_PROMPT.md', match[0].replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\"/g, '"'));
  console.log('Saved MASTER_PROMPT.md successfully! Length:', match[0].length);
} else {
  console.log('Match not found');
}
