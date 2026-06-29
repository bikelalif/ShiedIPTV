const http = require('http');

const url = 'http://103.176.90.109/live/bilal000/mpbK2326/832068.m3u8';

async function fetchWithRedirects(testUrl, headers, depth = 0) {
  if (depth > 5) {
    console.error('Too many redirects');
    return;
  }
  
  return new Promise((resolve) => {
    const parsedUrl = new URL(testUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        ...headers,
        'Host': parsedUrl.host
      }
    };

    console.log(`[Depth ${depth}] GET ${testUrl}`);

    const req = http.request(options, (res) => {
      console.log(`Response Status: ${res.statusCode}`);
      
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, testUrl).href;
        }
        resolve(fetchWithRedirects(redirectUrl, headers, depth + 1));
      } else {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          console.log(`Final Response Body length: ${data.length}`);
          resolve();
        });
      }
    });

    req.on('error', (e) => {
      console.error(`Request failed: ${e.message}`);
      resolve();
    });

    req.end();
  });
}

async function run() {
  const headersWithReferer = {
    'Origin': 'http://shieldiptvplayer.com',
    'Referer': 'http://shieldiptvplayer.com/test-player.html',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive'
  };
  
  console.log('--- TEST 2: With Referer header ---');
  await fetchWithRedirects(url, headersWithReferer);
}

run();
