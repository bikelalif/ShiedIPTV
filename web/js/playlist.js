/* ==========================================================================
   SHIELDIPTV ACCOUNT PLAYLIST & LOGIN SERVICES
   ========================================================================== */

async function loadPlaylistDataFromCache(playlistId) {
    try {
        const categories = await dbHelper.get(`playlist_cache_${playlistId}_categories`);
        const streams = await dbHelper.get(`playlist_cache_${playlistId}_streams`);
        const userInfo = await dbHelper.get(`playlist_cache_${playlistId}_user_info`);

        // Only use the cache if it actually contains streams. Otherwise a previously
        // cached EMPTY result (e.g. from a transient network failure) would be served
        // forever, leaving the grids permanently empty. Falling through forces a fresh
        // network load that then re-caches good data.
        const hasStreams = streams && (
            (Array.isArray(streams.live)   && streams.live.length   > 0) ||
            (Array.isArray(streams.movies) && streams.movies.length > 0) ||
            (Array.isArray(streams.series) && streams.series.length > 0)
        );
        if (categories && hasStreams) {
            return { categories, streams, userInfo };
        }
    } catch (e) {
        console.error("Error loading playlist data from cache", e);
    }
    return null;
}

async function savePlaylistDataToCache(playlistId, categories, streams, userInfo) {
    try {
        await dbHelper.set(`playlist_cache_${playlistId}_categories`, categories);
        await dbHelper.set(`playlist_cache_${playlistId}_streams`, streams);
        if (userInfo) {
            await dbHelper.set(`playlist_cache_${playlistId}_user_info`, userInfo);
        }
        console.log(`[Cache] Saved playlist data to cache for ${playlistId}`);
    } catch (e) {
        console.error("Error saving playlist data to cache", e);
    }
}

async function tryConnectPlaylistFromCache(playlist, isAuto) {
    const cachedData = await loadPlaylistDataFromCache(playlist.id);
    if (cachedData) {
        const t = TRANSLATIONS[state.language || 'en'];
        console.log(`[Cache] Loading playlist from cache for ID: ${playlist.id}`);
        
        state.categories = cachedData.categories;
        state.streams = cachedData.streams;
        state.userInfo = cachedData.userInfo;
        
        state.isLoggedIn = true;
        state.currentPlaylistType = playlist.type;
        safeStorage.local.setItem("shield_active_playlist_id", playlist.id);
        
        if (playlist.type === 'demo') {
            state.username = "Démo";
            document.getElementById("portal-username").innerText = "Démo";
            document.getElementById("info-status").innerText = t.activeText;
            document.getElementById("info-server-url").innerText = "Démo (Local)";
            document.getElementById("info-max-connections").innerText = "Illimité";
            document.getElementById("info-exp").innerText = "Jamais";
        } else if (playlist.type === 'xtream') {
            state.serverUrl = playlist.serverUrl;
            state.username = playlist.username;
            state.password = playlist.password;
            
            safeStorage.local.setItem("shield_iptv_session", JSON.stringify({
                serverUrl: state.serverUrl,
                username: state.username,
                password: state.password
            }));
            
            if (document.getElementById("status-username")) {
                document.getElementById("status-username").innerText = state.username;
            }
            document.getElementById("portal-username").innerText = state.username;
            
            const userInfo = cachedData.userInfo;
            if (userInfo) {
                document.getElementById("info-status").innerText = userInfo.status === "Active" ? t.activeText : userInfo.status;
                document.getElementById("info-server-url").innerText = state.serverUrl;
                document.getElementById("info-max-connections").innerText = userInfo.max_connections || "N/A";
                if (userInfo.exp_date) {
                    const date = new Date(parseInt(userInfo.exp_date) * 1000);
                    const dateStr = date.toLocaleDateString(state.language === 'fr' ? 'fr-FR' : 'en-US');
                    if (document.getElementById("status-expiry")) {
                        document.getElementById("status-expiry").innerText = `Expire: ${dateStr}`;
                    }
                    document.getElementById("info-exp").innerText = dateStr;
                } else {
                    if (document.getElementById("status-expiry")) {
                        document.getElementById("status-expiry").innerText = "Expire: N/A";
                    }
                    document.getElementById("info-exp").innerText = "N/A";
                }
            }
        } else if (playlist.type === 'm3u') {
            state.username = playlist.name;
            document.getElementById("portal-username").innerText = playlist.name;
            document.getElementById("info-status").innerText = t.activeText;
            document.getElementById("info-server-url").innerText = playlist.url;
            document.getElementById("info-max-connections").innerText = "1";
            document.getElementById("info-exp").innerText = "N/A";
        }
        
        hideLoader();
        showScreen("portal-screen");
        showToast(t.toastLoginSuccess, 3000);
        return true;
    }
    return false;
}

