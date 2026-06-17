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
        let dohController;
        let signal;
        try {
            if (typeof AbortController !== 'undefined') {
                dohController = new AbortController();
                signal = dohController.signal;
            }
        } catch (e) {}
        
        let dohTimeoutId;
        const dohTimeoutPromise = new Promise((_, reject) => {
            dohTimeoutId = setTimeout(() => {
                if (dohController) {
                    try {
                        dohController.abort();
                    } catch (e) {}
                }
                const err = new Error("DoH Timeout");
                err.name = "AbortError";
                reject(err);
            }, 5000);
        });
        
        const fetchPromise = (async () => {
            try {
                const acceptHeader = state.dohResolver.includes("dns.google")
                    ? 'application/json'
                    : 'application/dns-json';
                const fetchOptions = { headers: { 'Accept': acceptHeader } };
                if (signal) fetchOptions.signal = signal;
                
                const dohResponse = await fetch(
                    `${state.dohResolver}?name=${encodeURIComponent(hostname)}&type=A`,
                    fetchOptions
                );
                return await dohResponse.json();
            } finally {
                if (dohTimeoutId) clearTimeout(dohTimeoutId);
            }
        })();
        
        const dnsData = await Promise.race([fetchPromise, dohTimeoutPromise]);
        
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
        let controller;
        let signal;
        
        try {
            if (typeof AbortController !== 'undefined') {
                controller = new AbortController();
                signal = options.signal || controller.signal;
            }
        } catch (e) {
            console.warn("AbortController not supported:", e);
        }
        
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                if (controller) {
                    try {
                        controller.abort();
                    } catch (e) {}
                }
                const err = new Error('Timeout');
                err.name = 'AbortError';
                reject(err);
            }, timeoutMs);
        });
        
        const fetchPromise = (async () => {
            try {
                const fetchOptions = { ...options };
                if (signal) fetchOptions.signal = signal;
                const response = await fetch(targetUrl, fetchOptions);
                return response;
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
        })();
        
        return Promise.race([fetchPromise, timeoutPromise]);
    };
    
    try {
        return await tryFetch(resolvedUrl);
    } catch (error) {
        const isTimeout = error.name === 'AbortError' || error.message === 'Timeout';
        if (resolvedUrl !== url && !isTimeout) {
            console.warn(`[DoH] Fetch failed for resolved URL (${resolvedUrl}). Retrying with original URL (${url})...`, error);
            return await tryFetch(url);
        }
        throw error;
    }
}

// API Request Handler
async function makeApiCall(action = '', additionalParams = '', timeoutMs = 60000) {
    const rawUrl = `${state.serverUrl}/player_api.php?username=${state.username}&password=${state.password}${action ? `&action=${action}` : ''}${additionalParams}`;
    
    // Proactively block mixed content fetches on HTTPS hosted sites to explain the issue clearly to the user
    if (window.location.protocol === 'https:' && rawUrl.startsWith('http://') && !window.cordova && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        throw new Error("Sécurité Navigateur : Impossible de se connecter à un serveur HTTP depuis un site HTTPS (Mixed Content). Veuillez installer l'application PC, Mac ou Android TV.");
    }
    
    try {
        const response = await fetchWithFallback(rawUrl, {}, timeoutMs);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`API Error on action: ${action}`, error);
        // Give a human-readable error message based on error type
        if (error.name === 'AbortError') {
            throw new Error('Délai dépassé — le serveur ne répond pas (timeout)');
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('net::')) {
            let msg = 'Serveur injoignable — vérifiez l\'URL et votre connexion réseau';
            if (window.location.protocol === 'https:' && !window.cordova && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                msg += '. Note: Les navigateurs bloquent les connexions non sécurisées (HTTP) ou sans en-têtes CORS sur ce site HTTPS. Utilisez l\'application PC, Mac ou Android TV.';
            }
            throw new Error(msg);
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
