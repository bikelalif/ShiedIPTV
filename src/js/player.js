/* ==========================================================================
   SHIELDIPTV PLAYER CONTROLLER
   ========================================================================== */

async function playMedia(item, section) {
    const isMobileWeb = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && 
                        window.location.protocol !== 'file:' && 
                        !window.cordova && 
                        !/SmartTV|GoogleTV|AppleTV|AndroidTV/i.test(navigator.userAgent) && 
                        window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
    if (isMobileWeb && (section === 'live' || section === 'movies')) {
        const t = TRANSLATIONS[state.language || 'fr'];
        showToast(t.browserPlayBlocked || "Ce contenu nécessite l'application ShieldIPTV pour être lu.", 5000);
        return;
    }

    if (section === 'series') {
        openSeriesDetails(item);
        return;
    }
    
    if (section === 'live') {
        const isPlayerOpen = activeScreenId() === 'player-screen';
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile || isPlayerOpen || (state.currentPlayingStream && state.currentPlayingStream.section === 'live' && state.currentPlayingStream.item.stream_id === item.stream_id)) {
            state.currentPlayingStream = { item, section };
            const streamUrl = item.url || `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.ts`;
            launchVideoPlayer(streamUrl, item.name, item.stream_icon || item.cover);
            return;
        }
        
        state.currentPlayingStream = { item, section };
        document.getElementById("live-preview-panel").classList.remove("hidden");
        
        document.querySelectorAll(".media-card").forEach(el => {
            el.classList.remove("active-playing");
        });
        const activeCard = document.querySelector(`.media-card[data-id="${item.stream_id}"]`);
        if (activeCard) {
            activeCard.classList.add("active-playing");
        }
        
        loadLivePreview(item);
        return;
    }
    
    // VOD (movies)
    const ext = item.container_extension || "mp4";
    const streamUrl = item.url || `${state.serverUrl}/movie/${state.username}/${state.password}/${item.stream_id}.${ext}`;
    
    state.currentPlayingStream = { item, section };
    launchVideoPlayer(streamUrl, item.name, item.stream_icon || item.cover);
    
    document.getElementById("player-timeline-container").style.display = "flex";
}

async function loadEPG(streamId) {
    const t = TRANSLATIONS[state.language || 'fr'];
    try {
        const epgData = await makeApiCall('get_short_epg', `&stream_id=${streamId}`);
        const nowPlayingEl = document.getElementById("player-now-playing");
        
        if (epgData && epgData.epg_listings && epgData.epg_listings.length > 0) {
            const listing = epgData.epg_listings[0];
            const title = decodeUtf8Base64(listing.title);
            nowPlayingEl.innerText = title;
        } else {
            nowPlayingEl.innerText = t.epgEmpty;
        }
    } catch (e) {
        console.warn("EPG load failed:", e);
        document.getElementById("player-now-playing").innerText = t.playerNowPlaying;
    }
}