async function reloadActivePlaylist() {
    const activePlaylistId = safeStorage.local.getItem("shield_active_playlist_id");
    if (!activePlaylistId) {
        showToast("Aucune playlist active.", 3000);
        return;
    }
    
    const playlists = loadSavedPlaylists();
    const activePlaylist = Array.isArray(playlists) ? playlists.find(p => p && p.id === activePlaylistId) : null;
    if (!activePlaylist) {
        showToast("Impossible de trouver la playlist active.", 3000);
        return;
    }
    
    const t = TRANSLATIONS[state.language || 'en'];
    showLoader(t.toastPreloadCats || "Mise à jour des catégories...");
    
    try {
        if (activePlaylist.type === 'xtream') {
            state.serverUrl = activePlaylist.serverUrl;
            state.username = activePlaylist.username;
            state.password = activePlaylist.password;
            state.currentPlaylistType = 'xtream';
            
            const data = await makeApiCall();
            if (data && data.user_info && data.user_info.auth === 1) {
                state.userInfo = data.user_info;
                await preloadAllData();
                
                await savePlaylistDataToCache(activePlaylistId, state.categories, state.streams, data.user_info);
                
                document.getElementById("portal-username").innerText = state.username;
                document.getElementById("info-status").innerText = data.user_info.status === "Active" ? t.activeText : data.user_info.status;
                document.getElementById("info-server-url").innerText = state.serverUrl;
                document.getElementById("info-max-connections").innerText = data.user_info.max_connections || "N/A";
                if (data.user_info.exp_date) {
                    const date = new Date(parseInt(data.user_info.exp_date) * 1000);
                    const dateStr = date.toLocaleDateString(state.language === 'fr' ? 'fr-FR' : 'en-US');
                    document.getElementById("info-exp").innerText = dateStr;
                } else {
                    document.getElementById("info-exp").innerText = "N/A";
                }
            } else {
                throw new Error("Authentification expirée ou invalide.");
            }
        } else if (activePlaylist.type === 'm3u') {
            state.currentPlaylistType = 'm3u';
            const response = await fetchWithFallback(activePlaylist.url, {}, 30000);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            
            const streams = parseM3U(text);
            state.streams = streams;
            
            const liveCatsMap = new Map();
            streams.live.forEach(item => {
                const catId = item.category_id || "m3u_live_default";
                const catName = item.category_name || "Général";
                liveCatsMap.set(catId, catName);
            });
            state.categories.live = [{ category_id: "all", category_name: "Tout" }];
            liveCatsMap.forEach((name, id) => {
                state.categories.live.push({ category_id: id, category_name: name });
            });
            
            const movieCatsMap = new Map();
            streams.movies.forEach(item => {
                const catId = item.category_id || "m3u_movie_default";
                const catName = item.category_name || "Général";
                movieCatsMap.set(catId, catName);
            });
            state.categories.movies = [{ category_id: "all", category_name: "Tout" }];
            movieCatsMap.forEach((name, id) => {
                state.categories.movies.push({ category_id: id, category_name: name });
            });
            
            const seriesCatsMap = new Map();
            streams.series.forEach(item => {
                const catId = item.category_id || "m3u_series_default";
                const catName = item.category_name || "Général";
                seriesCatsMap.set(catId, catName);
            });
            state.categories.series = [{ category_id: "all", category_name: "Tout" }];
            seriesCatsMap.forEach((name, id) => {
                state.categories.series.push({ category_id: id, category_name: name });
            });
            
            await savePlaylistDataToCache(activePlaylistId, state.categories, state.streams, { status: "Active", max_connections: "1", exp_date: null });
        }
        
        hideLoader();
        showToast(state.language === 'fr' ? "Playlist rechargée avec succès !" : "Playlist reloaded successfully!", 3000);
    } catch (err) {
        hideLoader();
        console.error("Reload failed:", err);
        showToast((state.language === 'fr' ? "Échec de la mise à jour : " : "Update failed: ") + err.message, 5000);
    }
}

