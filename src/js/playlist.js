/* ==========================================================================
   SHIELDIPTV ACCOUNT PLAYLIST & LOGIN SERVICES
   ========================================================================== */

function loadSavedPlaylists() {
    let playlists = [];
    const saved = localStorage.getItem("shield_playlists");
    if (saved) {
        try {
            playlists = JSON.parse(saved);
        } catch(e) {}
    }
    
    // Filter out leftover 'demo' playlist objects
    playlists = playlists.filter(p => p.id !== 'demo');
    return playlists;
}

function saveSettings() {
    localStorage.setItem("shield_iptv_settings", JSON.stringify({
        isDohEnabled: state.isDohEnabled,
        dohResolver: state.dohResolver,
        language: state.language
    }));
}

function logout() {
    const t = TRANSLATIONS[state.language || 'fr'];
    localStorage.removeItem("shield_iptv_session");
    localStorage.removeItem("shield_active_playlist_id");
    localStorage.removeItem("shield_last_screen");
    localStorage.removeItem("shield_last_section");
    localStorage.removeItem("shield_last_category_id");
    localStorage.removeItem("shield_last_series_id");
    state.isLoggedIn = false;
    state.streams = { live: [], movies: [], series: [] };
    state.categories = { live: [], movies: [], series: [] };
    
    showScreen("playlist-manager-screen");
    renderPlaylistsGrid();
    showToast(t.toastLogout, 3000);
}

async function connectPlaylist(playlist, isAuto = false) {
    const t = TRANSLATIONS[state.language || 'fr'];
    state.currentPlaylistType = playlist.type;
    localStorage.setItem("shield_active_playlist_id", playlist.id);
    
    if (!isAuto) {
        localStorage.removeItem("shield_last_screen");
        localStorage.removeItem("shield_last_section");
        localStorage.removeItem("shield_last_category_id");
        localStorage.removeItem("shield_last_series_id");
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
            const resolvedM3uUrl = await resolveUrlWithDoH(playlist.url);
            
            const m3uController = new AbortController();
            const m3uTimeout = setTimeout(() => m3uController.abort(), 30000);
            let response;
            try {
                response = await fetch(resolvedM3uUrl, { signal: m3uController.signal });
            } catch (fetchErr) {
                clearTimeout(m3uTimeout);
                if (fetchErr.name === 'AbortError') {
                    throw new Error('D\u00e9lai d\u00e9pass\u00e9 \u2014 le serveur M3U ne r\u00e9pond pas');
                }
                throw new Error('Serveur M3U injoignable \u2014 v\u00e9rifiez l\'URL et votre connexion r\u00e9seau');
            }
            clearTimeout(m3uTimeout);
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
    const t = TRANSLATIONS[state.language || 'fr'];
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
            
            localStorage.setItem("shield_iptv_session", JSON.stringify({
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
    const t = TRANSLATIONS[state.language || 'fr'];
    showLoader(t.toastPreloadCats);
    
    try {
        const [liveCats, movieCats, seriesCats] = await Promise.all([
            makeApiCall('get_live_categories').catch(() => []),
            makeApiCall('get_vod_categories').catch(() => []),
            makeApiCall('get_series_categories').catch(() => [])
        ]);
        
        state.categories.live = [{ category_id: "all", category_name: "Tout" }, ...liveCats];
        state.categories.movies = [{ category_id: "all", category_name: "Tout" }, ...movieCats];
        state.categories.series = [{ category_id: "all", category_name: "Tout" }, ...seriesCats];
        
        showLoader(t.toastPreloadLive);
        state.streams.live = await makeApiCall('get_live_streams').catch(() => []);
        
        showLoader(t.toastPreloadMovies);
        state.streams.movies = await makeApiCall('get_vod_streams').catch(() => []);
        
        showLoader(t.toastPreloadSeries);
        state.streams.series = await makeApiCall('get_series').catch(() => []);
        
        console.log(`[Preload] Done. Live: ${state.streams.live.length}, Movies: ${state.streams.movies.length}, Series: ${state.streams.series.length}`);
    } catch (e) {
        console.warn("Preloading error:", e);
    }
}

async function addXtreamCodesPlaylist(name, url, username, password) {
    const t = TRANSLATIONS[state.language || 'fr'];
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
            localStorage.setItem("shield_playlists", JSON.stringify(playlists));
            localStorage.setItem("shield_active_playlist_id", id);
            
            localStorage.setItem("shield_iptv_session", JSON.stringify({
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
    const t = TRANSLATIONS[state.language || 'fr'];
    showLoader(t.toastM3uLoad || "Chargement de la playlist M3U...");
    
    const cleanUrl = url.trim();
    
    try {
        const resolvedM3uUrl = await resolveUrlWithDoH(cleanUrl);
        
        const m3uController = new AbortController();
        const m3uTimeout = setTimeout(() => m3uController.abort(), 30000);
        let response;
        try {
            response = await fetch(resolvedM3uUrl, { signal: m3uController.signal });
        } catch (fetchErr) {
            clearTimeout(m3uTimeout);
            if (fetchErr.name === 'AbortError') {
                throw new Error('D\u00e9lai d\u00e9pass\u00e9 \u2014 le serveur M3U ne r\u00e9pond pas');
            }
            throw new Error('Serveur M3U injoignable \u2014 v\u00e9rifiez l\'URL et votre connexion r\u00e9seau');
        }
        clearTimeout(m3uTimeout);
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
        localStorage.setItem("shield_playlists", JSON.stringify(playlists));
        
        state.username = newPlaylist.name;
        state.currentPlaylistType = 'm3u';
        state.isLoggedIn = true;
        localStorage.setItem("shield_active_playlist_id", id);
        
        document.getElementById("portal-username").innerText = newPlaylist.name;
        document.getElementById("info-status").innerText = t.activeText;
        document.getElementById("info-server-url").innerText = newPlaylist.url;
        document.getElementById("info-max-connections").innerText = "1";
        document.getElementById("info-exp").innerText = "N/A";
        
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
    localStorage.setItem("shield_playlists", JSON.stringify(filtered));
    
    const activePlaylistId = localStorage.getItem("shield_active_playlist_id");
    if (activePlaylistId === id) {
        localStorage.removeItem("shield_active_playlist_id");
    }
    
    const t = TRANSLATIONS[state.language || 'fr'];
    showToast(t.deletePlaylist || "Playlist supprimée.", 3000);
    renderPlaylistsGrid();
}

function renderPlaylistsGrid() {
    const gridEl = document.getElementById("playlists-grid");
    if (!gridEl) return;
    gridEl.innerHTML = "";
    
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
            sub.innerText = "Flux libres (NASA, Blender)";
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
        <h3 class="playlist-card-title">Ajouter une playlist</h3>
        <p class="playlist-card-type">Xtream Codes ou Lien M3U</p>
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
            const firstCard = gridEl.querySelector(".playlist-card");
            if (firstCard) firstCard.focus();
        }, 100);
    }
}
