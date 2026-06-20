/* ==========================================================================
   SHIELDIPTV UTILITIES & PARSERS
   ========================================================================== */

// DNS-over-HTTPS (DoH) Resolver
async function resolveUrlWithDoH(url, isLiveStream = false, isImage = false) {
    if (!state.isDohEnabled) return url;
    
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        
        // Already an IP address — no need to resolve
        if (/^[0-9.]+$/.test(hostname)) return url;
        
        const isHttps = url.startsWith('https://');
        
        if (!state.dohCache) state.dohCache = {};
        
        let ip = state.dohCache[hostname];
        
        if (!ip) {
            // DoH fetch with a 5-second timeout so a blocked resolver doesn't hang the whole login
            const dohController = new AbortController();
            const dohTimeout = setTimeout(() => dohController.abort(), 5000);
            
            let dnsData;
            try {
                const acceptHeader = state.dohResolver.includes("dns.google")
                    ? 'application/json'
                    : 'application/dns-json';
                const dohResponse = await fetch(
                    `${state.dohResolver}?name=${encodeURIComponent(hostname)}&type=A`,
                    { headers: { 'Accept': acceptHeader }, signal: dohController.signal }
                );
                clearTimeout(dohTimeout);
                dnsData = await dohResponse.json();
            } catch (dohErr) {
                clearTimeout(dohTimeout);
                console.warn(`[DoH] Resolver ${state.dohResolver} unreachable or timed out. Using original URL.`, dohErr);
                return url;
            }
            
            if (dnsData && dnsData.Answer && dnsData.Answer.length > 0) {
                const aRecord = dnsData.Answer.find(record => record.type === 1);
                if (aRecord) {
                    ip = aRecord.data;
                    state.dohCache[hostname] = ip; // Cache resolved IP
                    console.log(`[DoH] Cached resolution: ${hostname} -> ${ip}`);
                }
            }
        }
        
        if (ip && !isHttps) {
            const serverHostname = state.serverUrl ? new URL(state.serverUrl).hostname : "";
            const isIptvServer = (hostname === serverHostname);
            
            // Only substitute IP if:
            // 1. It is a live stream (which we always want to bypass DNS for)
            // 2. OR it is an image hosted on our IPTV server (to bypass ISP block on server domain)
            if (isLiveStream || (isImage && isIptvServer)) {
                parsedUrl.hostname = ip;
                console.log(`[DoH] Resolved & Substituted IP (${isLiveStream ? 'Live Stream' : 'IPTV Image'}): ${hostname} -> ${ip}`);
                return parsedUrl.toString();
            }
        }
    } catch (error) {
        console.warn("[DoH] DNS lookup failed, using fallback URL:", error);
    }
    
    return url;
}

// Synchronous DNS bypass for logo image elements using pre-resolved cache
function resolveUrlWithDoHSync(url) {
    if (!state.isDohEnabled || !state.dohCache || !url) return url;
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        if (/^[0-9.]+$/.test(hostname)) return url;
        
        const isHttps = url.startsWith('https://');
        const ip = state.dohCache[hostname];
        if (ip && !isHttps) {
            parsedUrl.hostname = ip;
            return parsedUrl.toString();
        }
    } catch (e) {}
    return url;
}

