const http = require('http');

const SERVER_URL = "http://your-iptv-domain.com";
const USERNAME = "username";
const PASSWORD = "password";
const SEARCH_KEYWORD = "irishman";

const url = `${SERVER_URL}/player_api.php?username=${USERNAME}&password=${PASSWORD}&action=get_vod_streams`;

console.log("Connecting to Xtream server...");

http.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const movies = JSON.parse(data);
            if (!Array.isArray(movies)) {
                console.error("API response is not an array:", data.slice(0, 200));
                return;
            }
            console.log(`Successfully fetched ${movies.length} movies. Searching for '${SEARCH_KEYWORD}'...`);
            const matches = movies.filter(m => m.name && m.name.toLowerCase().includes(SEARCH_KEYWORD));
            
            if (matches.length === 0) {
                console.log(`No movie matching '${SEARCH_KEYWORD}' found.`);
                return;
            }

            console.log("\nFound matches:");
            matches.forEach(m => {
                const name = m.name;
                const stream_id = m.stream_id;
                const ext = m.container_extension || 'mp4';
                const streamUrl = `${SERVER_URL}/movie/${USERNAME}/${PASSWORD}/${stream_id}.${ext}`;
                
                console.log(`- Movie Name: ${name}`);
                console.log(`  Stream ID : ${stream_id}`);
                console.log(`  Extension : ${ext}`);
                console.log(`  Direct URL: ${streamUrl}\n`);
            });
        } catch (e) {
            console.error("Failed to parse JSON response:", e.message);
        }
    });
}).on('error', (err) => {
    console.error("HTTP request failed:", err.message);
});