function loadSavedPlaylists() {
    let playlists = [];
    const saved = safeStorage.local.getItem("shield_playlists");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                playlists = parsed;
            }
        } catch(e) {}
    }
    
    // Filter out leftover 'demo' playlist objects
    if (Array.isArray(playlists)) {
        playlists = playlists.filter(p => p && p.id !== 'demo');
    } else {
        playlists = [];
    }
    return playlists;
}

function saveSettings() {
    safeStorage.local.setItem("shield_iptv_settings", JSON.stringify({
        isDohEnabled: state.isDohEnabled,
        dohResolver: state.dohResolver,
        language: state.language,
        playerSettings: state.playerSettings
    }));
}

function logout() {
    const t = TRANSLATIONS[state.language || 'en'];
    safeStorage.local.removeItem("shield_iptv_session");
    safeStorage.local.removeItem("shield_active_playlist_id");
    safeStorage.local.removeItem("shield_last_screen");
    safeStorage.local.removeItem("shield_last_section");
    safeStorage.local.removeItem("shield_last_category_id");
    safeStorage.local.removeItem("shield_last_series_id");
    state.isLoggedIn = false;
    state.streams = { live: [], movies: [], series: [] };
    state.categories = { live: [], movies: [], series: [] };
    
    showScreen("playlist-manager-screen");
    renderPlaylistsGrid();
    showToast(t.toastLogout, 3000);
}

