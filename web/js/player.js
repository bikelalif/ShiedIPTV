function checkIsMobileWeb() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && 
           !window.cordova && 
           !window.AndroidApp &&
           !/SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent);
}

function getLiveStreamExt() {
    const supportsMse = typeof mpegts !== 'undefined' && mpegts.getFeatureList && mpegts.getFeatureList().mseLivePlayback;
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.AndroidApp;
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // On iOS, we MUST use HLS (m3u8) because MSE is not supported at all
    if (isIos || !supportsMse) {
        return 'm3u8';
    }
    
    // On mobile web browsers (not native apps), use HLS (m3u8) by default because
    // mpegts.js + MSE is unreliable on mobile browsers and causes infinite loading loops.
    // HLS works natively on iOS Safari and via HLS.js on Android Chrome.
    if (isMobileDevice && checkIsMobileWeb()) {
        if (state.playerSettings && state.playerSettings.liveFormat) {
            return state.playerSettings.liveFormat;
        }
        return 'm3u8';
    }
    
    // On mobile native apps (Android TV, Cordova) supporting MSE, default to 'ts'
    if (isMobileDevice) {
        if (state.playerSettings && state.playerSettings.liveFormat) {
            return state.playerSettings.liveFormat;
        }
        return 'ts';
    }
    
    // For PC/TV/Desktop, use user setting if defined, otherwise default to 'ts'
    if (state.playerSettings && state.playerSettings.liveFormat) {
        return state.playerSettings.liveFormat;
    }
    return 'ts';
}

function getPlayerForSection(section) {
    if (!state.playerSettings) return 'html5';
    if (section === 'live') return state.playerSettings.live || 'html5';
    if (section === 'movies') return state.playerSettings.movies || (window.AndroidApp ? 'exoplayer' : 'html5');
    if (section === 'series') return state.playerSettings.series || (window.AndroidApp ? 'exoplayer' : 'html5');
    return 'html5';
}

