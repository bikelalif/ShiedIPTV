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
console.log('Using VLC path:', vlcPath);

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

console.log('Spawning VLC with args:', args.join(' '));
const vlcProcess = spawn(vlcPath, args);

vlcProcess.stderr.on('data', (data) => {
    console.log('[VLC stderr]:', data.toString());
});

vlcProcess.stdout.on('data', (data) => {
    console.log('[VLC stdout]:', data.toString());
});

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runTest() {
    console.log('Waiting 5 seconds for VLC to start and buffer...');
    await wait(5000);

    // Test status.json
    console.log('Testing status.json...');
    const auth = Buffer.from(':admin').toString('base64');
    
    const req = http.get({
        hostname: 'localhost',
        port: 8090,
        path: '/requests/status.json',
        headers: {
            'Authorization': 'Basic ' + auth
        }
    }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.log('Status.json response code:', res.statusCode);
            try {
                const data = JSON.parse(body);
                console.log('Media title:', data.information?.category?.meta?.title);
                console.log('Media length (duration):', data.length);
                console.log('Media time:', data.time);
            } catch (e) {
                console.log('Failed to parse status.json JSON:', e.message);
                console.log('Raw body:', body);
            }
        });
    });

    req.on('error', (err) => {
        console.error('Status.json request error:', err.message);
    });

    // Test stream.ts connection
    console.log('Testing stream.ts connection...');
    const streamReq = http.get('http://localhost:8099/stream.ts', (res) => {
        console.log('Stream.ts response code:', res.statusCode);
        console.log('Stream.ts headers:', res.headers);
        
        // Read some bytes to confirm it's streaming
        let bytesCount = 0;
        res.on('data', (chunk) => {
            bytesCount += chunk.length;
            if (bytesCount > 10000) {
                console.log(`Successfully received ${bytesCount} bytes from stream.ts. Streaming works!`);
                res.destroy(); // stop reading
                cleanup();
            }
        });
    });

    streamReq.on('error', (err) => {
        console.error('Stream.ts request error:', err.message);
        cleanup();
    });
}

function cleanup() {
    console.log('Killing VLC process...');
    vlcProcess.kill('SIGKILL');
    process.exit(0);
}

runTest();