async function connectPlaylist(playlist, isAuto = false) {
    const t = TRANSLATIONS[state.language || 'en'];
    
    // Attempt cache load first if not on webapp
    const cacheLoaded = await tryConnectPlaylistFromCache(playlist, isAuto);
    if (cacheLoaded) {
        return;
    }
    
    state.currentPlaylistType = playlist.type;
    safeStorage.local.setItem("shield_active_playlist_id", playlist.id);
    
    if (!isAuto) {
        safeStorage.local.removeItem("shield_last_screen");
        safeStorage.local.removeItem("shield_last_section");
        safeStorage.local.removeItem("shield_last_category_id");
        safeStorage.local.removeItem("shield_last_series_id");
    }
    
    if (playlist.type === 'demo') {
        showLoader(t.toastPreloadCats);
        
        state.categories.live = [
            { category_id: "all", category_name: "Tout" },
            { category_id: "demo_live_cat_1", category_name: "Documentaires" },
            { category_id: "demo_live_cat_2", category_name: "Actualités" }
        ];
        state.categories.movies = [
            { category_id: "all", category_name: "Tout" },
            { category_id: "demo_vod_cat_1", category_name: "Animation / Libre" },
            { category_id: "demo_vod_cat_2", category_name: "Sci-Fi / Libre" }
        ];
        state.categories.series = [
            { category_id: "all", category_name: "Tout" },
            { category_id: "demo_series_cat_1", category_name: "Séries Classiques" }
        ];
        
        state.streams.live = DEMO_PLAYLIST_DATA.live;
        state.streams.movies = DEMO_PLAYLIST_DATA.movies;
        state.streams.series = DEMO_PLAYLIST_DATA.series;
        
        state.username = "Démo";
        state.isLoggedIn = true;
        
        document.getElementById("portal-username").innerText = "Démo";
        document.getElementById("info-status").innerText = t.activeText;
        document.getElementById("info-server-url").innerText = "Démo (Local)";
        document.getElementById("info-max-connections").innerText = "Illimité";
        document.getElementById("info-exp").innerText = "Jamais";
        
        hideLoader();
        showToast(t.toastLoginSuccess, 3000);
        if (isAuto) {
            restoreLastScreenState();
        } else {
            showScreen("portal-screen");
        }
        
    } else if (playlist.type === 'xtream') {
        performLogin(playlist.serverUrl, playlist.username, playlist.password, isAuto);
        
    } else if (playlist.type === 'm3u') {
        showLoader(t.toastM3uLoad || "Chargement de la playlist M3U...");
        try {
            let response;
            try {
                response = await fetchWithFallback(playlist.url, {}, 30000);
            } catch (fetchErr) {
                if (fetchErr.name === 'AbortError') {
                    throw new Error('D\u00e9lai d\u00e9pass\u00e9 \u2014 le serveur M3U ne r\u00e9pond pas');
                }
                throw new Error('Serveur M3U injoignable \u2014 v\u00e9rifiez l\'URL et votre connexion r\u00e9seau');
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            
            const streams = parseM3U(text);
            state.streams = streams;
            
            const liveCatsMap = new Map();
            streams.live.forEach(item => {
                const catId = item.category_id || "m3u_live_default";
                const catName = item.category_name || "Général";
                liveCatsMap.set(catId, catName);
            });
            state.categories.live = [{ category_id: "all", category_name: "Tout" }];
            liveCatsMap.forEach((name, id) => {
                state.categories.live.push({ category_id: id, category_name: name });
            });
            
            const movieCatsMap = new Map();
            streams.movies.forEach(item => {
                const catId = item.category_id || "m3u_movie_default";
                const catName = item.category_name || "Général";
                movieCatsMap.set(catId, catName);
            });
            state.categories.movies = [{ category_id: "all", category_name: "Tout" }];
            movieCatsMap.forEach((name, id) => {
                state.categories.movies.push({ category_id: id, category_name: name });
            });
            
            const seriesCatsMap = new Map();
            streams.series.forEach(item => {
                const catId = item.category_id || "m3u_series_default";
                const catName = item.category_name || "Général";
                seriesCatsMap.set(catId, catName);
            });
            state.categories.series = [{ category_id: "all", category_name: "Tout" }];
            seriesCatsMap.forEach((name, id) => {
                state.categories.series.push({ category_id: id, category_name: name });
            });
            
            state.username = playlist.name;
            state.isLoggedIn = true;
            
            document.getElementById("portal-username").innerText = playlist.name;
            document.getElementById("info-status").innerText = t.activeText;
            document.getElementById("info-server-url").innerText = playlist.url;
            document.getElementById("info-max-connections").innerText = "1";
            document.getElementById("info-exp").innerText = "N/A";
            
            await savePlaylistDataToCache(playlist.id, state.categories, state.streams, { status: "Active", max_connections: "1", exp_date: null });
            
            hideLoader();
            showToast(t.toastLoginSuccess, 3000);
            if (isAuto) {
                restoreLastScreenState();
            } else {
                showScreen("portal-screen");
            }
        } catch (error) {
            hideLoader();
            console.error("M3U Load Error:", error);
            showToast((t.toastLoginError || "Erreur de connexion : ") + error.message, 5000);
            showScreen("playlist-manager-screen");
            renderPlaylistsGrid();
        }
    }
}

async function performLogin(url, username, password, isAutoLogin = false) {
    const t = TRANSLATIONS[state.language || 'en'];
    showLoader(t.toastLoginAuth);
    
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith("http")) cleanUrl = "http://" + cleanUrl;
    if (cleanUrl.endsWith("/")) cleanUrl = cleanUrl.slice(0, -1);
    
    state.serverUrl = cleanUrl;
    state.username = username;
    state.password = password;
    
    try {
        const data = await makeApiCall();
        
        if (data && data.user_info && data.user_info.auth === 1) {
            state.isLoggedIn = true;
            
            safeStorage.local.setItem("shield_iptv_session", JSON.stringify({
                serverUrl: state.serverUrl,
                username: state.username,
                password: state.password
            }));
            
            if (document.getElementById("status-username")) {
                document.getElementById("status-username").innerText = state.username;
            }
            document.getElementById("portal-username").innerText = state.username;
            document.getElementById("info-status").innerText = data.user_info.status === "Active" ? t.activeText : data.user_info.status;
            document.getElementById("info-server-url").innerText = state.serverUrl;
            document.getElementById("info-max-connections").innerText = data.user_info.max_connections;
            
            if (data.user_info.exp_date) {
                const date = new Date(parseInt(data.user_info.exp_date) * 1000);
                const dateStr = date.toLocaleDateString(state.language === 'fr' ? 'fr-FR' : 'en-US');
                if (document.getElementById("status-expiry")) {
                    document.getElementById("status-expiry").innerText = `Expire: ${dateStr}`;
                }
                document.getElementById("info-exp").innerText = dateStr;
            } else {
                if (document.getElementById("status-expiry")) {
                    document.getElementById("status-expiry").innerText = "Expire: N/A";
                }
                document.getElementById("info-exp").innerText = "N/A";
            }
            
            await preloadAllData();
            
            const activePlaylistId = safeStorage.local.getItem("shield_active_playlist_id");
            if (activePlaylistId) {
                await savePlaylistDataToCache(activePlaylistId, state.categories, state.streams, data.user_info);
            }
            
            hideLoader();
            showToast(t.toastLoginSuccess, 3000);
            if (isAutoLogin) {
                restoreLastScreenState();
            } else {
                showScreen("portal-screen");
            }
        } else {
            throw new Error("Identifiants incorrects.");
        }
    } catch (error) {
        hideLoader();
        console.error("Login Error:", error);
        showToast(isAutoLogin ? t.toastLoginAutoFail : t.toastLoginError + error.message, 5000);
        showScreen("playlist-manager-screen");
        renderPlaylistsGrid();
    }
}