async function playMedia(item, section) {
    const isMobileWeb = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && 
                        window.location.protocol !== 'file:' && 
                        !window.cordova && 
                        !window.AndroidApp &&
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
        const targetPlayer = getPlayerForSection(section);
        if (window.AndroidApp && targetPlayer === 'exoplayer') {
            state.currentPlayingStream = { item, section };
            const ext = getLiveStreamExt();
            const streamUrl = item.url || `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.${ext}`;
            resolveUrlWithDoH(streamUrl, true).then(resolvedUrl => {
                console.log("[Android TV] Playing Live TV via ExoPlayer:", resolvedUrl);
                window.AndroidApp.playStream(resolvedUrl, item.name, item.stream_icon || item.cover || "");
            });
            return;
        }

        if (window.AndroidApp && targetPlayer === 'vlc') {
            state.currentPlayingStream = { item, section };
            state.externalPlayerLaunched = true;
            const ext = getLiveStreamExt();
            const streamUrl = item.url || `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.${ext}`;
            resolveUrlWithDoH(streamUrl, true).then(resolvedUrl => {
                console.log("[Android TV] Playing Live TV via VLC Android App:", resolvedUrl);
                window.AndroidApp.openVlcPlayer(resolvedUrl);
            });
            return;
        }

        const isPlayerOpen = activeScreenId() === 'player-screen';
        const isMobile = (window.innerWidth <= 1024) && !window.AndroidApp && !isTvWrapper;
        const isMobileWeb = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.cordova && !window.AndroidApp;
        
        // If the stream is already playing in the preview panel, expand it directly to fullscreen instead of restarting
        const isPreviewing = state.currentPlayingStream && 
                             state.currentPlayingStream.section === 'live' && 
                             state.currentPlayingStream.item.stream_id === item.stream_id &&
                             document.getElementById("player-screen").classList.contains("preview-mode");
        
        if (isPreviewing) {
            if (typeof goFullscreenFromPreview === 'function') {
                goFullscreenFromPreview();
            }
            return;
        }
        
        if (isMobile || isPlayerOpen || (state.currentPlayingStream && state.currentPlayingStream.section === 'live' && state.currentPlayingStream.item.stream_id === item.stream_id)) {
            if (window.AndroidApp && targetPlayer === 'exoplayer_preview') {
                state.currentPlayingStream = { item, section };
                
                // Stop HTML5 preview playback
                destroyMpegtsPlayer();
                const video = document.getElementById("video-player");
                if (video) {
                    video.pause();
                    video.src = "";
                    try { video.load(); } catch(e){}
                }
                
                // Hide HTML5 player screen and reset preview panels
                const playerScreen = document.getElementById("player-screen");
                if (playerScreen) {
                    playerScreen.classList.remove("preview-mode");
                    playerScreen.classList.add("hidden");
                }
                const homeScreen = document.getElementById("home-screen");
                if (homeScreen) {
                    homeScreen.classList.remove("preview-open");
                }
                const previewPanel = document.getElementById("live-preview-panel");
                if (previewPanel) {
                    previewPanel.classList.add("hidden");
                }
                
                const ext = getLiveStreamExt();
                const streamUrl = item.url || `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.${ext}`;
                resolveUrlWithDoH(streamUrl, true).then(resolvedUrl => {
                    console.log("[Android TV] Playing Live TV via ExoPlayer (from grid click):", resolvedUrl);
                    state.exoplayerLaunchedForLive = true;
                    window.AndroidApp.playStream(resolvedUrl, item.name, item.stream_icon || item.cover || "");
                });
                return;
            }

            state.currentPlayingStream = { item, section };
            const ext = getLiveStreamExt();
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
    state.currentPlayingStream = { item, section };
    
    // On Android TV, use native player (ExoPlayer or VLC) based on VOD settings
    const targetPlayer = getPlayerForSection(section);
    if (window.AndroidApp) {
        if (targetPlayer === 'exoplayer') {
            const ext = (item.container_extension || "mp4").toLowerCase();
            const streamUrl = item.url || `${state.serverUrl}/movie/${state.username}/${state.password}/${item.stream_id}.${ext}`;
            resolveUrlWithDoH(streamUrl, false).then(resolvedUrl => {
                console.log("[Android TV] Playing VOD via ExoPlayer:", resolvedUrl);
                window.AndroidApp.playStream(resolvedUrl, item.name, item.stream_icon || item.cover || "");
            });
            return;
        } else if (targetPlayer === 'vlc') {
            state.externalPlayerLaunched = true;
            const ext = (item.container_extension || "mp4").toLowerCase();
            const streamUrl = item.url || `${state.serverUrl}/movie/${state.username}/${state.password}/${item.stream_id}.${ext}`;
            resolveUrlWithDoH(streamUrl, false).then(resolvedUrl => {
                console.log("[Android TV] Playing VOD via VLC Android App:", resolvedUrl);
                window.AndroidApp.openVlcPlayer(resolvedUrl);
            });
            return;
        }
    }
    
    // On Web, PC and Mobile Web, attempt to play HLS (.m3u8) format first to leverage
    // automatic server-side audio transcoding (e.g. AC-3/E-AC-3 to AAC) and browser container compatibility
    const preferHls = !isTvWrapper;
    state.tryingHlsFallback = preferHls;
    state.currentPlayingStreamName = item.name;
    state.currentPlayingStreamLogo = item.stream_icon || item.cover;
    
    const playExt = preferHls ? "m3u8" : (item.container_extension || "mp4").toLowerCase();
    const streamUrl = item.url || `${state.serverUrl}/movie/${state.username}/${state.password}/${item.stream_id}.${playExt}`;
    
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

function triggerDirectStreamFallback() {
    if (!state.currentPlayingStream) return;
    
    console.log("[Player] HLS playback failed. Falling back to direct stream format...");
    let originalExt = "mp4";
    if (state.currentPlayingStream.item) {
        originalExt = (state.currentPlayingStream.item.container_extension || "mp4").toLowerCase();
    }
    
    let fallbackUrl = "";
    if (state.currentPlayingStream.section === 'movies') {
        fallbackUrl = state.currentPlayingStream.item.url || `${state.serverUrl}/movie/${state.username}/${state.password}/${state.currentPlayingStream.item.stream_id}.${originalExt}`;
    } else if (state.currentPlayingStream.section === 'series') {
        fallbackUrl = state.currentPlayingStream.item.url || `${state.serverUrl}/series/${state.username}/${state.password}/${state.currentPlayingStream.item.id}.${originalExt}`;
    }
    
    if (fallbackUrl) {
        launchVideoPlayer(fallbackUrl, state.currentPlayingStreamName, state.currentPlayingStreamLogo);
    }
}

function handlePlaybackFallback(originalUrl, onFailCallback) {
    if (state.isDohEnabled && state.lastAttemptedStreamUrl === originalUrl) {
        console.warn("[Player] Stream failed using original URL. Retrying with DNS-over-HTTPS fallback...");
        state.lastAttemptedStreamUrl = ""; // prevent loop
        
        const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
        resolveUrlWithDoH(originalUrl, isLive).then(resolvedUrl => {
            if (resolvedUrl && resolvedUrl !== originalUrl) {
                console.log("[Player] DoH resolved fallback URL:", resolvedUrl);
                state.lastAttemptedStreamUrl = resolvedUrl;
                startPlayback(resolvedUrl, true);
            } else {
                console.log("[Player] DoH resolution did not yield a different URL.");
                if (typeof onFailCallback === 'function') onFailCallback();
            }
        }).catch(err => {
            console.error("[Player] DoH resolution failed during fallback:", err);
            if (typeof onFailCallback === 'function') onFailCallback();
        });
    } else {
        if (typeof onFailCallback === 'function') onFailCallback();
    }
}

async function fetchAndRewritePlaylist(playlistUrl) {
    try {
        const parsedUrl = new URL(playlistUrl);
        const originalHostname = parsedUrl.hostname;
        
        console.log("[Player] Fetching HLS playlist for rewriting:", playlistUrl);
        const response = await fetchWithFallback(playlistUrl);
        if (!response.ok) {
            if (response.status === 458) {
                throw new Error("HTTP 458 Limit Exceeded");
            }
            throw new Error(`Failed to fetch playlist: HTTP ${response.status}`);
        }
        const text = await response.text();
        
        const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
        const resolvedBaseUrl = await resolveUrlWithDoH(playlistUrl, isLive);
        const resolvedParsed = new URL(resolvedBaseUrl);
        const ipAddress = resolvedParsed.hostname;
        
        const lines = text.split(/\r?\n/);
        const rewrittenLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            
            try {
                const absoluteWithIp = new URL(trimmed, resolvedBaseUrl);
                if (absoluteWithIp.hostname === originalHostname) {
                    absoluteWithIp.hostname = ipAddress;
                }
                return absoluteWithIp.toString();
            } catch (e) {
                console.warn("[Player] Failed to rewrite line in playlist:", line, e);
                return line;
            }
        });
        
        const rewrittenText = rewrittenLines.join('\n');
        const blob = new Blob([rewrittenText], { type: 'application/x-mpegURL' });
        return URL.createObjectURL(blob);
    } catch (err) {
        console.error("[Player] fetchAndRewritePlaylist failed:", err);
        throw err;
    }
}