function launchVideoPlayer(url, title, logoUrl) {
    if (window.AndroidApp) {
        console.log("[Android Wrapper] Delegating video play to native ExoPlayer:", url);
        window.AndroidApp.playStream(url, title, logoUrl || "");
        return;
    }
    state.currentPlayingStreamUrl = url;
    destroyPreviewMpegtsPlayer();
    
    const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const vlcLoaderBtn = document.getElementById("player-loader-vlc");
    if (vlcLoaderBtn) {
        if (isMobile) {
            vlcLoaderBtn.classList.remove("hidden");
        } else {
            vlcLoaderBtn.classList.add("hidden");
        }
    }
    
    showScreen("player-screen");
    const video = document.getElementById("video-player");
    const playerLoader = document.getElementById("player-loader");
    
    document.getElementById("player-channel-name").innerText = title;
    document.getElementById("player-channel-logo").src = logoUrl || "";
    
    const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
    document.getElementById("player-timeline-container").style.display = isLive ? "none" : "flex";
    
    const t = TRANSLATIONS[state.language || 'fr'];
    const nowPlayingEl = document.getElementById("player-now-playing");
    if (state.currentPlayingStream) {
        const section = state.currentPlayingStream.section;
        if (section === 'live') {
            nowPlayingEl.innerText = t.playerNowPlaying;
            loadEPG(state.currentPlayingStream.item.stream_id);
        } else if (section === 'series') {
            const season = state.currentPlayingStream.seasonNum || "1";
            const ep = state.currentPlayingStream.item;
            const epNum = ep.episode_num || ep.num || "";
            nowPlayingEl.innerText = `${t.seasonPrefix} ${season} - ${t.episodeLabelZap} ${epNum}`;
        } else {
            nowPlayingEl.innerText = "";
        }
    } else {
        nowPlayingEl.innerText = "";
    }
    
    playerLoader.style.display = "flex";
    
    document.getElementById("player-progress-fill").style.width = "0%";
    document.getElementById("player-time-current").innerText = "0:00";
    document.getElementById("player-time-total").innerText = "0:00";
    
    const prevIcon = document.getElementById("player-icon-prev");
    const nextIcon = document.getElementById("player-icon-next");
    const prevBtn = document.getElementById("player-btn-prev");
    const nextBtn = document.getElementById("player-btn-next-channel");
    
    if (isLive) {
        prevIcon.innerText = "skip_previous";
        prevBtn.title = t.zapPrev;
        nextIcon.innerText = "skip_next";
        nextBtn.title = t.zapNext;
    } else {
        prevIcon.innerText = "replay_10";
        prevBtn.title = t.prev10;
        nextIcon.innerText = "forward_10";
        nextBtn.title = t.next10;
    }
    
    document.getElementById("player-btn-fullscreen").title = t.fullscreen;
    document.getElementById("player-btn-channels").title = t.zapListTitle;
    document.getElementById("player-btn-play").title = t.playPause;
    
    destroyMpegtsPlayer();
    
    resolveUrlWithDoH(url).then(resolvedStreamUrl => {
        const isTsStream = (resolvedStreamUrl.includes('.ts') || resolvedStreamUrl.includes('/live/')) && !resolvedStreamUrl.includes('.m3u8');
        
        if (isTsStream && typeof mpegts !== 'undefined' && mpegts.getFeatureList().mseLivePlayback) {
            console.log("[Player] Initializing mpegts.js decoder for stream:", resolvedStreamUrl);
            try {
                state.mpegtsPlayer = mpegts.createPlayer({
                    type: 'mpegts',
                    isLive: isLive,
                    url: resolvedStreamUrl
                }, {
                    enableWorker: true,
                    lazyLoadMaxDuration: 3 * 60,
                    seekType: 'range'
                });
                
                state.mpegtsPlayer.attachMediaElement(video);
                
                state.mpegtsPlayer.on(mpegts.Events.ERROR, (type, detail, info) => {
                    console.warn(`[mpegts.js] Error: ${type}, ${detail}. Reconnecting.`);
                    if (!state.reconnectTimer) {
                        state.reconnectTimer = setTimeout(() => {
                            state.reconnectTimer = null;
                            attemptReconnection();
                        }, 2000);
                    }
                });
                
                state.mpegtsPlayer.load();
                state.mpegtsPlayer.play().catch(e => {
                    console.warn("Autoplay failed, trying muted...", e);
                    video.muted = true;
                    state.mpegtsPlayer.play();
                });
            } catch (err) {
                console.error("mpegts.js setup crashed, falling back to native player:", err);
                video.src = resolvedStreamUrl;
                video.play();
            }
        } else {
            console.log("[Player] Launching native HTML5 source:", resolvedStreamUrl);
            video.src = resolvedStreamUrl;
            video.load();
            video.play().catch(e => {
                console.warn("Native Autoplay failed, trying muted...", e);
                video.muted = true;
                video.play();
            });
        }
    });
    
    video.onwaiting = () => { 
        playerLoader.style.display = "flex"; 
        if (isLive && !state.reconnectTimer) {
            state.reconnectTimer = setTimeout(() => {
                state.reconnectTimer = null;
                attemptReconnection();
            }, 6000);
        }
    };
    video.onplaying = () => { 
        playerLoader.style.display = "none"; 
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
            state.reconnectTimer = null;
        }
        state.reconnectAttempts = 0;
        
        const loaderText = playerLoader.querySelector(".player-loader-text");
        if (loaderText) {
            loaderText.innerText = t.playerLoaderText;
        }
    };
    video.onplay = () => {
        document.getElementById("player-icon-play").innerText = "pause";
    };
    video.onpause = () => {
        document.getElementById("player-icon-play").innerText = "play_arrow";
    };
    video.onerror = () => {
        if (isLive) {
            console.warn("[Player] Video error event fired. Attempting recovery.");
            if (!state.reconnectTimer) {
                state.reconnectTimer = setTimeout(() => {
                    state.reconnectTimer = null;
                    attemptReconnection();
                }, 2000);
            }
        } else {
            playerLoader.style.display = "none";
            showToast(t.playerStreamError, 5000);
            closeVideoPlayer();
        }
    };
    
    video.ontimeupdate = () => {
        if (video.duration) {
            document.getElementById("player-timeline-container").style.display = "flex";
            const percent = (video.currentTime / video.duration) * 100;
            document.getElementById("player-progress-fill").style.width = `${percent}%`;
            
            document.getElementById("player-time-current").innerText = formatTime(video.currentTime);
            document.getElementById("player-time-total").innerText = formatTime(video.duration);
        }
    };
    
    resetPlayerActivity();
}

