async function run() {
    const urls = [
        'http://line.liondnscloud.ru/player_api.php?username=bilal000&password=mpbK2326',
        'https://line.liondnscloud.ru/player_api.php?username=bilal000&password=mpbK2326',
        'http://line.liondnscloud.ru:8080/player_api.php?username=bilal000&password=mpbK2326',
        'https://line.liondnscloud.ru:8080/player_api.php?username=bilal000&password=mpbK2326'
    ];
    
    for (const url of urls) {
        console.log(`Testing direct fetch: ${url}`);
        try {
            const start = Date.now();
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
            const duration = Date.now() - start;
            console.log(`-> Status: ${res.status} in ${duration}ms`);
        } catch (e) {
            console.log(`-> Error: ${e.message}`);
        }
    }
}

run();