async function startPlayback(resolvedStreamUrl, isFallback = false) {
    destroyMpegtsPlayer();
    
    const video = document.getElementById("video-player");
    if (!video) return;
    
    const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
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
                lazyLoad: !isLive,
                lazyLoadMaxDuration: 3 * 60,
                seekType: 'range',
                autoCleanupSourceBuffer: true,
                autoCleanupMaxBackwardDuration: 2 * 60,
                autoCleanupMinBackwardDuration: 60,
                liveBufferLatencyChasing: false,
                liveBufferLatencyMaxLatency: 3.0,
                liveBufferLatencyMinRemain: 1.0,
                enableStashBuffer: !isLive
            });
            
            state.mpegtsPlayer.attachMediaElement(video);
            
            state.mpegtsPlayer.on(mpegts.Events.ERROR, (type, detail, info) => {
                console.warn(`[mpegts.js] Error: ${type}, ${detail}.`);
                if (info && info.code === 458) {
                    const t = TRANSLATIONS[state.language || 'en'];
                    const limitMsg = t.limitExceededError || "Trop de connexions simultanées sur votre compte. Veuillez fermer vos autres écrans.";
                    showPlayerError(limitMsg, false);
                    return;
                }
                handlePlaybackFallback(resolvedStreamUrl, () => {
                    if (!state.reconnectTimer) {
                        state.reconnectTimer = setTimeout(() => {
                            state.reconnectTimer = null;
                            attemptReconnection();
                        }, 2000);
                    }
                });
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
    } else if (resolvedStreamUrl.includes('.m3u8')) {
        let playUrl = resolvedStreamUrl;
        if (state.isDohEnabled) {
            try {
                playUrl = await fetchAndRewritePlaylist(resolvedStreamUrl);
                state.currentHlsBlobUrl = playUrl;
            } catch (err) {
                if (err.message && err.message.includes("HTTP 458 Limit Exceeded")) {
                    const t = TRANSLATIONS[state.language || 'en'];
                    const limitMsg = t.limitExceededError || "Trop de connexions simultanées sur votre compte. Veuillez fermer vos autres écrans.";
                    showPlayerError(limitMsg, false);
                    return;
                }
                console.warn("[Player] HLS playlist rewrite failed, falling back to original resolved URL:", err);
                playUrl = resolvedStreamUrl;
            }
        }
        
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            console.log("[Player] Initializing HLS.js for stream:", playUrl);
            state.hlsPlayer = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                liveDurationInfinity: isLive,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 10,
                backBufferLength: isLive ? 30 : undefined
            });
            state.hlsPlayer.attachMedia(video);
            state.hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, () => {
                state.hlsPlayer.loadSource(playUrl);
            });
            state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => {
                    console.warn("HLS Autoplay failed, trying muted...", e);
                    video.muted = true;
                    video.play().catch(err => {});
                });
            });
            state.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
                if (data.response && data.response.code === 458) {
                    const t = TRANSLATIONS[state.language || 'en'];
                    const limitMsg = t.limitExceededError || "Trop de connexions simultanées sur votre compte. Veuillez fermer vos autres écrans.";
                    showPlayerError(limitMsg, false);
                    return;
                }
                if (data.fatal) {
                    console.warn("Fatal Hls.js error:", data);
                    handlePlaybackFallback(resolvedStreamUrl, () => {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                if (state.tryingHlsFallback) {
                                    state.tryingHlsFallback = false;
                                    triggerDirectStreamFallback();
                                } else {
                                    state.hlsPlayer.startLoad();
                                }
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                state.hlsPlayer.recoverMediaError();
                                break;
                            default:
                                destroyMpegtsPlayer();
                                video.src = resolvedStreamUrl;
                                video.play().catch(e => {
                                    video.muted = true;
                                    video.play().catch(err => {});
                                });
                                break;
                        }
                    });
                }
            });
        } else {
            console.log("[Player] HLS.js not supported, falling back to native player:", playUrl);
            video.src = playUrl;
            video.load();
            video.play().catch(e => {
                console.warn("Native HLS Autoplay failed, trying muted...", e);
                video.muted = true;
                video.play().catch(err => {});
            });
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
}

