const fs = require('fs');
const file = 'C:/Users/Bilal/.gemini/antigravity-ide/brain/43dc1207-8b16-4b3b-b694-7856d7849eef/.system_generated/logs/transcript.jsonl';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach(l => {
        if (!l) return;
        try {
            const obj = JSON.parse(l);
            if (obj.content && (obj.content.includes('Uncaught') || obj.content.includes('Error') || obj.content.includes('Exception') || obj.content.includes('ReferenceError') || obj.content.includes('TypeError'))) {
                console.log("MATCHING CONTENT:\n", obj.content);
            }
        } catch(e) {}
    });
} else {
    console.log("Transcript not found");
}