async function preloadAllData() {
    const t = TRANSLATIONS[state.language || 'en'];
    showLoader(t.toastPreloadCats);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
        const [liveCatsRaw, movieCatsRaw, seriesCatsRaw] = await Promise.all([
            makeApiCall('get_live_categories').catch((err) => {
                console.error("Failed to load live categories:", err);
                showToast("Catégories Live : " + err.message, 5000);
                return [];
            }),
            makeApiCall('get_vod_categories').catch((err) => {
                console.error("Failed to load movie categories:", err);
                showToast("Catégories Films : " + err.message, 5000);
                return [];
            }),
            makeApiCall('get_series_categories').catch((err) => {
                console.error("Failed to load series categories:", err);
                showToast("Catégories Séries : " + err.message, 5000);
                return [];
            })
        ]);
        
        const liveCats = ensureArray(liveCatsRaw);
        const movieCats = ensureArray(movieCatsRaw);
        const seriesCats = ensureArray(seriesCatsRaw);

        state.categories.live = [{ category_id: "all", category_name: "Tout" }, ...liveCats];
        state.categories.movies = [{ category_id: "all", category_name: "Tout" }, ...movieCats];
        state.categories.series = [{ category_id: "all", category_name: "Tout" }, ...seriesCats];

        showLoader(t.toastPreloadLive);
        await new Promise(resolve => setTimeout(resolve, 50));
        const liveStreamsRaw = await makeApiCall('get_live_streams').catch((err) => {
            console.error("Failed to preload live streams:", err);
            showToast("Flux Live : " + err.message, 5000);
            return [];
        });
        state.streams.live = ensureArray(liveStreamsRaw);

        // MOBILE ONLY: the VOD & Series lists are ~11 MB each and freeze phones when parsed
        // at login. On real mobile devices, preload Live only and fetch VOD/Series
        // per-category on demand. Desktop web keeps the full preload (unchanged behavior).
        const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.AndroidApp;
        if (isMobileDevice) {
            console.log("[Preload] Mobile device: preloaded Live only; VOD & Series load on demand.");
            return;
        }

        showLoader(t.toastPreloadMovies);
        await new Promise(resolve => setTimeout(resolve, 50));
        const movieStreamsRaw = await makeApiCall('get_vod_streams').catch((err) => {
            console.error("Failed to preload VOD streams:", err);
            showToast("Flux Films : " + err.message, 5000);
            return [];
        });
        state.streams.movies = ensureArray(movieStreamsRaw);
        
        showLoader(t.toastPreloadSeries);
        await new Promise(resolve => setTimeout(resolve, 50));
        const seriesRaw = await makeApiCall('get_series').catch((err) => {
            console.error("Failed to preload Series:", err);
            showToast("Flux Séries : " + err.message, 5000);
            return [];
        });
        state.streams.series = ensureArray(seriesRaw);
        
        console.log(`[Preload] Done. Live: ${state.streams.live.length}, Movies: ${state.streams.movies.length}, Series: ${state.streams.series.length}`);
    } catch (e) {
        console.warn("Preloading error:", e);
    }
}