function launchVideoPlayer(url, title, logoUrl) {
    const preservedStream = state.currentPlayingStream;
    state.currentPlayingStreamUrl = url;
    destroyPreviewMpegtsPlayer();
    state.currentPlayingStream = preservedStream;
    
    const section = state.currentPlayingStream ? state.currentPlayingStream.section : 'movies';
    const targetPlayer = getPlayerForSection(section);
    
    if ((targetPlayer === 'vlc' || targetPlayer === 'mpv') && !window.AndroidApp && !isTvWrapper) {
        if (window.electronAPI && window.electronAPI.isElectron) {
            // Show embedded container
            const vlcContainer = document.getElementById("vlc-embedded-container");
            if (vlcContainer) vlcContainer.classList.remove("hidden");
            
            // Hide standard video player and loader
            const video = document.getElementById("video-player");
            if (video) video.style.display = "none";
            const loader = document.getElementById("player-loader");
            if (loader) loader.style.display = "none";
            
            // Update control panel info
            document.getElementById("vlc-info-title").innerText = title;
            const vlcLogoImg = document.getElementById("vlc-info-logo");
            if (vlcLogoImg) {
                vlcLogoImg.style.display = "";
                if (typeof loadImageWithFallback === 'function') {
                    loadImageWithFallback(vlcLogoImg, logoUrl, "");
                } else {
                    vlcLogoImg.src = logoUrl || "";
                    vlcLogoImg.onerror = () => { vlcLogoImg.style.display = "none"; };
                }
            }
            
            const subtitleEl = document.getElementById("vlc-info-subtitle");
            const t = TRANSLATIONS[state.language || 'en'];
            if (state.currentPlayingStream && state.currentPlayingStream.section === 'series') {
                const season = state.currentPlayingStream.seasonNum || "1";
                const ep = state.currentPlayingStream.item;
                const epNum = ep.episode_num || ep.num || "";
                subtitleEl.innerText = `${t.seasonPrefix} ${season} - ${t.episodeLabelZap} ${epNum}`;
            } else {
                subtitleEl.innerText = "";
            }
            
            // Translate the help title based on active engine
            const helpTitleEl = document.querySelector("#vlc-embedded-container .vlc-help h3");
            if (helpTitleEl) {
                helpTitleEl.innerText = targetPlayer === 'vlc' ? "Contrôles VLC" : "Contrôles MPV";
            }

            // Display notice inside the dock element
            const engineLabel = targetPlayer === 'vlc' ? "VLC" : "MPV";
            const iconColor = targetPlayer === 'vlc' ? "#ff8800" : "#10b981"; // orange for VLC, green for MPV
            const playbackMsg = state.language === 'fr' 
                ? `Lecture en cours dans ${engineLabel} (Fenêtre Externe)` 
                : `Playback in progress in ${engineLabel} (External Window)`;
            const returnMsg = state.language === 'fr'
                ? `Le flux vidéo a été ouvert dans une fenêtre ${engineLabel} séparée.<br>Fermez ${engineLabel} ou cliquez ci-dessous pour retourner à l'application.`
                : `The video stream was opened in a separate ${engineLabel} window.<br>Close ${engineLabel} or click below to return to the application.`;
            const btnMsg = state.language === 'fr'
                ? "Retourner à l'application"
                : "Return to the application";

            const dockEl = document.getElementById("vlc-video-dock");
            if (dockEl) {
                dockEl.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #fff; text-align: center; gap: 1.5rem; padding: 2rem; background: #050811; border-radius: 12px; box-shadow: inset 0 0 50px rgba(0,0,0,0.8);">
                        <span class="material-icons" style="font-size: 80px; color: ${iconColor}; animation: pulse 2s infinite;">play_circle_outline</span>
                        <h2 style="margin: 0; font-size: 1.8rem; font-weight: 600; color: ${iconColor};">${playbackMsg}</h2>
                        <p style="margin: 0; color: #8a99ad; font-size: 1.1rem; max-width: 500px; line-height: 1.6;">
                            ${returnMsg}
                        </p>
                        <button class="focusable" id="vlc-external-btn-close" style="padding: 0.8rem 2rem; font-size: 1.1rem; border-radius: 10px; border: none; background: #ef4444; color: white; cursor: pointer; font-weight: 600; margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);">
                            <span class="material-icons">arrow_back</span>
                            <span>${btnMsg}</span>
                        </button>
                    </div>
                `;
            }
            
            const extBtnClose = document.getElementById("vlc-external-btn-close");
            if (extBtnClose) {
                extBtnClose.addEventListener("click", () => {
                    closeVideoPlayer();
                });
            }

            // Use the original container extension for external player instead of M3U8, since they have native codec support
            let targetUrl = url;
            if (state.currentPlayingStream && state.currentPlayingStream.item) {
                const originalExt = (state.currentPlayingStream.item.container_extension || "mp4").toLowerCase();
                const section = state.currentPlayingStream.section;
                const streamId = state.currentPlayingStream.item.stream_id || state.currentPlayingStream.item.id;
                targetUrl = `${state.serverUrl}/${section === 'series' ? 'series' : 'movie'}/${state.username}/${state.password}/${streamId}.${originalExt}`;
            }

            // Resolve the URL using DoH
            resolveUrlWithDoH(targetUrl, true).then(resolvedUrl => {
                console.log(`[${engineLabel}] Launching with DoH resolved URL:`, resolvedUrl);
                if (targetPlayer === 'vlc') {
                    window.electronAPI.dockVlc(resolvedUrl, { x: 0, y: 0, width: 0, height: 0 });
                } else {
                    window.electronAPI.playNative('mpv', resolvedUrl);
                }
            });
            return;
        }

        // Fallback for non-Electron web browsers (VLC:// launching)
        document.getElementById("player-channel-name").innerText = title;
        const playerLogoFallback = document.getElementById("player-channel-logo");
        if (playerLogoFallback) {
            playerLogoFallback.style.display = "";
            if (typeof loadImageWithFallback === 'function') {
                loadImageWithFallback(playerLogoFallback, logoUrl, "");
            } else {
                playerLogoFallback.src = logoUrl || "";
                playerLogoFallback.onerror = () => { playerLogoFallback.style.display = "none"; };
            }
        }
        document.getElementById("player-timeline-container").style.display = "none";
        
        const nowPlayingEl = document.getElementById("player-now-playing");
        const t = TRANSLATIONS[state.language || 'en'];
        if (state.currentPlayingStream && state.currentPlayingStream.section === 'series') {
            const season = state.currentPlayingStream.seasonNum || "1";
            const ep = state.currentPlayingStream.item;
            const epNum = ep.episode_num || ep.num || "";
            nowPlayingEl.innerText = `${t.seasonPrefix} ${season} - ${t.episodeLabelZap} ${epNum}`;
        } else {
            nowPlayingEl.innerText = "";
        }
        
        const msg = state.language === 'fr' 
            ? "Lancement automatique du flux dans VLC..." 
            : "Launching stream automatically in VLC...";
        
        showPlayerError(msg, true);
        
        // Update button text to Relaunch VLC
        const vlcLoaderBtnSpan = document.querySelector("#player-loader-vlc span:not(.material-icons)");
        if (vlcLoaderBtnSpan) {
            vlcLoaderBtnSpan.innerText = state.language === 'fr' ? "Relancer VLC" : "Relaunch VLC";
        }
        
        // Launch VLC immediately
        if (typeof window.launchVlc === 'function') {
            window.launchVlc();
        }
        return;
    }
    
    const isMobileWeb = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && 
                        window.location.protocol !== 'file:' && 
                        !window.cordova && 
                        !window.AndroidApp &&
                        !/SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent) && 
                        window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
    const isMobile = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && !isMobileWeb;
    const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
    const vlcLoaderBtn = document.getElementById("player-loader-vlc");
    if (vlcLoaderBtn) {
        if ((isMobile || isMobileWeb) && !isLive) {
            vlcLoaderBtn.classList.remove("hidden");
        } else {
            vlcLoaderBtn.classList.add("hidden");
        }
    }
    
    // Hide fullscreen button on TV mode/wrapper
    const fullscreenBtn = document.getElementById("player-btn-fullscreen");
    if (fullscreenBtn) {
        if (isTvWrapper || window.AndroidApp || document.body.classList.contains("tv-mode")) {
            fullscreenBtn.style.display = "none";
        } else {
            fullscreenBtn.style.display = "";
        }
    }
    
    showScreen("player-screen");
    const video = document.getElementById("video-player");
    const playerLoader = document.getElementById("player-loader");

    if (video) {
        video.setAttribute("poster", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
        video.classList.remove("video-active");
    }
    
    document.getElementById("player-channel-name").innerText = title;
    const resolvedLogoUrl = logoUrl || "";
    const channelLogoImg = document.getElementById("player-channel-logo");
    if (channelLogoImg) {
        channelLogoImg.style.display = "";
        if (typeof loadImageWithFallback === 'function') {
            loadImageWithFallback(channelLogoImg, resolvedLogoUrl, "");
            const originalOnerror = channelLogoImg.onerror;
            channelLogoImg.onerror = () => {
                if (typeof originalOnerror === 'function') originalOnerror();
                if (!channelLogoImg.src || channelLogoImg.src.endsWith('/') || channelLogoImg.src.includes('weserv.nl') === false) {
                    channelLogoImg.style.display = "none";
                }
            };
        } else {
            let triedDoh = false;
            channelLogoImg.onerror = () => {
                if (!triedDoh && state.isDohEnabled && typeof resolveUrlWithDoHSync === 'function') {
                    triedDoh = true;
                    const resolvedUrl = resolveUrlWithDoHSync(resolvedLogoUrl);
                    if (resolvedUrl && resolvedUrl !== resolvedLogoUrl) {
                        channelLogoImg.src = resolvedUrl;
                        return;
                    }
                }
                channelLogoImg.style.display = "none";
            };
            channelLogoImg.src = resolvedLogoUrl;
        }
    }
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
    
    state.playbackStarted = false;
    clearLoadingTimeout();
    if (isLive) {
        startLoadingTimeout();
    }
    
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
    
    if (state.isDohEnabled && typeof resolveUrlWithDoH === 'function') {
        resolveUrlWithDoH(url, isLive).then(resolvedUrl => {
            state.lastAttemptedStreamUrl = resolvedUrl;
            startPlayback(resolvedUrl, false);
        }).catch(err => {
            console.warn("[Player] DoH resolution failed, using original url:", err);
            state.lastAttemptedStreamUrl = url;
            startPlayback(url, false);
        });
    } else {
        state.lastAttemptedStreamUrl = url;
        startPlayback(url, false);
    }
    
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
        video.classList.remove("video-active");
        if (isLive && state.playbackStarted && !state.reconnectTimer) {
            state.reconnectTimer = setTimeout(() => {
                state.reconnectTimer = null;
                attemptReconnection();
            }, 8000);
        }
    };
    video.onplaying = () => { 
        playerLoader.style.display = "none"; 
        video.classList.add("video-active");
        
        state.playbackStarted = true;
        clearLoadingTimeout();
        
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
            state.reconnectTimer = null;
        }
        state.reconnectAttempts = 0;
        
        const loaderText = playerLoader.querySelector(".player-loader-text");
        if (loaderText) {
            loaderText.innerText = t.playerLoaderText || "Chargement du flux...";
        }
        startWatchdog();
    };
    video.onplay = () => {
        const icon = document.getElementById("player-icon-play");
        if (icon) icon.innerText = "pause";
    };
    video.onpause = () => {
        const icon = document.getElementById("player-icon-play");
        if (icon) icon.innerText = "play_arrow";
        video.classList.remove("video-active");
        stopWatchdog();
    };
    video.onended = () => {
        if (isLive) {
            console.warn("[Player] Live stream ended unexpectedly. Reconnecting...");
            attemptReconnection();
        }
    };
    video.onerror = () => {
        video.classList.remove("video-active");
        stopWatchdog();
        let errDetail = "";
        if (video.error) {
            errDetail = ` (Code ${video.error.code}: ${video.error.message || ''})`;
        }
        
        handlePlaybackFallback(state.currentPlayingStreamUrl, () => {
            triggerStandardError();
        });
        
        function triggerStandardError() {
            // HLS fallback logic if the .m3u8 request failed
            if (state.tryingHlsFallback) {
                state.tryingHlsFallback = false;
                console.log("[Player] HLS playback failed natively/network. Falling back to direct stream...");
                triggerDirectStreamFallback();
                return;
            }
            
            if (isLive) {
                const isMobileWeb = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && 
                                    window.location.protocol !== 'file:' && 
                                    !window.cordova && 
                                    !window.AndroidApp &&
                                    !/SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent) && 
                                    window.location.hostname !== 'localhost' && 
                                    window.location.hostname !== '127.0.0.1';
                const isCode4 = video.error && video.error.code === 4;
                const currentSrc = video.src || "";
                const isTsStream = (currentSrc.includes('.ts') || currentSrc.includes('/live/')) && !currentSrc.includes('.m3u8');
                
                // If it's a completely unsupported format (e.g. error code 4), show player error immediately instead of reconnecting.
                if (isCode4) {
                    console.warn("[Player] Unsupported format on live stream. Showing error immediately.");
                    let ext = isTsStream ? "TS" : "M3U8";
                    let errorMsg;
                    if (state.language === 'fr') {
                        errorMsg = `Ce format de flux (${ext}) n'est pas supporté par votre navigateur.`;
                    } else {
                        errorMsg = `This stream format (${ext}) is not supported by your browser.`;
                    }
                    showPlayerError(errorMsg, false);
                    return;
                }
                
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
                                    !window.AndroidApp &&
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
                            errorMsg = `Ce format de flux (${ext.toUpperCase()}) n'est pas supporté par votre navigateur mobile. Vous pouvez tenter de l'ouvrir directement dans l'application VLC.`;
                        } else {
                            errorMsg = `This stream format (${ext.toUpperCase()}) is not supported by your mobile browser. You can try to open it directly in the VLC app.`;
                        }
                        showPlayerError(errorMsg, true);
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
    
    // Cleanly halt video playback and clear background reconnect/loading timers
    destroyMpegtsPlayer();
    if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
    }
    const video = document.getElementById("video-player");
    if (video) {
        try {
            video.pause();
            video.removeAttribute("src");
            video.load();
        } catch(e) {}
    }
    
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
        
        const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
        const vlcLoaderBtn = document.getElementById("player-loader-vlc");
        if (vlcLoaderBtn) {
            if (showVlc && !isLive) {
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
        video.classList.remove("video-active");
    };
    video.onplaying = () => { 
        if (loader) loader.classList.add("hidden"); 
        if (playerLoader) playerLoader.style.display = "none";
        video.classList.add("video-active");
        state.reconnectAttempts = 0; // reset reconnect attempts upon successful play
        startWatchdog();
    };
    video.onended = () => {
        const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
        if (isLive) {
            console.warn("[Preview] Live preview stream ended unexpectedly. Reconnecting...");
            attemptReconnection();
        }
    };
    video.onerror = () => {
        if (loader) loader.classList.add("hidden");
        if (playerLoader) playerLoader.style.display = "none";
        video.classList.remove("video-active");
        console.warn("[Preview] Error playing preview stream");
        stopWatchdog();
    };
    video.onplay = null;
    video.onpause = () => {
        stopWatchdog();
    };
    video.ontimeupdate = null;
}

