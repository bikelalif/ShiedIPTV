/* ==========================================================================
   SHIELDIPTV UTILITIES & PARSERS
   ========================================================================== */

// DNS-over-HTTPS (DoH) Resolver
async function resolveUrlWithDoH(url) {
    if (!state.isDohEnabled) return url;
    
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        
        // Already an IP address — no need to resolve
        if (/^[0-9.]+$/.test(hostname)) return url;
        
        // For HTTPS, DoH cannot replace the hostname (breaks TLS SNI), so we skip IP substitution
        // but we still attempt DoH to verify the domain is resolvable
        const isHttps = url.startsWith('https://');
        
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
            if (aRecord && !isHttps) {
                // Only substitute IP for plain HTTP (HTTPS SNI would break)
                const ip = aRecord.data;
                parsedUrl.hostname = ip;
                console.log(`[DoH] Resolved: ${hostname} -> ${ip}`);
                return parsedUrl.toString();
            }
        }
    } catch (error) {
        console.warn("[DoH] DNS lookup failed, using fallback URL:", error);
    }
    
    return url;
}

// Generic fetch handler with DNS-over-HTTPS (DoH) resolution and fallback to original URL on failure
async function fetchWithFallback(url, options = {}, timeoutMs = 20000) {
    const resolvedUrl = await resolveUrlWithDoH(url);
    
    const tryFetch = async (targetUrl) => {
        const controller = new AbortController();
        const signal = options.signal || controller.signal;
        
        let timeoutId;
        if (!options.signal) {
            timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        }
        
        try {
            const fetchOptions = { ...options, signal };
            const response = await fetch(targetUrl, fetchOptions);
            if (timeoutId) clearTimeout(timeoutId);
            return response;
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            throw err;
        }
    };
    
    try {
        return await tryFetch(resolvedUrl);
    } catch (error) {
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
        const response = await fetchWithFallback(rawUrl, {}, 20000);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`API Error on action: ${action}`, error);
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
