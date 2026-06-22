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
const testUrl = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

// Use standard sout syntax: std{access=http,mux=ts,dst=:8099/stream.ts}
const args = [
    '-I', 'dummy',
    '--dummy-quiet',
    testUrl,
    '--extraintf', 'http',
    '--http-port', '8090',
    '--http-password', 'admin',
    '--sout=#transcode{acodec=mp3,ab=128,channels=2,samplerate=44100}:std{access=http,mux=ts,dst=:8099/stream.ts}',
    '--sout-keep'
];

console.log('Spawning VLC with standard sout access...');
const vlcProcess = spawn(vlcPath, args);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    await wait(5000);
    
    console.log('Connecting to stream...');
    const streamReq = http.get('http://localhost:8099/stream.ts', (res) => {
        console.log('Stream status:', res.statusCode);
        res.on('data', (chunk) => {
            // consume data
        });
    }).on('error', (err) => {
        console.log('Stream error:', err.message);
    });

    const auth = Buffer.from(':admin').toString('base64');
    
    for (let i = 1; i <= 5; i++) {
        await wait(2000);
        http.get({
            hostname: 'localhost',
            port: 8090,
            path: '/requests/status.json',
            headers: { 'Authorization': 'Basic ' + auth }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    console.log(`Poll #${i} - length: ${data.length}, time: ${data.time}, state: ${data.state}`);
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
    streamReq.destroy();
    vlcProcess.kill('SIGKILL');
    process.exit(0);
}

run();