function startWatchdog() {
    stopWatchdog();
    
    const video = document.getElementById("video-player");
    if (!video) return;
    
    state.lastPlayTime = video.currentTime;
    state.frozenSeconds = 0;
    state.watchdogTimer = setInterval(() => {
        const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
        if (!isLive) {
            stopWatchdog();
            return;
        }
        
        if (!video.paused && !video.ended) {
            if (video.currentTime === state.lastPlayTime) {
                state.frozenSeconds = (state.frozenSeconds || 0) + 5;
                const maxFrozen = video.currentTime > 0 ? 5 : 15;
                if (state.frozenSeconds >= maxFrozen) {
                    console.warn("[Watchdog] Playback frozen or stuck loading for", state.frozenSeconds, "seconds at time", video.currentTime, "- initiating reconnect.");
                    state.frozenSeconds = 0;
                    attemptReconnection();
                }
            } else {
                state.lastPlayTime = video.currentTime;
                state.frozenSeconds = 0;
            }
        }
    }, 5000);
}

function stopWatchdog() {
    if (state.watchdogTimer) {
        clearInterval(state.watchdogTimer);
        state.watchdogTimer = null;
    }
}

function startLoadingTimeout() {
    clearLoadingTimeout();
    console.log("[Player] Starting loading timeout...");
    state.loadingTimeout = setTimeout(() => {
        if (!state.playbackStarted) {
            console.warn("[Player] Stream loading timed out (15s) without playing. Reconnecting...");
            attemptReconnection();
        }
    }, 15000); // 15 seconds
}

