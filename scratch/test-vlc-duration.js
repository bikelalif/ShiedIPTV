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

// Spawn VLC
const args = [
    '-I', 'dummy',
    '--dummy-quiet',
    testUrl,
    '--extraintf', 'http',
    '--http-port', '8090',
    '--http-password', 'admin',
    '--sout=#transcode{acodec=mp3,ab=128,channels=2,samplerate=44100}:http{mux=ts,dst=:8099/stream.ts}',
    '--sout-keep'
];

console.log('Spawning VLC...');
const vlcProcess = spawn(vlcPath, args);

// Start reading the stream so VLC has an active consumer and actually demuxes/buffers the file
const streamReq = http.get('http://localhost:8099/stream.ts', (res) => {
    console.log('Stream.ts connected, status:', res.statusCode);
    res.on('data', (chunk) => {
        // Just consume data to keep the stream flowing
    });
});

streamReq.on('error', (err) => {
    console.log('Stream request error:', err.message);
});

const auth = Buffer.from(':admin').toString('base64');
let pollCount = 0;

const interval = setInterval(() => {
    pollCount++;
    if (pollCount > 10) {
        clearInterval(interval);
        cleanup();
        return;
    }
    
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
                console.log(`Poll #${pollCount} - length: ${data.length}, time: ${data.time}, state: ${data.state}`);
                if (data.length > 0) {
                    console.log('Found duration!', data.length);
                }
            } catch (e) {
                console.log('Parse error:', e.message);
            }
        });
    }).on('error', (err) => {
        console.log('Poll request error:', err.message);
    });
}, 2000);

function cleanup() {
    console.log('Cleaning up...');
    streamReq.destroy();
    vlcProcess.kill('SIGKILL');
    process.exit(0);
}