function destroyMpegtsPlayer() {
    if (state.mpegtsPlayer) {
        console.log("[Player] Destroying previous mpegts player");
        try {
            state.mpegtsPlayer.pause();
            state.mpegtsPlayer.unload();
            state.mpegtsPlayer.detachMediaElement();
            state.mpegtsPlayer.destroy();
        } catch (e) {
            console.error("mpegts destroy failed", e);
        }
        state.mpegtsPlayer = null;
    }
    if (state.hlsPlayer) {
        console.log("[Player] Destroying previous hls player");
        try {
            state.hlsPlayer.destroy();
        } catch (e) {
            console.error("hls destroy failed", e);
        }
        state.hlsPlayer = null;
    }
}

function attemptReconnection() {
    const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
    if (!isLive) return;
    
    if (state.reconnectAttempts >= state.maxReconnectAttempts) {
        console.warn("[Player] Max reconnect attempts reached. Stopping.");
        const t = TRANSLATIONS[state.language || 'fr'];
        showToast(t.playerStreamError || "Erreur : Impossible de lire ce flux vidéo.", 5000);
        closeVideoPlayer();
        return;
    }
    
    state.reconnectAttempts++;
    console.log(`[Player] Attempting reconnection ${state.reconnectAttempts}/${state.maxReconnectAttempts}...`);
    
    const playerLoader = document.getElementById("player-loader");
    if (playerLoader) {
        playerLoader.style.display = "flex";
        const loaderText = playerLoader.querySelector(".player-loader-text");
        if (loaderText) {
            loaderText.innerText = state.language === 'fr' ? `Reconnexion (${state.reconnectAttempts})...` : `Reconnecting (${state.reconnectAttempts})...`;
        }
    }
    
    const url = state.currentPlayingStreamUrl;
    const video = document.getElementById("video-player");
    
    destroyMpegtsPlayer();
    video.removeAttribute("src");
    try { video.load(); } catch(e){}
    
    resolveUrlWithDoH(url).then(resolvedStreamUrl => {
        const isTsStream = (resolvedStreamUrl.includes('.ts') || resolvedStreamUrl.includes('/live/')) && !resolvedStreamUrl.includes('.m3u8');
        
        if (isTsStream && typeof mpegts !== 'undefined' && mpegts.getFeatureList().mseLivePlayback) {
            try {
                state.mpegtsPlayer = mpegts.createPlayer({
                    type: 'mpegts',
                    isLive: true,
                    url: resolvedStreamUrl
                }, {
                    enableWorker: true,
                    lazyLoadMaxDuration: 3 * 60,
                    seekType: 'range'
                });
                
                state.mpegtsPlayer.attachMediaElement(video);
                
                state.mpegtsPlayer.on(mpegts.Events.ERROR, (type, detail, info) => {
                    console.warn(`[mpegts.js] Error inside player: ${type}, ${detail}. Reconnecting.`);
                    if (!state.reconnectTimer) {
                        state.reconnectTimer = setTimeout(() => {
                            state.reconnectTimer = null;
                            attemptReconnection();
                        }, 2000);
                    }
                });
                
                state.mpegtsPlayer.load();
                state.mpegtsPlayer.play().catch(e => {
                    video.muted = true;
                    state.mpegtsPlayer.play().catch(err => console.error(err));
                });
            } catch (err) {
                video.src = resolvedStreamUrl;
                video.play().catch(err => console.error(err));
            }
        } else {
            video.src = resolvedStreamUrl;
            video.load();
            video.play().catch(e => {
                video.muted = true;
                video.play().catch(err => console.error(err));
            });
        }
    });
}