function clearLoadingTimeout() {
    if (state.loadingTimeout) {
        console.log("[Player] Clearing loading timeout");
        clearTimeout(state.loadingTimeout);
        state.loadingTimeout = null;
    }
}

function destroyMpegtsPlayer() {
    clearLoadingTimeout();
    state.playbackStarted = false;
    if (state.reconnectDelayTimer) {
        clearTimeout(state.reconnectDelayTimer);
        state.reconnectDelayTimer = null;
    }
    if (window.AndroidApp && typeof window.AndroidApp.stopPreview === 'function') {
        window.AndroidApp.stopPreview();
    }
    if (state.currentHlsBlobUrl) {
        console.log("[Player] Revoking previous HLS playlist blob URL:", state.currentHlsBlobUrl);
        try {
            URL.revokeObjectURL(state.currentHlsBlobUrl);
        } catch (e) {}
        state.currentHlsBlobUrl = null;
    }
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
    stopWatchdog();
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
    
    state.playbackStarted = false;
    startLoadingTimeout();
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
    
    let url = state.currentPlayingStreamUrl;
    
    // Auto-fallback: swap between .ts and .m3u8 after 2 failed attempts to bypass format support limitations on some streams
    if (state.reconnectAttempts >= 2 && url) {
        if (url.includes('.ts')) {
            console.log("[Player] Reconnection failing with TS stream, attempting HLS (.m3u8) fallback...");
            url = url.replace('.ts', '.m3u8');
            state.currentPlayingStreamUrl = url;
        } else if (url.includes('.m3u8')) {
            console.log("[Player] Reconnection failing with HLS stream, attempting TS (.ts) fallback...");
            url = url.replace('.m3u8', '.ts');
            state.currentPlayingStreamUrl = url;
        }
    }
    
    const video = document.getElementById("video-player");
    
    destroyMpegtsPlayer();
    video.removeAttribute("src");
    video.classList.remove("video-active");
    try { video.load(); } catch(e){}
    
    if (state.reconnectDelayTimer) {
        clearTimeout(state.reconnectDelayTimer);
        state.reconnectDelayTimer = null;
    }

    const reconnectDelay = Math.min(1000 * state.reconnectAttempts, 8000);
    console.log(`[Player] Reconnection scheduled in ${reconnectDelay}ms (attempt ${state.reconnectAttempts})`);
    
    state.reconnectDelayTimer = setTimeout(() => {
        state.reconnectDelayTimer = null;
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
                        lazyLoad: false, // Disable lazy loading for live streams to prevent connection cutoff
                        lazyLoadMaxDuration: 3 * 60,
                        seekType: 'range',
                        autoCleanupSourceBuffer: true,
                        autoCleanupMaxBackwardDuration: 2 * 60,
                        autoCleanupMinBackwardDuration: 60,
                        liveBufferLatencyChasing: false,
                        liveBufferLatencyMaxLatency: 3.0,
                        liveBufferLatencyMinRemain: 1.0,
                        enableStashBuffer: false // Disable stash buffer for live streams to prevent connection cutoff
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
            } else if (resolvedStreamUrl.includes('.m3u8')) {
                if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    console.log("[Player] Initializing HLS.js for stream in reconnection:", resolvedStreamUrl);
                    state.hlsPlayer = new Hls({
                        enableWorker: true,
                        lowLatencyMode: false,
                        liveDurationInfinity: true,
                        liveSyncDurationCount: 3,
                        liveMaxLatencyDurationCount: 10,
                        backBufferLength: 30
                    });
                    state.hlsPlayer.attachMedia(video);
                    state.hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, () => {
                        state.hlsPlayer.loadSource(resolvedStreamUrl);
                    });
                    state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
                        video.play().catch(e => {
                            console.warn("HLS Autoplay failed in reconnect, trying muted...", e);
                            video.muted = true;
                            video.play().catch(err => {});
                        });
                    });
                    state.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
                        if (data.fatal) {
                            switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    console.warn("Fatal network error in Hls.js on reconnect, retrying...");
                                    state.hlsPlayer.startLoad();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    console.warn("Fatal media error in Hls.js on reconnect, recovering...");
                                    state.hlsPlayer.recoverMediaError();
                                    break;
                                default:
                                    console.error("Fatal Hls.js error on reconnect:", data);
                                    destroyMpegtsPlayer();
                                    video.src = resolvedStreamUrl;
                                    video.play().catch(e => {});
                                    break;
                            }
                        }
                    });
                } else {
                    console.log("[Player] HLS.js not supported on reconnect, falling back to native player:", resolvedStreamUrl);
                    video.src = resolvedStreamUrl;
                    video.load();
                    video.play().catch(e => {});
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
    }, reconnectDelay);
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
    
    const homeScreen = document.getElementById("home-screen");
    if (homeScreen) {
        homeScreen.classList.add("preview-open");
    }
    
    updatePreviewVideoPosition();
    
    // Multiple layout updates to guarantee positioning matches container dimensions after reflow
    setTimeout(updatePreviewVideoPosition, 100);
    setTimeout(updatePreviewVideoPosition, 300);
    setTimeout(updatePreviewVideoPosition, 500);
    setTimeout(updatePreviewVideoPosition, 800);
    
    destroyMpegtsPlayer();
    
    if (loader) loader.classList.remove("hidden");
    if (playerLoader) playerLoader.style.display = "flex";
    
    const previewExt = getLiveStreamExt();
    const streamUrl = item.url || `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.${previewExt}`;
    
    resolveUrlWithDoH(streamUrl, true).then(async resolvedUrl => {
        if (window.AndroidApp && typeof window.AndroidApp.startPreview === 'function') {
            const container = document.getElementById("preview-video-container") || video;
            const rect = container.getBoundingClientRect();
            if (loader) loader.classList.add("hidden");
            if (playerLoader) playerLoader.style.display = "none";
            console.log("[Preview] Starting native ExoPlayer preview:", resolvedUrl, rect);
            window.AndroidApp.startPreview(resolvedUrl, rect.left, rect.top, rect.width, rect.height);
            return;
        }
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
                    lazyLoad: false, // Disable lazy loading for live streams to prevent connection cutoff
                    lazyLoadMaxDuration: 30,
                    seekType: 'range',
                    autoCleanupSourceBuffer: true,
                    autoCleanupMaxBackwardDuration: 20,
                    autoCleanupMinBackwardDuration: 10,
                    liveBufferLatencyChasing: false,
                    liveBufferLatencyMaxLatency: 3.0,
                    liveBufferLatencyMinRemain: 1.0,
                    enableStashBuffer: false // Disable stash buffer for live streams to prevent connection cutoff
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
                    if (info && info.code === 458) {
                        const t = TRANSLATIONS[state.language || 'en'];
                        showToast(t.limitExceededError || "Trop de connexions simultanées sur votre compte.", 5000);
                        destroyMpegtsPlayer();
                        const previewPanel = document.getElementById("live-preview-panel");
                        if (previewPanel) previewPanel.classList.add("hidden");
                        const homeScreen = document.getElementById("home-screen");
                        if (homeScreen) homeScreen.classList.remove("preview-open");
                        playerScreen.classList.add("hidden");
                    }
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
        } else if (resolvedUrl.includes('.m3u8')) {
            let playUrl = resolvedUrl;
            if (state.isDohEnabled) {
                try {
                    playUrl = await fetchAndRewritePlaylist(resolvedUrl);
                    state.currentHlsBlobUrl = playUrl;
                } catch (err) {
                    if (err.message && err.message.includes("HTTP 458 Limit Exceeded")) {
                        const t = TRANSLATIONS[state.language || 'en'];
                        showToast(t.limitExceededError || "Trop de connexions simultanées sur votre compte.", 5000);
                        destroyMpegtsPlayer();
                        const previewPanel = document.getElementById("live-preview-panel");
                        if (previewPanel) previewPanel.classList.add("hidden");
                        const homeScreen = document.getElementById("home-screen");
                        if (homeScreen) homeScreen.classList.remove("preview-open");
                        playerScreen.classList.add("hidden");
                        return;
                    }
                    console.warn("[Preview] HLS playlist rewrite failed, falling back to original resolved URL:", err);
                    playUrl = resolvedUrl;
                }
            }
            
            if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                console.log("[Preview] Initializing HLS.js for preview:", playUrl);
                state.hlsPlayer = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                    liveDurationInfinity: true,
                    liveSyncDurationCount: 3,
                    liveMaxLatencyDurationCount: 10,
                    backBufferLength: 30
                });
                state.hlsPlayer.attachMedia(video);
                state.hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, () => {
                    state.hlsPlayer.loadSource(playUrl);
                });
                state.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.muted = false;
                    video.play().catch(e => {
                        console.warn("[Preview] HLS Autoplay failed, trying muted...", e);
                        video.muted = true;
                        video.play().catch(err => {});
                    });
                });
                state.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
                    if (data.response && data.response.code === 458) {
                        const t = TRANSLATIONS[state.language || 'en'];
                        showToast(t.limitExceededError || "Trop de connexions simultanées sur votre compte.", 5000);
                        destroyMpegtsPlayer();
                        const previewPanel = document.getElementById("live-preview-panel");
                        if (previewPanel) previewPanel.classList.add("hidden");
                        const homeScreen = document.getElementById("home-screen");
                        if (homeScreen) homeScreen.classList.remove("preview-open");
                        playerScreen.classList.add("hidden");
                        return;
                    }
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                state.hlsPlayer.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                state.hlsPlayer.recoverMediaError();
                                break;
                            default:
                                destroyMpegtsPlayer();
                                video.src = resolvedUrl;
                                video.play().catch(e => {});
                                break;
                        }
                    }
                });
            } else {
                console.log("[Preview] HLS.js not supported, falling back to native player:", playUrl);
                video.src = playUrl;
                video.muted = false;
                video.load();
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

        // Sync native preview layout coordinates
        if (window.AndroidApp && typeof window.AndroidApp.updatePreviewPosition === 'function') {
            window.AndroidApp.updatePreviewPosition(rect.left, rect.top, rect.width, rect.height);
        }
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
    
    if (window.AndroidApp && state.playerSettings && state.playerSettings.live === 'exoplayer_preview') {
        console.log("[Android TV] Going fullscreen with native ExoPlayer");
        window.AndroidApp.goFullscreen();
        return;
    }
    
    console.log("[Player] Transitioning from preview to fullscreen");
    
    playerScreen.classList.remove("preview-mode");
    updatePreviewVideoPosition();
    
    showScreen("player-screen");
    
    const item = state.currentPlayingStream.item;
    document.getElementById("player-channel-name").innerText = item.name;
    const fsLogoImg = document.getElementById("player-channel-logo");
    if (fsLogoImg) {
        fsLogoImg.style.display = "";
        if (typeof loadImageWithFallback === 'function') {
            loadImageWithFallback(fsLogoImg, item.stream_icon || item.cover, "");
            const originalOnerror = fsLogoImg.onerror;
            fsLogoImg.onerror = () => {
                if (typeof originalOnerror === 'function') originalOnerror();
                if (!fsLogoImg.src || fsLogoImg.src.endsWith('/') || fsLogoImg.src.includes('weserv.nl') === false) {
                    fsLogoImg.style.display = "none";
                }
            };
        } else {
            fsLogoImg.src = item.stream_icon || item.cover || "";
            fsLogoImg.onerror = () => { fsLogoImg.style.display = "none"; };
        }
    }
    
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
            video.classList.add("video-active");
        } else {
            playerLoader.style.display = "flex";
            video.classList.remove("video-active");
        }
    }
    
    resetPlayerActivity();
}

