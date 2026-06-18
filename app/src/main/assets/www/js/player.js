/* ==========================================================================
   SHIELDIPTV PLAYER CONTROLLER
   ========================================================================== */

async function playMedia(item, section) {
    const isMobileWeb = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && 
                        window.location.protocol !== 'file:' && 
                        !window.cordova && 
                        !/SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent) && 
                        window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
    if (isMobileWeb && section === 'movies') {
        const t = TRANSLATIONS[state.language || 'en'];
        showToast(t.browserPlayBlocked || "Ce contenu nécessite l'application ShieldIPTV pour être lu.", 5000);
        return;
    }

    if (section === 'series') {
        openSeriesDetails(item);
        return;
    }
    
    if (section === 'live') {
        const isPlayerOpen = activeScreenId() === 'player-screen';
        const isMobile = window.innerWidth <= 1024;
        const isMobileWeb = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.cordova && !window.AndroidApp;
        
        if (isMobile || isPlayerOpen || (state.currentPlayingStream && state.currentPlayingStream.section === 'live' && state.currentPlayingStream.item.stream_id === item.stream_id)) {
            state.currentPlayingStream = { item, section };
            const supportsMse = typeof mpegts !== 'undefined' && mpegts.getFeatureList && mpegts.getFeatureList().mseLivePlayback;
            const ext = supportsMse ? 'ts' : 'm3u8';
            const streamUrl = item.url || `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.${ext}`;
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
    const ext = (item.container_extension || "mp4").toLowerCase();
    const streamUrl = item.url || `${state.serverUrl}/movie/${state.username}/${state.password}/${item.stream_id}.${ext}`;
    
    // On Android TV, use native ExoPlayer for MKV files (full codec support)
    // Resolve URL with DoH first to bypass ISP DNS blocking
    if (window.AndroidApp && ext === "mkv") {
        state.currentPlayingStream = { item, section };
        resolveUrlWithDoH(streamUrl, false).then(resolvedUrl => {
            console.log("[Android TV] Playing MKV VOD via ExoPlayer:", resolvedUrl);
            window.AndroidApp.playStream(resolvedUrl, item.name, item.stream_icon || item.cover || "");
        });
        return;
    }
    
    state.currentPlayingStream = { item, section };
    launchVideoPlayer(streamUrl, item.name, item.stream_icon || item.cover);
    
    document.getElementById("player-timeline-container").style.display = "flex";
}

async function loadEPG(streamId) {
    const t = TRANSLATIONS[state.language || 'en'];
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
    const preservedStream = state.currentPlayingStream;
    state.currentPlayingStreamUrl = url;
    destroyPreviewMpegtsPlayer();
    state.currentPlayingStream = preservedStream;
    
    const isMobileWeb = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && 
                        window.location.protocol !== 'file:' && 
                        !window.cordova && 
                        !/SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent) && 
                        window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
    const isMobile = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && !isMobileWeb;
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

    if (video) {
        video.setAttribute("poster", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
    }
    
    document.getElementById("player-channel-name").innerText = title;
    document.getElementById("player-channel-logo").src = logoUrl || "";
    
    const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
    document.getElementById("player-timeline-container").style.display = isLive ? "none" : "flex";
    
    const t = TRANSLATIONS[state.language || 'en'];
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
    
    resolveUrlWithDoH(url, isLive).then(resolvedStreamUrl => {
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
                    if (state.mpegtsPlayer) {
                        state.mpegtsPlayer.play().catch(err => console.error(err));
                    }
                });
            } catch (err) {
                console.error("mpegts.js setup crashed, falling back to native player:", err);
                video.src = resolvedStreamUrl;
                video.play().catch(err => {});
            }
        } else {
            console.log("[Player] Launching native HTML5 source:", resolvedStreamUrl);
            video.src = resolvedStreamUrl;
            video.load();
            video.play().catch(e => {
                console.warn("Native Autoplay failed, trying muted...", e);
                video.muted = true;
                video.play().catch(err => {});
            });
        }
    });
    
    bindFullscreenVideoHandlers();
    
    resetPlayerActivity();
}

