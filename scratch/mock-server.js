const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;
const WEB_DIR = path.join(__dirname, '..', 'web');

const server = http.createServer((req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    console.log(`[Mock Server] ${req.method} ${pathname} ${JSON.stringify(parsedUrl.query)}`);

    if (pathname === '/player_api.php') {
        const action = parsedUrl.query.action;
        let filename = 'user_info.json';

        if (action === 'get_live_categories') filename = 'live_categories.json';
        else if (action === 'get_live_streams') filename = 'live_streams.json';
        else if (action === 'get_vod_categories') filename = 'vod_categories.json';
        else if (action === 'get_vod_streams') filename = 'vod_streams.json';
        else if (action === 'get_series_categories') filename = 'series_categories.json';
        else if (action === 'get_series') filename = 'series.json';

        const filepath = path.join(WEB_DIR, filename);
        fs.readFile(filepath, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Error reading file: ${err.message}`);
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
        return;
    }

    // Serve static files
    let targetPath = path.join(WEB_DIR, pathname === '/' ? 'index.html' : pathname);
    fs.stat(targetPath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }

        let contentType = 'text/html';
        const ext = path.extname(targetPath).toLowerCase();
        if (ext === '.js') contentType = 'application/javascript';
        else if (ext === '.css') contentType = 'text/css';
        else if (ext === '.json') contentType = 'application/json';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.svg') contentType = 'image/svg+xml';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(targetPath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`[Mock Server] Running on http://localhost:${PORT}`);
});