window.onAndroidExitFullscreen = function() {
    console.log("[Android TV] Native ExoPlayer exited fullscreen. Syncing layout...");
    const playerScreen = document.getElementById("player-screen");
    if (playerScreen) {
        playerScreen.classList.add("preview-mode");
        updatePreviewVideoPosition();
    }
};

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
    if (video) {
        if (isReady) {
            video.classList.add("video-active");
        } else {
            video.classList.remove("video-active");
        }
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
    destroyMpegtsPlayer();
    
    const video = document.getElementById("video-player");
    if (video) {
        video.pause();
        video.removeAttribute("src");
        video.classList.remove("video-active");
        try { video.load(); } catch(e){}
    }
    
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
    // Undock VLC and stop process if Electron
    if (window.electronAPI && window.electronAPI.isElectron) {
        window.electronAPI.undockVlc();
        if (typeof window.electronAPI.stopNative === 'function') {
            window.electronAPI.stopNative();
        }
        if (window.vlcResizeHandler) {
            window.removeEventListener("resize", window.vlcResizeHandler);
            window.vlcResizeHandler = null;
        }
        const vlcContainer = document.getElementById("vlc-embedded-container");
        if (vlcContainer) vlcContainer.classList.add("hidden");
        const videoEl = document.getElementById("video-player");
        if (videoEl) videoEl.style.display = "";
        const loaderEl = document.getElementById("player-loader");
        if (loaderEl) loaderEl.style.display = "";
    }

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
            const btnSpan = vlcLoaderBtn.querySelector("span:not(.material-icons)");
            if (btnSpan) {
                const t = TRANSLATIONS[state.language || 'en'];
                btnSpan.innerText = t.vlcBtnText || "Ouvrir dans VLC";
            }
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
    
    const wasLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
    const liveItem = wasLive ? state.currentPlayingStream.item : null;
    const isMobile = (window.innerWidth <= 1024) && !window.AndroidApp && !isTvWrapper;
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
    
    const isSeries = state.currentPlayingStream && state.currentPlayingStream.section === 'series';
    if (isSeries) {
        showScreen("series-details-screen");
    } else {
        showScreen("home-screen");
    }
    
    state.currentPlayingStream = null;
    
    let fallbackElement = isSeries ? state.lastFocusedSeriesDetailsElement : state.lastFocusedHomeElement;
    if (!fallbackElement) fallbackElement = state.lastFocusedElement;
    
    if (fallbackElement && document.body.contains(fallbackElement) && fallbackElement.offsetWidth > 0) {
        fallbackElement.focus();
        fallbackElement.scrollIntoView({ block: 'nearest' });
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
    const video = document.getElementById("video-player");
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        try {
            const container = document.getElementById("player-screen") || document.documentElement;
            if (container.requestFullscreen) {
                container.requestFullscreen().catch(err => {
                    console.error(`Error entering fullscreen: ${err.message}`);
                });
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (video && video.webkitEnterFullscreen) {
                console.log("[Player] Falling back to webkitEnterFullscreen for iOS Safari");
                video.webkitEnterFullscreen();
            }
        } catch (err) {
            console.error(`Error entering fullscreen: ${err.message}`);
        }
    } else {
        try {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => console.error(err));
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
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
                
                // On Android TV, use native player (ExoPlayer or VLC) based on settings
                const targetPlayer = getPlayerForSection('series');
                if (window.AndroidApp) {
                    if (targetPlayer === 'exoplayer') {
                        resolveUrlWithDoH(playUrl, false).then(resolvedUrl => {
                            console.log("[Android TV] Playing series (zap) via ExoPlayer:", resolvedUrl);
                            window.AndroidApp.playStream(resolvedUrl, displayTitle, state.currentSeriesDetails.info.cover || "");
                        });
                        return;
                    } else if (targetPlayer === 'vlc') {
                        state.externalPlayerLaunched = true;
                        resolveUrlWithDoH(playUrl, false).then(resolvedUrl => {
                            console.log("[Android TV] Playing series (zap) via VLC Android App:", resolvedUrl);
                            window.AndroidApp.openVlcPlayer(resolvedUrl);
                        });
                        return;
                    }
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
            const logoUrl = item.stream_icon || item.cover || (section === 'live' ? PLACEHOLDERS.live : PLACEHOLDERS.vod);
            const defaultPoster = section === 'live' ? PLACEHOLDERS.live : PLACEHOLDERS.vod;
            if (typeof loadImageWithFallback === 'function') {
                loadImageWithFallback(img, logoUrl, defaultPoster);
            } else {
                img.src = logoUrl;
                img.onerror = () => { img.src = defaultPoster; };
            }
            
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
