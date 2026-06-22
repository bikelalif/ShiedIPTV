const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

function getVlcPath() {
    const paths = [
        'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
        'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return 'vlc';
}

const vlcPath = getVlcPath();
const testUrl = 'https://media.w3.org/2010/05/bunny/trailer.mp4';

// Run VLC headlessly with dummy video/audio outputs
const args = [
    '-I', 'dummy',
    '--dummy-quiet',
    testUrl,
    '--extraintf', 'http',
    '--http-port', '8091',
    '--http-password', 'admin',
    '--vout', 'dummy',
    '--aout', 'dummy'
];

console.log('Spawning query VLC...');
const vlcProcess = spawn(vlcPath, args);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const auth = Buffer.from(':admin').toString('base64');

async function run() {
    for (let i = 1; i <= 6; i++) {
        await wait(1500);
        http.get({
            hostname: 'localhost',
            port: 8091,
            path: '/requests/status.json',
            headers: { 'Authorization': 'Basic ' + auth }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    console.log(`Poll #${i} - length: ${data.length}, time: ${data.time}, state: ${data.state}`);
                    if (data.length > 0) {
                        console.log('Success! Found duration:', data.length);
                    }
                } catch (e) {
                    console.log('Parse error:', e.message);
                }
            });
        }).on('error', (err) => {
            console.log('Poll error:', err.message);
        });
    }

    await wait(2000);
    console.log('Stopping...');
    vlcProcess.kill('SIGKILL');
    process.exit(0);
}

run();
