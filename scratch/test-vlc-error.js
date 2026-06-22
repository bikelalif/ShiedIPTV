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

const args = [
    '-I', 'dummy',
    '-vv',
    testUrl,
    '--sout=#transcode{acodec=mp3,ab=128,channels=2,samplerate=44100}:http{mux=ts,dst=:8099/stream.ts}',
    '--sout-keep'
];

console.log('Spawning VLC with verbosity...');
const vlcProcess = spawn(vlcPath, args);

vlcProcess.stderr.on('data', (data) => {
    const str = data.toString();
    // Only print error/warning messages or stream setup messages
    if (str.includes('error') || str.includes('warning') || str.includes('mux') || str.includes('stream') || str.includes('http')) {
        console.log('[VLC]:', str.trim());
    }
});

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    await wait(6000);
    console.log('Finished waiting. Killing VLC...');
    vlcProcess.kill('SIGKILL');
    process.exit(0);
}

run();