async function loadLivePreview(item) {
    const video = document.getElementById("live-preview-video");
    const loader = document.getElementById("preview-loader");
    const t = TRANSLATIONS[state.language || 'fr'];
    
    const epgListEl = document.getElementById("preview-epg-list");
    if (epgListEl) epgListEl.innerHTML = `<div class="preview-epg-loading">${t.epgLoading}</div>`;
    
    destroyPreviewMpegtsPlayer();
    
    if (loader) loader.classList.remove("hidden");
    
    const streamUrl = item.url || `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.ts`;
    
    resolveUrlWithDoH(streamUrl).then(resolvedUrl => {
        const isTsStream = (resolvedUrl.includes('.ts') || resolvedUrl.includes('/live/')) && !resolvedUrl.includes('.m3u8');
        
        if (isTsStream && typeof mpegts !== 'undefined' && mpegts.getFeatureList().mseLivePlayback) {
            console.log("[Preview] Initializing mpegts.js for preview stream:", resolvedUrl);
            try {
                state.previewMpegtsPlayer = mpegts.createPlayer({
                    type: 'mpegts',
                    isLive: true,
                    url: resolvedUrl
                }, {
                    enableWorker: true,
                    lazyLoadMaxDuration: 30,
                    seekType: 'range'
                });
                
                state.previewMpegtsPlayer.attachMediaElement(video);
                state.previewMpegtsPlayer.load();
                video.muted = false;
                state.previewMpegtsPlayer.play().catch(e => {
                    console.warn("[Preview] Autoplay unmuted failed, trying muted...", e);
                    video.muted = true;
                    state.previewMpegtsPlayer.play().catch(err => console.error(err));
                });
            } catch (err) {
                console.error("[Preview] mpegts setup failed, fallback to native:", err);
                video.src = resolvedUrl;
                video.muted = false;
                video.play().catch(e => {
                    console.warn("[Preview] Native fallback autoplay unmuted failed, trying muted...", e);
                    video.muted = true;
                    video.play().catch(err => {});
                });
            }
        } else {
            console.log("[Preview] Launching native HTML5 source for preview:", resolvedUrl);
            video.src = resolvedUrl;
            video.muted = false;
            video.load();
            video.play().catch(e => {
                console.warn("[Preview] Native autoplay unmuted failed (non-ts), trying muted...", e);
                video.muted = true;
                video.play().catch(err => {});
            });
        }
    });
    
    video.onwaiting = () => { if (loader) loader.classList.remove("hidden"); };
    video.onplaying = () => { if (loader) loader.classList.add("hidden"); };
    video.onerror = () => {
        if (loader) loader.classList.add("hidden");
        console.warn("[Preview] Error playing stream in preview");
    };
    
    await fetchAndRenderPreviewEPG(item, epgListEl, t);
}

function destroyPreviewMpegtsPlayer() {
    const video = document.getElementById("live-preview-video");
    if (!video) return;
    
    if (state.previewMpegtsPlayer) {
        console.log("[Preview] Destroying previous preview mpegts player");
        try {
            state.previewMpegtsPlayer.pause();
            state.previewMpegtsPlayer.unload();
            state.previewMpegtsPlayer.detachMediaElement();
            state.previewMpegtsPlayer.destroy();
        } catch (e) {
            console.error("Preview mpegts destroy failed", e);
        }
        state.previewMpegtsPlayer = null;
    }
    if (state.previewHlsPlayer) {
        console.log("[Preview] Destroying previous preview hls player");
        try {
            state.previewHlsPlayer.destroy();
        } catch (e) {
            console.error("Preview hls destroy failed", e);
        }
        state.previewHlsPlayer = null;
    }
    video.pause();
    video.removeAttribute("src");
    try {
        video.load();
    } catch(e){}
}