function bindFullscreenVideoHandlers() {
    const video = document.getElementById("video-player");
    const playerLoader = document.getElementById("player-loader");
    if (!video || !playerLoader) return;
    
    const t = TRANSLATIONS[state.language || 'en'];
    const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
    
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
            loaderText.innerText = t.playerLoaderText || "Chargement du flux...";
        }
    };
    video.onplay = () => {
        const icon = document.getElementById("player-icon-play");
        if (icon) icon.innerText = "pause";
    };
    video.onpause = () => {
        const icon = document.getElementById("player-icon-play");
        if (icon) icon.innerText = "play_arrow";
    };
    video.onerror = () => {
        let errDetail = "";
        if (video.error) {
            errDetail = ` (Code ${video.error.code}: ${video.error.message || ''})`;
        }
        if (isLive) {
            console.warn("[Player] Video error event fired. Attempting recovery." + errDetail);
            if (!state.reconnectTimer) {
                state.reconnectTimer = setTimeout(() => {
                    state.reconnectTimer = null;
                    attemptReconnection();
                }, 2000);
            }
        } else {
            const currentSrc = video.src || "";
            console.error("[Player] Video playback error:" + errDetail, "URL:", currentSrc);
            
            const isMobileWeb = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && 
                                window.location.protocol !== 'file:' && 
                                !window.cordova && 
                                !/SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent) && 
                                window.location.hostname !== 'localhost' && 
                                window.location.hostname !== '127.0.0.1';
            
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            const isCode4 = video.error && video.error.code === 4;
            const isMobile = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && !isMobileWeb;
            
            if (isMobile || isMobileWeb || isSafari || isCode4) {
                let ext = "";
                try {
                    const cleanUrl = currentSrc.split('?')[0].split('#')[0];
                    const parts = cleanUrl.split('.');
                    if (parts.length > 1) {
                        ext = parts.pop().toLowerCase();
                    }
                } catch (e) {}
                if (!ext || ext.length > 4) ext = "MKV/TS";
                
                let errorMsg;
                if (isMobileWeb) {
                    if (state.language === 'fr') {
                        errorMsg = `Ce format de flux (${ext.toUpperCase()}) n'est pas supporté par votre navigateur mobile. Veuillez utiliser l'application ShieldIPTV pour lire ce contenu.`;
                    } else {
                        errorMsg = `This stream format (${ext.toUpperCase()}) is not supported by your mobile browser. Please use the ShieldIPTV application to watch this content.`;
                    }
                    showPlayerError(errorMsg, false);
                } else {
                    if (state.language === 'fr') {
                        errorMsg = `Ce format de flux (${ext.toUpperCase()}) n'est pas supporté par votre navigateur. Vous pouvez l'ouvrir directement dans l'application VLC.`;
                    } else {
                        errorMsg = `This stream format (${ext.toUpperCase()}) is not supported by your browser. You can open it directly in the VLC app.`;
                    }
                    showPlayerError(errorMsg, true);
                }
            } else {
                playerLoader.style.display = "none";
                showToast(`${t.playerStreamError || "Erreur de lecture du flux"}${errDetail}\nURL: ${currentSrc.substring(0, 100)}`, 10000);
                closeVideoPlayer();
            }
        }
    };
    video.ontimeupdate = () => {
        if (video.duration) {
            const container = document.getElementById("player-timeline-container");
            if (container) container.style.display = "flex";
            const percent = (video.currentTime / video.duration) * 100;
            const fill = document.getElementById("player-progress-fill");
            if (fill) fill.style.width = `${percent}%`;
            
            const current = document.getElementById("player-time-current");
            if (current) current.innerText = formatTime(video.currentTime);
            const total = document.getElementById("player-time-total");
            if (total) total.innerText = formatTime(video.duration);
        }
    };
}

