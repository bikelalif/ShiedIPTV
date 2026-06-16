const fs = require('fs');
const file = 'C:/Users/Bilal/.gemini/antigravity-ide/brain/43dc1207-8b16-4b3b-b694-7856d7849eef/.system_generated/logs/transcript.jsonl';
if (fs.existsSync(file)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach(l => {
        if (!l) return;
        try {
            const obj = JSON.parse(l);
            if (obj.tool_calls) {
                obj.tool_calls.forEach(tc => {
                    if (tc.name === 'capture_browser_console_logs') {
                        console.log("TOOL CALL:", JSON.stringify(tc));
                    }
                });
            }
            if (obj.type === 'VIEW_FILE' && obj.content && obj.content.includes('Console Logs:')) {
                console.log("CONSOLE CONTENT:", obj.content);
            }
        } catch(e) {}
    });
} else {
    console.log("Transcript not found");
}