function closeVideoPlayer() {
    if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
    }
    state.reconnectAttempts = 0;

    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    
    const video = document.getElementById("video-player");
    video.pause();
    
    destroyMpegtsPlayer();
    
    video.removeAttribute("src");
    video.load();
    
    const playerScreen = document.getElementById("player-screen");
    playerScreen.style.cursor = "default";
    
    clearTimeout(state.overlayTimeout);
    document.getElementById("player-overlay").classList.add("hidden");
    
    const wasLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
    const liveItem = wasLive ? state.currentPlayingStream.item : null;
    
    if (state.currentPlayingStream && state.currentPlayingStream.section === 'series') {
        showScreen("series-details-screen");
    } else {
        showScreen("home-screen");
    }
    
    if (wasLive && liveItem) {
        state.currentPlayingStream = { item: liveItem, section: 'live' };
        document.getElementById("live-preview-panel").classList.remove("hidden");
        
        document.querySelectorAll(".media-card").forEach(el => {
            el.classList.remove("active-playing");
        });
        
        let activeCard = document.querySelector(`.media-card[data-id="${liveItem.stream_id}"]`);
        if (!activeCard) {
            const idx = state.currentGridItems.findIndex(item => (item.stream_id || item.series_id) === liveItem.stream_id);
            if (idx !== -1) {
                const itemsNeeded = idx + 1;
                while (state.gridCurrentPage * state.gridItemsPerPage < itemsNeeded && (state.gridCurrentPage * state.gridItemsPerPage) < state.currentGridItems.length) {
                    loadNextGridBatch('live');
                }
                activeCard = document.querySelector(`.media-card[data-id="${liveItem.stream_id}"]`);
            }
        }
        
        if (activeCard) {
            activeCard.classList.add("active-playing");
            state.lastFocusedElement = activeCard;
        }
        
        loadLivePreview(liveItem);
    } else {
        state.currentPlayingStream = null;
    }
    
    if (state.lastFocusedElement) {
        state.lastFocusedElement.focus();
        state.lastFocusedElement.scrollIntoView({ block: 'nearest' });
    } else {
        focusFirst();
    }
}

function togglePlayPause() {
    const video = document.getElementById("video-player");
    if (video.paused) {
        video.play().catch(e => console.warn(e));
    } else {
        video.pause();
    }
    resetPlayerActivity();
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error entering fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen().catch(() => {});
    }
    resetPlayerActivity();
}

function zapChannel(direction) {
    if (!state.currentPlayingStream || state.currentPlayingStream.section !== 'live') return;
    
    const activeList = state.currentGridItems;
    if (activeList.length === 0) return;
    
    const currentId = state.currentPlayingStream.item.stream_id;
    const currentIndex = activeList.findIndex(item => item.stream_id === currentId);
    if (currentIndex === -1) return;
    
    let nextIndex = 0;
    if (direction === 'next') {
        nextIndex = (currentIndex + 1) % activeList.length;
    } else {
        nextIndex = (currentIndex - 1 + activeList.length) % activeList.length;
    }
    
    const nextItem = activeList[nextIndex];
    playMedia(nextItem, 'live');
}

function resetPlayerActivity() {
    if (activeScreenId() !== "player-screen") return;
    
    const overlay = document.getElementById("player-overlay");
    const playerScreen = document.getElementById("player-screen");
    
    overlay.classList.remove("hidden");
    playerScreen.style.cursor = "default";
    
    clearTimeout(state.overlayTimeout);
    state.overlayTimeout = setTimeout(() => {
        overlay.classList.add("hidden");
        playerScreen.style.cursor = "none";
        
        if (state.zapDrawerOpen) {
            closeZapDrawer();
        }
    }, 4000);
}