async function addXtreamCodesPlaylist(name, url, username, password) {
    const t = TRANSLATIONS[state.language || 'en'];
    showLoader(t.toastLoginAuth);
    
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith("http")) cleanUrl = "http://" + cleanUrl;
    if (cleanUrl.endsWith("/")) cleanUrl = cleanUrl.slice(0, -1);

    const originalServerUrl = state.serverUrl;
    const originalUsername = state.username;
    const originalPassword = state.password;
    
    state.serverUrl = cleanUrl;
    state.username = username;
    state.password = password;
    
    try {
        const data = await makeApiCall();
        
        if (data && data.user_info && data.user_info.auth === 1) {
            state.isLoggedIn = true;
            
            const playlists = loadSavedPlaylists();
            const id = "playlist_" + Date.now();
            const newPlaylist = {
                id: id,
                name: name.trim() || "Xtream Playlist",
                type: 'xtream',
                serverUrl: cleanUrl,
                username: username,
                password: password,
                readonly: false
            };
            playlists.push(newPlaylist);
            safeStorage.local.setItem("shield_playlists", JSON.stringify(playlists));
            safeStorage.local.setItem("shield_active_playlist_id", id);
            
            safeStorage.local.setItem("shield_iptv_session", JSON.stringify({
                serverUrl: state.serverUrl,
                username: state.username,
                password: state.password
            }));
            
            if (document.getElementById("status-username")) {
                document.getElementById("status-username").innerText = state.username;
            }
            document.getElementById("portal-username").innerText = state.username;
            document.getElementById("info-status").innerText = data.user_info.status === "Active" ? t.activeText : data.user_info.status;
            document.getElementById("info-server-url").innerText = state.serverUrl;
            document.getElementById("info-max-connections").innerText = data.user_info.max_connections;
            
            if (data.user_info.exp_date) {
                const date = new Date(parseInt(data.user_info.exp_date) * 1000);
                const dateStr = date.toLocaleDateString(state.language === 'fr' ? 'fr-FR' : 'en-US');
                if (document.getElementById("status-expiry")) {
                    document.getElementById("status-expiry").innerText = `Expire: ${dateStr}`;
                }
                document.getElementById("info-exp").innerText = dateStr;
            } else {
                if (document.getElementById("status-expiry")) {
                    document.getElementById("status-expiry").innerText = "Expire: N/A";
                }
                document.getElementById("info-exp").innerText = "N/A";
            }
            
            await preloadAllData();
            
            await savePlaylistDataToCache(id, state.categories, state.streams, data.user_info);
            
            hideLoader();
            showToast(t.toastLoginSuccess, 3000);
            showScreen("portal-screen");
        } else {
            throw new Error("Identifiants incorrects.");
        }
    } catch (error) {
        state.serverUrl = originalServerUrl;
        state.username = originalUsername;
        state.password = originalPassword;
        
        hideLoader();
        console.error("Login Error:", error);
        showToast((t.toastLoginError || "Erreur de connexion : ") + error.message, 5000);
    }
}

