const targetUrl = 'http://line.liondnscloud.ru/player_api.php?username=bilal000&password=mpbK2326&action=get_live_streams';

async function testProxy(name, proxyPattern) {
    const proxiedUrl = proxyPattern(targetUrl);
    console.log(`Testing ${name}: ${proxiedUrl}`);
    try {
        const start = Date.now();
        const res = await fetch(proxiedUrl, { signal: AbortSignal.timeout(15000) });
        const duration = Date.now() - start;
        console.log(`${name} status: ${res.status} ${res.statusText} in ${duration}ms`);
        if (res.ok) {
            const text = await res.text();
            console.log(`${name} size: ${text.length} bytes`);
            console.log(`${name} preview: ${text.substring(0, 100)}`);
        }
    } catch (e) {
        console.error(`${name} failed:`, e.message);
    }
}

async function run() {
    await testProxy('custom_worker', url => `https://shieldiptv-proxy.bilalkefif243.workers.dev/?url=${encodeURIComponent(url)}`);
    await testProxy('corsproxy.io', url => `https://corsproxy.io/?${encodeURIComponent(url)}`);
}

run();
