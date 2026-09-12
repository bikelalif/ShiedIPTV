const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const PUBLIC_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    let safeUrl = req.url.split('?')[0];
    
    // Intercept Xtream Codes API requests to serve mock playlist files
    if (safeUrl === '/player_api.php') {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const action = parsedUrl.searchParams.get('action');
        const seriesId = parsedUrl.searchParams.get('series_id');
        
        let jsonFile = 'user_info.json';
        if (action === 'get_live_categories') jsonFile = 'live_categories.json';
        else if (action === 'get_live_streams') jsonFile = 'live_streams.json';
        else if (action === 'get_vod_categories') jsonFile = 'vod_categories.json';
        else if (action === 'get_vod_streams') jsonFile = 'vod_streams.json';
        else if (action === 'get_series_categories') jsonFile = 'series_categories.json';
        else if (action === 'get_series') jsonFile = 'series.json';
        else if (action === 'get_series_info' && seriesId) jsonFile = `series_info_${seriesId}.json`;
        
        const fileToServe = path.join(PUBLIC_DIR, jsonFile);
        fs.readFile(fileToServe, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error reading mock data file ' + jsonFile);
                return;
            }
            res.writeHead(200, { 
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(data);
        });
        return;
    }

    if (safeUrl === '/') safeUrl = '/index.html';
    if (safeUrl.endsWith('/')) safeUrl += 'index.html';
    
    // Also resolve directory without trailing slash
    let filePath = path.join(PUBLIC_DIR, safeUrl);
    
    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isDirectory()) {
            const originalUrl = req.url.split('?')[0];
            if (!originalUrl.endsWith('/')) {
                res.writeHead(302, { 'Location': req.url.replace(originalUrl, originalUrl + '/') });
                res.end();
                return;
            }
            safeUrl += '/index.html';
            filePath = path.join(PUBLIC_DIR, safeUrl);
        }
        
        fs.stat(filePath, (err2, stats2) => {
            if (err2 || !stats2.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
                return;
            }
            
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            
            res.writeHead(200, { 'Content-Type': contentType });
            fs.createReadStream(filePath).pipe(res);
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