async function addM3UPlaylist(name, url) {
    const t = TRANSLATIONS[state.language || 'en'];
    showLoader(t.toastM3uLoad || "Chargement de la playlist M3U...");
    
    const cleanUrl = url.trim();
    
    try {
        let response;
        try {
            response = await fetchWithFallback(cleanUrl, {}, 30000);
        } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') {
                throw new Error('D\u00e9lai d\u00e9pass\u00e9 \u2014 le serveur M3U ne r\u00e9pond pas');
            }
            throw new Error('Serveur M3U injoignable \u2014 v\u00e9rifiez l\'URL et votre connexion r\u00e9seau');
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        
        const streams = parseM3U(text);
        state.streams = streams;
        
        const liveCatsMap = new Map();
        streams.live.forEach(item => {
            const catId = item.category_id || "m3u_live_default";
            const catName = item.category_name || "Général";
            liveCatsMap.set(catId, catName);
        });
        state.categories.live = [{ category_id: "all", category_name: "Tout" }];
        liveCatsMap.forEach((name, id) => {
            state.categories.live.push({ category_id: id, category_name: name });
        });
        
        const movieCatsMap = new Map();
        streams.movies.forEach(item => {
            const catId = item.category_id || "m3u_movie_default";
            const catName = item.category_name || "Général";
            movieCatsMap.set(catId, catName);
        });
        state.categories.movies = [{ category_id: "all", category_name: "Tout" }];
        movieCatsMap.forEach((name, id) => {
            state.categories.movies.push({ category_id: id, category_name: name });
        });
        
        const seriesCatsMap = new Map();
        streams.series.forEach(item => {
            const catId = item.category_id || "m3u_series_default";
            const catName = item.category_name || "Général";
            seriesCatsMap.set(catId, catName);
        });
        state.categories.series = [{ category_id: "all", category_name: "Tout" }];
        seriesCatsMap.forEach((name, id) => {
            state.categories.series.push({ category_id: id, category_name: name });
        });
        
        const playlists = loadSavedPlaylists();
        const id = "playlist_" + Date.now();
        const newPlaylist = {
            id: id,
            name: name.trim() || "M3U Playlist",
            type: 'm3u',
            url: cleanUrl,
            readonly: false
        };
        playlists.push(newPlaylist);
        safeStorage.local.setItem("shield_playlists", JSON.stringify(playlists));
        
        state.username = newPlaylist.name;
        state.currentPlaylistType = 'm3u';
        state.isLoggedIn = true;
        safeStorage.local.setItem("shield_active_playlist_id", id);
        
        document.getElementById("portal-username").innerText = newPlaylist.name;
        document.getElementById("info-status").innerText = t.activeText;
        document.getElementById("info-server-url").innerText = newPlaylist.url;
        document.getElementById("info-max-connections").innerText = "1";
        document.getElementById("info-exp").innerText = "N/A";
        
        await savePlaylistDataToCache(id, state.categories, state.streams, { status: "Active", max_connections: "1", exp_date: null });
        
        hideLoader();
        showToast(t.toastLoginSuccess, 3000);
        showScreen("portal-screen");
    } catch (error) {
        hideLoader();
        console.error("M3U Load Error:", error);
        showToast((t.toastLoginError || "Erreur de connexion : ") + error.message, 5000);
    }
}

