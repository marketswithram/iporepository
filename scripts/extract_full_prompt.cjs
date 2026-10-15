const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/sudar/.gemini/antigravity-ide/brain/a9d435d7-3bc6-44ee-8d1b-0ba9b4bb5386/.system_generated/logs/transcript_full.jsonl'),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  if (line.includes('Antigravity Master Implementation Prompt')) {
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT' && obj.content) {
        fs.writeFileSync('FULL_MASTER_PROMPT.md', obj.content);
        console.log('Saved USER_INPUT prompt, length:', obj.content.length);
      }
    } catch (e) {}
  }
});