function showPlayerError(msg, showVlc = true) {
    state.playerHasError = true;
    
    const playerLoader = document.getElementById("player-loader");
    if (playerLoader) {
        playerLoader.style.display = "flex";
        
        const spinner = playerLoader.querySelector(".loader-spinner");
        if (spinner) {
            spinner.style.display = "none";
        }
        
        const loaderText = playerLoader.querySelector(".player-loader-text");
        if (loaderText) {
            loaderText.innerText = msg;
            loaderText.style.color = "#ffdd99";
            loaderText.style.fontSize = "1.2rem";
            loaderText.style.margin = "1rem 2rem";
            loaderText.style.textAlign = "center";
        }
        
        const vlcLoaderBtn = document.getElementById("player-loader-vlc");
        if (vlcLoaderBtn) {
            if (showVlc) {
                vlcLoaderBtn.classList.remove("hidden");
                vlcLoaderBtn.classList.add("force-show");
            } else {
                vlcLoaderBtn.classList.add("hidden");
                vlcLoaderBtn.classList.remove("force-show");
            }
        }
    }
    
    const bottomBar = document.querySelector(".player-bottom-bar");
    if (bottomBar) {
        bottomBar.style.display = "none";
    }
    
    const overlay = document.getElementById("player-overlay");
    if (overlay) {
        overlay.classList.remove("hidden");
    }
}