function showZapDrawer() {
    state.zapDrawerOpen = true;
    const drawer = document.getElementById("zap-drawer");
    drawer.classList.remove("hidden");
    
    const listEl = document.getElementById("zap-list");
    listEl.innerHTML = "";
    
    const section = state.currentPlayingStream ? state.currentPlayingStream.section : state.currentSection;
    
    if (section === 'series') {
        const seasonNum = state.currentPlayingStream ? state.currentPlayingStream.seasonNum : "1";
        const episodes = (state.currentSeriesDetails && state.currentSeriesDetails.episodes) ? (state.currentSeriesDetails.episodes[seasonNum] || []) : [];
        const seriesName = (state.currentSeriesDetails && state.currentSeriesDetails.info) ? (state.currentSeriesDetails.info.name || "") : "";
        const t = TRANSLATIONS[state.language || 'fr'];
        
        episodes.forEach(ep => {
            const btn = document.createElement("button");
            btn.className = "zap-item focusable";
            btn.setAttribute("tabindex", "0");
            
            const activeId = state.currentPlayingStream ? state.currentPlayingStream.item.id : null;
            if (activeId === ep.id) {
                btn.classList.add("active");
            }
            
            const iconSpan = document.createElement("span");
            iconSpan.className = "material-icons zap-item-icon";
            iconSpan.innerText = "play_circle_filled";
            iconSpan.style.marginRight = "10px";
            iconSpan.style.color = "var(--primary)";
            
            const text = document.createElement("span");
            const cleanTitle = ep.title ? cleanEpisodeTitle(ep.title, seriesName) : `${t.seasonPrefix} ${seasonNum} ${t.episodeLabelZap} ${ep.episode_num || ep.num}`;
            text.innerText = `${t.episodeLabelZap} ${ep.episode_num || ep.num} - ${cleanTitle}`;
            
            btn.appendChild(iconSpan);
            btn.appendChild(text);
            
            btn.addEventListener("click", () => {
                closeZapDrawer();
                
                const ext = ep.container_extension || "mp4";
                const playUrl = ep.url || `${state.serverUrl}/series/${state.username}/${state.password}/${ep.id}.${ext}`;
                const displayTitle = ep.title ? cleanEpisodeTitle(ep.title, seriesName) : `${t.seasonPrefix} ${seasonNum} ${t.episodeLabelZap} ${ep.episode_num || ep.num}`;
                
                state.currentPlayingStream = { item: ep, section: 'series', seasonNum: seasonNum };
                launchVideoPlayer(playUrl, displayTitle, state.currentSeriesDetails.info.cover);
            });
            
            listEl.appendChild(btn);
        });
    } else {
        const currentGridItems = state.currentGridItems || [];
        currentGridItems.slice(0, 100).forEach(item => {
            const btn = document.createElement("button");
            btn.className = "zap-item focusable";
            btn.setAttribute("tabindex", "0");
            
            const activeId = state.currentPlayingStream ? (state.currentPlayingStream.item.stream_id || state.currentPlayingStream.item.series_id) : null;
            if (activeId === item.stream_id) {
                btn.classList.add("active");
            }
            
            const img = document.createElement("img");
            img.src = item.stream_icon || item.cover || (section === 'live' ? PLACEHOLDERS.live : PLACEHOLDERS.vod);
            img.onerror = () => { img.src = section === 'live' ? PLACEHOLDERS.live : PLACEHOLDERS.vod; };
            
            const text = document.createElement("span");
            text.innerText = item.name;
            
            btn.appendChild(img);
            btn.appendChild(text);
            
            btn.addEventListener("click", () => {
                closeZapDrawer();
                playMedia(item, section);
            });
            
            listEl.appendChild(btn);
        });
    }
    
    setTimeout(() => {
        const activeItem = listEl.querySelector(".zap-item.active");
        if (activeItem) {
            activeItem.focus();
            activeItem.scrollIntoView({ block: 'center' });
        } else {
            const first = listEl.querySelector(".zap-item");
            if (first) {
                first.focus();
                first.scrollIntoView({ block: 'center' });
            }
        }
    }, 100);
}

function closeZapDrawer() {
    state.zapDrawerOpen = false;
    document.getElementById("zap-drawer").classList.add("hidden");
    
    const playBtn = document.getElementById("player-btn-play");
    if (playBtn) playBtn.focus();
}

async function fetchAndRenderPreviewEPG(item, epgListEl, t) {
    try {
        const epgData = await makeApiCall('get_short_epg', `&stream_id=${item.stream_id}`);
        if (epgListEl) {
            epgListEl.innerHTML = "";
            
            if (epgData && epgData.epg_listings && epgData.epg_listings.length > 0) {
                epgData.epg_listings.forEach(listing => {
                    const title = listing.title ? decodeUtf8Base64(listing.title) : t.untitled;
                    const desc = listing.description ? decodeUtf8Base64(listing.description) : "";
                    
                    const startStr = listing.start.split(" ")[1]?.substring(0, 5) || "";
                    const endStr = listing.end.split(" ")[1]?.substring(0, 5) || "";
                    
                    const itemEl = document.createElement("div");
                    itemEl.className = "preview-epg-item";
                    
                    const timeEl = document.createElement("span");
                    timeEl.className = "preview-epg-time";
                    timeEl.innerText = `${startStr} - ${endStr}`;
                    itemEl.appendChild(timeEl);
                    
                    const titleEl = document.createElement("span");
                    titleEl.className = "preview-epg-title";
                    titleEl.innerText = title;
                    itemEl.appendChild(titleEl);
                    
                    if (desc) {
                        const descEl = document.createElement("p");
                        descEl.className = "preview-epg-desc";
                        descEl.innerText = desc;
                        itemEl.appendChild(descEl);
                    }
                    
                    epgListEl.appendChild(itemEl);
                });
            } else {
                epgListEl.innerHTML = `<div class="preview-epg-empty">${t.epgEmpty}</div>`;
            }
        }
    } catch (e) {
        console.warn("Preview EPG load failed:", e);
        if (epgListEl) epgListEl.innerHTML = `<div class="preview-epg-empty">${t.epgUnavailable}</div>`;
    }
}