// Image loader utility that handles normal load, resolves to DoH IP on failure, and falls back to default placeholder on absolute failure.
function loadImageWithFallback(imgElement, originalUrl, defaultPoster) {
    if (!originalUrl || originalUrl === "null" || originalUrl === "undefined" || String(originalUrl).trim() === "") {
        imgElement.src = defaultPoster || "";
        return;
    }
    
    // Normalize relative paths, protocol-relative, and localhost URLs using the active IPTV server URL
    let targetUrl = originalUrl.trim();
    if (targetUrl.startsWith('//')) {
        targetUrl = 'http:' + targetUrl;
    } else if (state.serverUrl) {
        if (targetUrl.startsWith('/')) {
            targetUrl = state.serverUrl + targetUrl;
        } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('data:')) {
            targetUrl = state.serverUrl + '/' + targetUrl;
        } else {
            // Absolute URL - check if it points to localhost or loopback IP (common Xtream DB misconfig)
            try {
                const urlObj = new URL(targetUrl);
                if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
                    const serverUrlObj = new URL(state.serverUrl);
                    urlObj.hostname = serverUrlObj.hostname;
                    urlObj.port = serverUrlObj.port || "";
                    targetUrl = urlObj.toString();
                }
            } catch(e) {}
        }
    }
    
    // Asynchronously resolve the target URL via DoH to bypass ISP DNS hijacking
    resolveUrlWithDoH(targetUrl, false, true).then(resolvedUrl => {
        console.log("[Image Fallback] Channel logo: " + originalUrl + " -> Resolved to: " + resolvedUrl);
        
        let triedProxy = false;
        
        imgElement.onerror = () => {
            if (!triedProxy && resolvedUrl.startsWith('http')) {
                triedProxy = true;
                // Use a secure, high-compatibility image proxy to bypass Mixed Content and DNS blocking
                // We pass the original targetUrl with the domain name so the proxy can resolve it from its own server
                const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}`;
                console.log("[Image Fallback] Logo load failed. Retrying via secure image proxy:", proxyUrl);
                imgElement.src = proxyUrl;
                return;
            }
            
            console.log("[Image Fallback] Logo failed completely. Falling back to default poster.");
            imgElement.src = defaultPoster || "";
            imgElement.onerror = null; // Prevent loops
        };
        
        imgElement.src = resolvedUrl;
    });
}

// Generic fetch handler with DNS-over-HTTPS (DoH) resolution and fallback to original URL on failure
async function fetchWithFallback(url, options = {}, timeoutMs = 20000) {
    const resolvedUrl = await resolveUrlWithDoH(url);
    
    const tryFetch = async (targetUrl) => {
        let actualUrl = targetUrl;
        const isHostedWeb = window.location.protocol === 'https:' && 
                            !window.cordova && 
                            !window.AndroidApp && 
                            !/SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent) &&
                            window.location.hostname !== 'localhost' && 
                            window.location.hostname !== '127.0.0.1';
                            
        if (isHostedWeb && (actualUrl.startsWith('http://') || (actualUrl.startsWith('https://') && !actualUrl.startsWith(window.location.origin)))) {
            actualUrl = 'https://corsproxy.io/?' + encodeURIComponent(actualUrl);
            console.log(`[CORS Proxy] Wrapped URL: ${actualUrl}`);
        }

        const controller = new AbortController();
        const signal = options.signal || controller.signal;
        
        let timeoutId;
        if (!options.signal) {
            timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        }
        
        try {
            const fetchOptions = { ...options, signal };
            const response = await fetch(actualUrl, fetchOptions);
            if (timeoutId) clearTimeout(timeoutId);
            return response;
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            // If the proxy failed, let's try the original direct URL as fallback
            if (actualUrl !== targetUrl) {
                console.warn("[CORS Proxy] Proxy fetch failed, falling back to direct URL:", err);
                try {
                    const fallbackResponse = await fetch(targetUrl, { ...options, signal: options.signal });
                    return fallbackResponse;
                } catch (fallbackErr) {
                    throw fallbackErr;
                }
            }
            throw err;
        }
    };
    
    try {
        return await tryFetch(resolvedUrl);
    } catch (error) {
        // Fall back to original URL if the resolved URL failed (e.g. direct IP access blocked by server host checking)
        if (resolvedUrl !== url) {
            console.warn(`[DoH] Fetch failed for resolved URL (${resolvedUrl}). Retrying with original URL (${url})...`, error);
            return await tryFetch(url);
        }
        throw error;
    }
}

// API Request Handler
async function makeApiCall(action = '', additionalParams = '') {
    const rawUrl = `${state.serverUrl}/player_api.php?username=${state.username}&password=${state.password}${action ? `&action=${action}` : ''}${additionalParams}`;
    
    try {
        const response = await fetchWithFallback(rawUrl, {}, 60000);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`API Error on action: ${action}`, error);
        
        // Attempt to fall back to locally generated mock JSON files ONLY when in demo mode
        if (state.currentPlaylistType === 'demo') {
            try {
                console.log(`[Local Fallback] Demo mode active. Loading local files for action: ${action || 'user_info'}`);
                let localFile = 'user_info.json';
                if (action === 'get_live_categories') localFile = 'live_categories.json';
                else if (action === 'get_live_streams') localFile = 'live_streams.json';
                else if (action === 'get_vod_categories') localFile = 'vod_categories.json';
                else if (action === 'get_vod_streams') localFile = 'vod_streams.json';
                else if (action === 'get_series_categories') localFile = 'series_categories.json';
                else if (action === 'get_series') localFile = 'series.json';
                else if (action === 'get_series_info') {
                    const match = additionalParams.match(/series_id=(\d+)/);
                    const seriesId = match ? match[1] : '3001';
                    localFile = `series_info_${seriesId}.json`;
                }
                
                const localResponse = await fetch(localFile);
                if (localResponse.ok) {
                    const data = await localResponse.json();
                    console.log(`[Local Fallback] Successfully loaded ${localFile} locally.`);
                    return data;
                }
            } catch (fallbackErr) {
                console.warn(`[Local Fallback] Failed to load local file:`, fallbackErr);
            }
        }
        
        // Give a human-readable error message based on error type
        if (error.name === 'AbortError') {
            throw new Error('Délai dépassé — le serveur ne répond pas (timeout)');
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('net::')) {
            throw new Error('Serveur injoignable — vérifiez l\'URL et votre connexion réseau');
        }
        throw error;
    }
}

// M3U Playlist Parser Engine
function parseM3U(m3uText) {
    const lines = m3uText.split(/\r?\n/);
    const rawItems = [];
    let currentItem = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXTINF:")) {
            const info = line.substring(8);
            const logoMatch = info.match(/tvg-logo="([^"]+)"/i);
            const groupMatch = info.match(/group-title="([^"]+)"/i);
            const commaIndex = info.lastIndexOf(",");
            let name = commaIndex !== -1 ? info.substring(commaIndex + 1).trim() : "Sans titre";
            const logo = logoMatch ? logoMatch[1] : "";
            const group = groupMatch ? groupMatch[1] : "Général";
            
            currentItem = {
                name: name,
                logo: logo,
                category: group
            };
        } else if (line && !line.startsWith("#")) {
            if (currentItem) {
                currentItem.url = line;
                rawItems.push(currentItem);
                currentItem = null;
            }
        }
    }
    
    const streams = {
        live: [],
        movies: [],
        series: []
    };
    
    const m3uSeriesItems = [];
    
    rawItems.forEach(item => {
        const url = item.url;
        const urlLower = url.toLowerCase();
        const groupLower = item.category.toLowerCase();
        
        let section = "live";
        if (groupLower.includes("film") || groupLower.includes("movie") || groupLower.includes("vod") || urlLower.includes("/movie/") || urlLower.includes("/movies/")) {
            section = "movies";
        } else if (groupLower.includes("série") || groupLower.includes("series") || groupLower.includes("saison") || urlLower.includes("/series/") || /\bs\d+e\d+/i.test(item.name) || /\bs\d+e\d+/i.test(url)) {
            section = "series";
        }
        
        const id = "m3u_" + Math.random().toString(36).substring(2, 11);
        const catId = "cat_" + item.category.toLowerCase().replace(/[^a-z0-9]/g, "_");
        
        const mappedItem = {
            name: item.name,
            category_id: catId,
            category_name: item.category,
            stream_icon: item.logo,
            cover: item.logo,
            url: url
        };
        
        if (section === "live") {
            mappedItem.stream_id = id;
            streams.live.push(mappedItem);
        } else if (section === "movies") {
            mappedItem.stream_id = id;
            mappedItem.rating = "5.0";
            mappedItem.container_extension = url.split('.').pop().split('?')[0] || "mp4";
            streams.movies.push(mappedItem);
        } else {
            m3uSeriesItems.push(mappedItem);
        }
    });
    
    if (m3uSeriesItems.length > 0) {
        streams.series = parseM3USeries(m3uSeriesItems);
    }
    
    return streams;
}

function parseM3USeries(m3uItems) {
    const seriesList = [];
    const seriesMap = new Map();
    
    m3uItems.forEach(item => {
        const name = item.name;
        const sePattern = /(.*?)\s*(?:\bs(\d+)\s*[-]?\s*e(\d+)\b|\b(\d+)x(\d+)\b|\bsaison\s*(\d+)\s*épisode\s*(\d+)\b)/i;
        const match = name.match(sePattern);
        
        let baseName = name;
        let seasonNum = "1";
        let episodeNum = "1";
        
        if (match) {
            baseName = match[1].replace(/[-_.: ]+$/, "").trim();
            seasonNum = (match[2] || match[4] || match[6] || "1").replace(/^0+/, "");
            if (!seasonNum) seasonNum = "1";
            episodeNum = (match[3] || match[5] || match[7] || "1").replace(/^0+/, "");
            if (!episodeNum) episodeNum = "1";
        } else {
            const fallbackPattern = /(.*?)\s*(\d+)$/;
            const fbMatch = name.match(fallbackPattern);
            if (fbMatch) {
                baseName = fbMatch[1].trim();
                episodeNum = fbMatch[2];
            }
        }
        
        if (!seriesMap.has(baseName)) {
            const seriesId = "m3u_series_" + Math.random().toString(36).substring(2, 11);
            seriesMap.set(baseName, {
                series_id: seriesId,
                name: baseName,
                cover: item.cover || PLACEHOLDERS.vod,
                category_id: item.category_id,
                category_name: item.category_name,
                rating: "5.0",
                episodes: {}
            });
        }
        
        const series = seriesMap.get(baseName);
        if (!series.episodes[seasonNum]) {
            series.episodes[seasonNum] = [];
        }
        
        series.episodes[seasonNum].push({
            id: "m3u_ep_" + Math.random().toString(36).substring(2, 11),
            title: name,
            episode_num: episodeNum,
            url: item.url,
            container_extension: item.url.split('.').pop().split('?')[0] || "mp4"
        });
    });
    
    seriesMap.forEach(series => {
        Object.keys(series.episodes).forEach(seasonNum => {
            series.episodes[seasonNum].sort((a, b) => parseInt(a.episode_num) - parseInt(b.episode_num));
        });
        seriesList.push(series);
    });
    
    return seriesList;
}

// Defensive helper to convert any object/dictionary payload to array
function ensureArray(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') {
        return Object.values(data);
    }
    return [];
}

// IndexedDB Storage Helper for caching playlist categories and streams
const DB_NAME = 'ShieldIPTVCache';
const STORE_NAME = 'playlist_cache';

const dbHelper = {
    open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },
    async set(key, value) {
        try {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(value, key);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.error("IndexedDB set failed", e);
        }
    },
    async get(key) {
        try {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.error("IndexedDB get failed", e);
            return null;
        }
    },
    async delete(key) {
        try {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = (e) => reject(e.target.error);
            });
        } catch (e) {
            console.error("IndexedDB delete failed", e);
        }
    }
};