function bindPreviewVideoHandlers() {
    const video = document.getElementById("video-player");
    const loader = document.getElementById("preview-loader");
    const playerLoader = document.getElementById("player-loader");
    if (!video) return;
    
    video.onwaiting = () => { 
        if (loader) loader.classList.remove("hidden"); 
        if (playerLoader) playerLoader.style.display = "flex";
    };
    video.onplaying = () => { 
        if (loader) loader.classList.add("hidden"); 
        if (playerLoader) playerLoader.style.display = "none";
    };
    video.onerror = () => {
        if (loader) loader.classList.add("hidden");
        if (playerLoader) playerLoader.style.display = "none";
        console.warn("[Preview] Error playing preview stream");
    };
    video.onplay = null;
    video.onpause = null;
    video.ontimeupdate = null;
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
        const t = TRANSLATIONS[state.language || 'en'];
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
    
    resolveUrlWithDoH(url, true).then(resolvedStreamUrl => {
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
                    if (state.mpegtsPlayer) {
                        state.mpegtsPlayer.play().catch(err => console.error(err));
                    }
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
    const playerScreen = document.getElementById("player-screen");
    const video = document.getElementById("video-player");
    const loader = document.getElementById("preview-loader");
    const playerLoader = document.getElementById("player-loader");
    const t = TRANSLATIONS[state.language || 'en'];
    
    const epgListEl = document.getElementById("preview-epg-list");
    if (epgListEl) epgListEl.innerHTML = `<div class="preview-epg-loading">${t.epgLoading}</div>`;
    
    // Set player screen to preview mode and make it visible
    playerScreen.classList.add("preview-mode");
    playerScreen.classList.remove("hidden");
    updatePreviewVideoPosition();
    
    destroyMpegtsPlayer();
    
    if (loader) loader.classList.remove("hidden");
    if (playerLoader) playerLoader.style.display = "flex";
    
    const supportsMse = typeof mpegts !== 'undefined' && mpegts.getFeatureList && mpegts.getFeatureList().mseLivePlayback;
    const previewExt = supportsMse ? 'ts' : 'm3u8';
    const streamUrl = item.url || `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.${previewExt}`;
    
    resolveUrlWithDoH(streamUrl, true).then(resolvedUrl => {
        const isTsStream = (resolvedUrl.includes('.ts') || resolvedUrl.includes('/live/')) && !resolvedUrl.includes('.m3u8');
        
        if (isTsStream && typeof mpegts !== 'undefined' && mpegts.getFeatureList().mseLivePlayback) {
            console.log("[Preview] Initializing mpegts.js for video-player in preview mode:", resolvedUrl);
            try {
                state.mpegtsPlayer = mpegts.createPlayer({
                    type: 'mpegts',
                    isLive: true,
                    url: resolvedUrl
                }, {
                    enableWorker: true,
                    lazyLoadMaxDuration: 30,
                    seekType: 'range'
                });
                
                state.mpegtsPlayer.attachMediaElement(video);
                state.mpegtsPlayer.load();
                video.muted = false;
                state.mpegtsPlayer.play().catch(e => {
                    console.warn("[Preview] Autoplay failed, trying muted...", e);
                    video.muted = true;
                    if (state.mpegtsPlayer) {
                        state.mpegtsPlayer.play().catch(err => console.error(err));
                    }
                });
                
                state.mpegtsPlayer.on(mpegts.Events.ERROR, (type, detail, info) => {
                    console.warn(`[mpegts.js] Preview player error: ${type}, ${detail}.`);
                });
            } catch (err) {
                console.error("[Preview] mpegts setup failed, fallback to native:", err);
                video.src = resolvedUrl;
                video.muted = false;
                video.play().catch(e => {
                    video.muted = true;
                    video.play().catch(err => {});
                });
            }
        } else {
            console.log("[Preview] Launching native HTML5 source in preview:", resolvedUrl);
            video.src = resolvedUrl;
            video.muted = false;
            video.load();
            video.play().catch(e => {
                video.muted = true;
                video.play().catch(err => {});
            });
        }
    });
    
    bindPreviewVideoHandlers();
    
    await fetchAndRenderPreviewEPG(item, epgListEl, t);
}

function updatePreviewVideoPosition() {
    const playerScreen = document.getElementById("player-screen");
    const container = document.getElementById("preview-video-container");
    if (!playerScreen || !container) return;
    
    if (playerScreen.classList.contains("preview-mode")) {
        const rect = container.getBoundingClientRect();
        const appRect = document.getElementById("app").getBoundingClientRect();
        
        const top = rect.top - appRect.top;
        const left = rect.left - appRect.left;
        
        playerScreen.style.position = "absolute";
        playerScreen.style.top = `${top}px`;
        playerScreen.style.left = `${left}px`;
        playerScreen.style.width = `${rect.width}px`;
        playerScreen.style.height = `${rect.height}px`;
        playerScreen.style.zIndex = "16";
        playerScreen.style.borderRadius = "14px";
        playerScreen.style.overflow = "hidden";
        playerScreen.style.border = "1px solid var(--border-color)";
    } else {
        playerScreen.style.position = "";
        playerScreen.style.top = "";
        playerScreen.style.left = "";
        playerScreen.style.width = "";
        playerScreen.style.height = "";
        playerScreen.style.zIndex = "";
        playerScreen.style.borderRadius = "";
        playerScreen.style.overflow = "";
        playerScreen.style.border = "";
    }
}

function goFullscreenFromPreview() {
    const playerScreen = document.getElementById("player-screen");
    if (!playerScreen || !state.currentPlayingStream) return;
    
    console.log("[Player] Transitioning from preview to fullscreen");
    
    playerScreen.classList.remove("preview-mode");
    updatePreviewVideoPosition();
    
    showScreen("player-screen");
    
    const item = state.currentPlayingStream.item;
    document.getElementById("player-channel-name").innerText = item.name;
    document.getElementById("player-channel-logo").src = item.stream_icon || item.cover || "";
    
    const isLive = state.currentPlayingStream.section === 'live';
    document.getElementById("player-timeline-container").style.display = isLive ? "none" : "flex";
    
    const t = TRANSLATIONS[state.language || 'en'];
    const nowPlayingEl = document.getElementById("player-now-playing");
    nowPlayingEl.innerText = t.playerNowPlaying;
    loadEPG(item.stream_id);
    
    const video = document.getElementById("video-player");
    if (video) {
        video.muted = false;
    }
    
    // Bind fullscreen event handlers
    bindFullscreenVideoHandlers();
    
    // Adjust loader state immediately based on actual video state
    const playerLoader = document.getElementById("player-loader");
    if (playerLoader) {
        if (video && !video.paused && !video.seeking && video.readyState >= 3) {
            playerLoader.style.display = "none";
        } else {
            playerLoader.style.display = "flex";
        }
    }
    
    resetPlayerActivity();
}

function exitFullscreenToPreview() {
    const playerScreen = document.getElementById("player-screen");
    if (!playerScreen || !state.currentPlayingStream) return;
    
    console.log("[Player] Shrinking from fullscreen to preview mode");
    
    if (state.overlayTimeout) {
        clearTimeout(state.overlayTimeout);
        state.overlayTimeout = null;
    }
    playerScreen.style.cursor = "";
    
    // Mark playerScreen as preview-mode FIRST so showScreen knows not to hide it
    playerScreen.classList.add("preview-mode");
    
    // First show the home screen and live-preview-panel so they are in the DOM layout
    showScreen("home-screen");
    
    const liveItem = state.currentPlayingStream.item;
    document.getElementById("live-preview-panel").classList.remove("hidden");
    
    const homeScreen = document.getElementById("home-screen");
    if (homeScreen) {
        homeScreen.classList.add("preview-open");
    }
    
    // Then calculate positioning
    updatePreviewVideoPosition();
    
    // Schedule additional updates to handle browser exiting fullscreen transition duration
    setTimeout(updatePreviewVideoPosition, 100);
    setTimeout(updatePreviewVideoPosition, 300);
    setTimeout(updatePreviewVideoPosition, 500);
    
    document.querySelectorAll(".media-card").forEach(el => {
        el.classList.remove("active-playing");
    });
    
    let activeCard = document.querySelector(`.media-card[data-id="${liveItem.stream_id}"]`);
    if (activeCard) {
        activeCard.classList.add("active-playing");
    }
    
    const epgListEl = document.getElementById("preview-epg-list");
    if (epgListEl) {
        const t = TRANSLATIONS[state.language || 'en'];
        fetchAndRenderPreviewEPG(liveItem, epgListEl, t);
    }
    
    // Bind preview event handlers
    bindPreviewVideoHandlers();
    
    // Adjust preview loader state immediately
    const loader = document.getElementById("preview-loader");
    const playerLoader = document.getElementById("player-loader");
    const video = document.getElementById("video-player");
    const isReady = video && !video.paused && !video.seeking && video.readyState >= 3;
    
    if (loader) {
        if (isReady) loader.classList.add("hidden");
        else loader.classList.remove("hidden");
    }
    if (playerLoader) {
        if (isReady) playerLoader.style.display = "none";
        else playerLoader.style.display = "flex";
    }
    
    // Restore focus to avoid losing focus in TV modes or web
    if (state.lastFocusedElement && document.body.contains(state.lastFocusedElement) && state.lastFocusedElement.offsetWidth > 0) {
        state.lastFocusedElement.focus();
        state.lastFocusedElement.scrollIntoView({ block: 'nearest' });
    } else {
        focusFirst();
    }
}

function stopVideoPlaybackCompletely() {
    console.log("[Player] Stopping video playback completely");
    const video = document.getElementById("video-player");
    if (video) {
        video.pause();
        video.removeAttribute("src");
        try { video.load(); } catch(e){}
    }
    destroyMpegtsPlayer();
    
    const playerScreen = document.getElementById("player-screen");
    if (playerScreen) {
        playerScreen.classList.add("hidden");
        playerScreen.classList.remove("preview-mode");
        updatePreviewVideoPosition();
    }
    const playerLoader = document.getElementById("player-loader");
    if (playerLoader) {
        playerLoader.style.display = "none";
    }
    state.currentPlayingStream = null;
}

function destroyPreviewMpegtsPlayer() {
    stopVideoPlaybackCompletely();
}

function closeVideoPlayer() {
    if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
    }
    state.reconnectAttempts = 0;

    // Reset error state and loader modifications
    state.playerHasError = false;
    const playerLoader = document.getElementById("player-loader");
    if (playerLoader) {
        const spinner = playerLoader.querySelector(".loader-spinner");
        if (spinner) {
            spinner.style.display = "";
        }
        const loaderText = playerLoader.querySelector(".player-loader-text");
        if (loaderText) {
            const t = TRANSLATIONS[state.language || 'en'];
            loaderText.innerText = t.playerLoaderText || "Chargement du flux...";
            loaderText.style.color = "";
            loaderText.style.fontSize = "";
            loaderText.style.margin = "";
            loaderText.style.textAlign = "";
        }
        const vlcLoaderBtn = document.getElementById("player-loader-vlc");
        if (vlcLoaderBtn) {
            vlcLoaderBtn.classList.add("hidden");
            vlcLoaderBtn.classList.remove("force-show");
        }
    }
    const bottomBar = document.querySelector(".player-bottom-bar");
    if (bottomBar) {
        bottomBar.style.display = "";
    }

    if (document.fullscreenElement) {
        try {
            const promise = document.exitFullscreen();
            if (promise && typeof promise.catch === 'function') {
                promise.catch(() => {});
            }
        } catch (e) {
            console.warn("Failed to exit fullscreen:", e);
        }
    }
    
    const isMobile = window.innerWidth <= 1024;
    if (wasLive && liveItem && !isMobile) {
        exitFullscreenToPreview();
        return;
    }
    
    const video = document.getElementById("video-player");
    video.pause();
    
    destroyMpegtsPlayer();
    
    video.removeAttribute("src");
    video.load();
    
    const playerScreen = document.getElementById("player-screen");
    playerScreen.style.cursor = "default";
    playerScreen.classList.remove("preview-mode");
    updatePreviewVideoPosition();
    
    clearTimeout(state.overlayTimeout);
    document.getElementById("player-overlay").classList.add("hidden");
    
    if (state.currentPlayingStream && state.currentPlayingStream.section === 'series') {
        showScreen("series-details-screen");
    } else {
        showScreen("home-screen");
    }
    
    state.currentPlayingStream = null;
    
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
        try {
            const promise = document.documentElement.requestFullscreen();
            if (promise && typeof promise.catch === 'function') {
                promise.catch(err => {
                    console.error(`Error entering fullscreen: ${err.message}`);
                });
            }
        } catch (err) {
            console.error(`Error entering fullscreen: ${err.message}`);
        }
    } else {
        try {
            const promise = document.exitFullscreen();
            if (promise && typeof promise.catch === 'function') {
                promise.catch(() => {});
            }
        } catch (err) {
            console.error(err);
        }
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
    if (state.playerHasError) {
        return;
    }
    state.overlayTimeout = setTimeout(() => {
        overlay.classList.add("hidden");
        playerScreen.style.cursor = "none";
        
        if (document.activeElement && overlay.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        
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
        const t = TRANSLATIONS[state.language || 'en'];
        
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
                
                // On Android TV, use native ExoPlayer with DoH resolution
                if (window.AndroidApp) {
                    resolveUrlWithDoH(playUrl, false).then(resolvedUrl => {
                        console.log("[Android TV] Playing series (zap) via ExoPlayer:", resolvedUrl);
                        window.AndroidApp.playStream(resolvedUrl, displayTitle, state.currentSeriesDetails.info.cover || "");
                    });
                    return;
                }
                
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
                    
                    const startStr = (listing.start && listing.start.split(" ")[1]) ? listing.start.split(" ")[1].substring(0, 5) : "";
                    const endStr = (listing.end && listing.end.split(" ")[1]) ? listing.end.split(" ")[1].substring(0, 5) : "";
                    
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