function deletePlaylist(id) {
    const playlists = loadSavedPlaylists();
    const filtered = playlists.filter(p => p.id !== id);
    safeStorage.local.setItem("shield_playlists", JSON.stringify(filtered));
    
    // Clear cache from IndexedDB
    try {
        dbHelper.delete(`playlist_cache_${id}_categories`);
        dbHelper.delete(`playlist_cache_${id}_streams`);
        dbHelper.delete(`playlist_cache_${id}_user_info`);
    } catch (e) {
        console.error("Failed to clear deleted playlist cache", e);
    }
    
    const activePlaylistId = safeStorage.local.getItem("shield_active_playlist_id");
    if (activePlaylistId === id) {
        safeStorage.local.removeItem("shield_active_playlist_id");
    }
    
    const t = TRANSLATIONS[state.language || 'en'];
    showToast(t.deletePlaylist || "Playlist supprimée.", 3000);
    renderPlaylistsGrid();
}

function renderPlaylistsGrid() {
    const gridEl = document.getElementById("playlists-grid");
    if (!gridEl) return;
    gridEl.innerHTML = "";
    
    const t = TRANSLATIONS[state.language || 'en'];
    const playlists = loadSavedPlaylists();
    
    playlists.forEach(pl => {
        const card = document.createElement("div");
        card.className = "playlist-card glass focusable";
        card.setAttribute("tabindex", "0");
        
        const info = document.createElement("div");
        info.className = "playlist-card-info";
        
        const icon = document.createElement("span");
        icon.className = "material-icons playlist-icon";
        if (pl.type === 'demo') {
            icon.innerText = "stars";
            icon.style.color = "var(--primary)";
        } else if (pl.type === 'xtream') {
            icon.innerText = "dns";
        } else {
            icon.innerText = "link";
        }
        
        const details = document.createElement("div");
        details.className = "playlist-details";
        
        const title = document.createElement("h3");
        title.className = "playlist-card-title";
        title.innerText = pl.name;
        
        const sub = document.createElement("p");
        sub.className = "playlist-card-type";
        if (pl.type === 'demo') {
            sub.innerText = "Flux libres (Démo)";
        } else if (pl.type === 'xtream') {
            sub.innerText = `Xtream • ${pl.serverUrl}`;
        } else {
            sub.innerText = `M3U • ${pl.url}`;
        }
        
        details.appendChild(title);
        details.appendChild(sub);
        
        info.appendChild(icon);
        info.appendChild(details);
        card.appendChild(info);
        
        if (!pl.readonly) {
            const delBtn = document.createElement("button");
            delBtn.className = "playlist-card-delete focusable";
            delBtn.setAttribute("title", "Supprimer cette playlist");
            delBtn.innerHTML = '<span class="material-icons">delete</span>';
            
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deletePlaylist(pl.id);
            });
            card.appendChild(delBtn);
        }
        
        card.addEventListener("click", () => {
            connectPlaylist(pl);
        });
        
        gridEl.appendChild(card);
    });
    
    const addCard = document.createElement("div");
    addCard.className = "playlist-card add-card glass focusable";
    addCard.setAttribute("tabindex", "0");
    addCard.innerHTML = `
        <span class="material-icons playlist-card-icon" style="font-size: 3rem !important;">add_circle_outline</span>
        <h3 class="playlist-card-title">${t.pmAddPlaylist}</h3>
        <p class="playlist-card-type">${t.pmAddPlaylistSub}</p>
    `;
    
    addCard.addEventListener("click", () => {
        showScreen("login-screen");
        document.getElementById("login-name").value = "";
        document.getElementById("login-url").value = "";
        document.getElementById("login-username").value = "";
        document.getElementById("login-password").value = "";
    });
    
    gridEl.appendChild(addCard);
    
    if (isTvWrapper) {
        setTimeout(() => {
            const cguModal = document.getElementById("cgu-modal");
            if (cguModal && !cguModal.classList.contains("hidden")) {
                // Do not steal focus if CGU modal is open
                return;
            }
            const firstCard = gridEl.querySelector(".playlist-card");
            if (firstCard) firstCard.focus();
        }, 100);
    }
}
