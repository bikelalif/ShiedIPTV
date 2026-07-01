// Initial Setup on Load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

function initApp() {
    // Re-initialize player settings dropdowns now that native interfaces are injected
    if (typeof initPlayerSettingsDropdowns === 'function') {
        try {
            initPlayerSettingsDropdowns(state.language);
        } catch (e) {
            console.error("Error in early initPlayerSettingsDropdowns:", e);
        }
    }

    try {
        if (isTvWrapper) {
            document.body.classList.add("tv-mode");
        }
        
        // Add is-webapp class if running as a hosted web page (not packaged local file/app)
        const isWebappOnly = (window.location.protocol === 'http:' || window.location.protocol === 'https:') && 
                             !/SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent) &&
                             !/Electron/i.test(navigator.userAgent);
        if (isWebappOnly) {
            document.body.classList.add("is-webapp");
        }
        
        try {
            setupEventListeners();
        } catch (e) {
            console.error("Error in setupEventListeners:", e);
        }
        
        try {
            setupSpatialNavigation();
        } catch (e) {
            console.error("Error in setupSpatialNavigation:", e);
        }
        
        try {
            initTvInputs();
        } catch (e) {
            console.error("Error in initTvInputs:", e);
        }

        try {
            const video = document.getElementById("video-player");
            if (video) {
                video.addEventListener('leavepictureinpicture', () => {
                    console.log("[PiP] Exited Picture-in-Picture. Requesting window focus...");
                    if (window.electronAPI && typeof window.electronAPI.focusWindow === 'function') {
                        window.electronAPI.focusWindow();
                    }
                });
            }
        } catch (e) {
            console.error("Error in video PiP listener setup:", e);
        }
        
        // Restore settings
        const savedSettings = safeStorage.local.getItem("shield_iptv_settings");
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                state.bypassMode = settings.bypassMode || 'doh';
                state.isDohEnabled = (state.bypassMode !== 'none');
                state.dohResolver = settings.dohResolver || 'https://dns.google/resolve';
                
                if (typeof window.applyBypassModeUI === 'function') {
                    window.applyBypassModeUI(state.bypassMode);
                }
                const urlEl = document.getElementById("setting-doh-url");
                if (urlEl) urlEl.value = state.dohResolver;

                const isAndroid = !!(window.AndroidApp || (typeof navigator !== 'undefined' && /Android|GoogleTV|AndroidTV|FireTV/i.test(navigator.userAgent)));
                const isElectron = !!(window.electronAPI && window.electronAPI.isElectron);
                if (settings.playerSettings) {
                    state.playerSettings = {
                        live: settings.playerSettings.live || (isAndroid ? 'exoplayer_preview' : 'html5'),
                        liveFormat: settings.playerSettings.liveFormat || 'ts',
                        movies: settings.playerSettings.movies || (isElectron ? 'mpv' : (isAndroid ? 'exoplayer' : 'html5')),
                        series: settings.playerSettings.series || (isElectron ? 'mpv' : (isAndroid ? 'exoplayer' : 'html5'))
                    };
                    
                    // Force Android TV defaults if they are set to incompatible 'html5' or if they are missing
                    if (isAndroid) {
                        if (!state.playerSettings.live || state.playerSettings.live === 'html5') {
                            state.playerSettings.live = 'exoplayer_preview';
                        }
                        if (!state.playerSettings.movies || state.playerSettings.movies === 'html5') {
                            state.playerSettings.movies = 'exoplayer';
                        }
                        if (!state.playerSettings.series || state.playerSettings.series === 'html5') {
                            state.playerSettings.series = 'exoplayer';
                        }
                    }
                } else {
                    state.playerSettings = {
                        live: isAndroid ? 'exoplayer_preview' : 'html5',
                        liveFormat: 'ts',
                        movies: isElectron ? 'mpv' : (isAndroid ? 'exoplayer' : 'html5'),
                        series: isElectron ? 'mpv' : (isAndroid ? 'exoplayer' : 'html5')
                    };
                }
                
                // Update dropdown values in DOM if they exist
                const playerLiveEl = document.getElementById("setting-player-live");
                if (playerLiveEl) playerLiveEl.value = state.playerSettings.live;
                const playerLiveFormatEl = document.getElementById("setting-player-live-format");
                if (playerLiveFormatEl) playerLiveFormatEl.value = state.playerSettings.liveFormat || 'ts';
                const playerMoviesEl = document.getElementById("setting-player-movies");
                if (playerMoviesEl) playerMoviesEl.value = state.playerSettings.movies;
                const playerSeriesEl = document.getElementById("setting-player-series");
                if (playerSeriesEl) playerSeriesEl.value = state.playerSettings.series;
            } catch (e) {
                console.error("Error reading settings", e);
            }
        }
        
        // Detect and apply initial language
        try {
            const initialLang = detectLanguage();
            applyLanguage(initialLang);
        } catch (e) {
            console.error("Error applying language:", e);
        }
        
        const loginDoh = document.getElementById("login-doh-toggle");
        if (loginDoh) loginDoh.checked = state.isDohEnabled;

        // Show intro screen and setup transitions after 1.8 seconds
        showScreen("intro-screen");
        
        setTimeout(() => {
            try {
                const cguAccepted = safeStorage.local.getItem("shield_cgu_accepted") === "true";
                if (!cguAccepted) {
                    showScreen("playlist-manager-screen");
                    
                    const actionsContainer = document.getElementById("cgu-actions-container");
                    const closeBtn = document.getElementById("btn-cgu-close");
                    if (actionsContainer) actionsContainer.classList.remove("hidden");
                    if (closeBtn) closeBtn.classList.add("hidden");
                    
                    const modal = document.getElementById("cgu-modal");
                    if (modal) modal.classList.remove("hidden");
                } else {
                    proceedAfterCgu();
                }
            } catch (transitionErr) {
                console.error("Error during intro screen transition:", transitionErr);
                // Fallback to playlist manager in case of transition failure
                showScreen("playlist-manager-screen");
                if (typeof renderPlaylistsGrid === 'function') {
                    renderPlaylistsGrid();
                }
            }
        }, 1800);
    } catch (criticalErr) {
        console.error("Critical error in initApp:", criticalErr);
        if (window.onerror) {
            window.onerror(criticalErr.message, "main.js", 8, 0, criticalErr);
        }
    }
}

function proceedAfterCgu() {
    try {
        safeStorage.session.setItem("shield_session_active", "true");
        
        const activePlaylistId = safeStorage.local.getItem("shield_active_playlist_id");
        if (activePlaylistId) {
            const playlists = loadSavedPlaylists();
            const activePlaylist = Array.isArray(playlists) ? playlists.find(p => p && p.id === activePlaylistId) : null;
            if (activePlaylist) {
                const t = TRANSLATIONS[state.language || 'en'];
                showLoader(t.toastLoginAuth || "Connexion...");
                
                // Allow DOM paint tick to show the spinner before starting heavy connection logic
                setTimeout(() => {
                    try {
                        // Clear last screen states so we always open in the main menu (portal-screen) on startup!
                        safeStorage.local.removeItem("shield_last_screen");
                        safeStorage.local.removeItem("shield_last_section");
                        safeStorage.local.removeItem("shield_last_category_id");
                        safeStorage.local.removeItem("shield_last_series_id");
                        
                        connectPlaylist(activePlaylist, true);
                    } catch (connErr) {
                        console.error("Failed to connect playlist on start:", connErr);
                        showScreen("playlist-manager-screen");
                        if (typeof renderPlaylistsGrid === 'function') {
                            renderPlaylistsGrid();
                        }
                    }
                }, 50);
            } else {
                showScreen("playlist-manager-screen");
                if (typeof renderPlaylistsGrid === 'function') {
                    renderPlaylistsGrid();
                }
            }
        } else {
            showScreen("playlist-manager-screen");
            if (typeof renderPlaylistsGrid === 'function') {
                renderPlaylistsGrid();
            }
        }
    } catch (e) {
        console.error("Error in proceedAfterCgu:", e);
        showScreen("playlist-manager-screen");
        if (typeof renderPlaylistsGrid === 'function') {
            renderPlaylistsGrid();
        }
    }
}

// UI Interaction Handlers
function setupEventListeners() {
    // Playlist Manager Actions
    const btnQuickDemo = document.getElementById("btn-quick-demo");
    if (btnQuickDemo) {
        btnQuickDemo.addEventListener("click", () => {
            const demoPlaylist = {
                id: 'demo',
                name: 'Playlist Démo (Flux publics)',
                type: 'demo',
                readonly: true
            };
            connectPlaylist(demoPlaylist);
        });
    }

    const btnViewCgu = document.getElementById("btn-view-cgu");
    if (btnViewCgu) {
        btnViewCgu.addEventListener("click", () => {
            const actionsContainer = document.getElementById("cgu-actions-container");
            const closeBtn = document.getElementById("btn-cgu-close");
            if (actionsContainer) actionsContainer.classList.add("hidden");
            if (closeBtn) closeBtn.classList.remove("hidden");
            
            const modal = document.getElementById("cgu-modal");
            if (modal) modal.classList.remove("hidden");
        });
    }

    const btnCguClose = document.getElementById("btn-cgu-close");
    if (btnCguClose) {
        btnCguClose.addEventListener("click", () => {
            const modal = document.getElementById("cgu-modal");
            if (modal) modal.classList.add("hidden");
        });
    }

    const btnCguAccept = document.getElementById("btn-cgu-accept");
    if (btnCguAccept) {
        btnCguAccept.addEventListener("click", (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            safeStorage.local.setItem("shield_cgu_accepted", "true");
            
            // 150ms delay to prevent click-through onto the "Terms & Conditions" button underneath
            setTimeout(() => {
                const modal = document.getElementById("cgu-modal");
                if (modal) modal.classList.add("hidden");
                proceedAfterCgu();
            }, 150);
        });
    }

    const btnCguDecline = document.getElementById("btn-cgu-decline");
    if (btnCguDecline) {
        btnCguDecline.addEventListener("click", () => {
            if (window.close) {
                window.close();
            }
            const declineMsg = {
                fr: "Vous devez accepter les conditions d'utilisation pour accéder à l'application.",
                en: "You must accept the terms of use to access the application.",
                es: "Debe aceptar las condiciones de uso para acceder a la aplicación.",
                it: "Devi accettare le condizioni d'uso per accedere all'applicazione."
            };
            alert(declineMsg[state.language] || declineMsg.en);
        });
    }

    const btnCguLang = document.getElementById("btn-cgu-lang");
    if (btnCguLang) {
        btnCguLang.addEventListener("change", (e) => {
            applyLanguage(e.target.value);
        });
    }

    // Login tab selector switcher
    const tabXtream = document.getElementById("tab-xtream");
    const tabM3u = document.getElementById("tab-m3u");
    const playlistTypeInput = document.getElementById("playlist-type");
    const labelUrl = document.getElementById("label-url");
    const iconUrl = document.getElementById("icon-url");
    const loginUrl = document.getElementById("login-url");
    const xtreamFields = document.querySelector(".xtream-fields");
    
    if (tabXtream && tabM3u) {
        tabXtream.addEventListener("click", () => {
            tabXtream.classList.add("active-tab");
            tabM3u.classList.remove("active-tab");
            if (playlistTypeInput) playlistTypeInput.value = "xtream";
            
            const t = TRANSLATIONS[state.language || 'en'];
            if (labelUrl) labelUrl.innerText = t.serverUrl;
            if (iconUrl) iconUrl.innerText = "dns";
            if (loginUrl) {
                loginUrl.placeholder = "http://domain.com:8080";
                loginUrl.value = "";
            }
            if (xtreamFields) xtreamFields.classList.remove("hidden");
            
            document.getElementById("login-username").required = true;
            document.getElementById("login-password").required = true;
        });
        
        tabM3u.addEventListener("click", () => {
            tabM3u.classList.add("active-tab");
            tabXtream.classList.remove("active-tab");
            if (playlistTypeInput) playlistTypeInput.value = "m3u";
            
            const t = TRANSLATIONS[state.language || 'en'];
            if (labelUrl) labelUrl.innerText = t.pmUrlM3uLabel;
            if (iconUrl) iconUrl.innerText = "link";
            if (loginUrl) {
                loginUrl.placeholder = t.diagLinktesterPlaceholder || "http://domain.com/playlist.m3u";
                loginUrl.value = "";
            }
            if (xtreamFields) xtreamFields.classList.add("hidden");
            
            document.getElementById("login-username").required = false;
            document.getElementById("login-password").required = false;
        });
    }

    // Back from login form to playlist manager
    const btnLoginBack = document.getElementById("btn-login-back");
    if (btnLoginBack) {
        btnLoginBack.addEventListener("click", () => {
            showScreen("playlist-manager-screen");
            renderPlaylistsGrid();
        });
    }

    // Login Form Submit
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const type = playlistTypeInput ? playlistTypeInput.value : "xtream";
        const name = document.getElementById("login-name").value;
        const url = document.getElementById("login-url").value;
        
        if (type === "xtream") {
            const user = document.getElementById("login-username").value;
            const pass = document.getElementById("login-password").value;
            await addXtreamCodesPlaylist(name, url, user, pass);
        } else {
            await addM3UPlaylist(name, url);
        }
    });
    
    // Portal Menu
    document.getElementById("portal-card-live").addEventListener("click", () => {
        switchSection("live");
    });
    document.getElementById("portal-card-movies").addEventListener("click", () => {
        switchSection("movies");
    });
    document.getElementById("portal-card-series").addEventListener("click", () => {
        switchSection("series");
    });
    const bindUtilityBtn = (btnId, screenId, callback) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener("click", () => {
                state.utilityParentScreen = activeScreenId();
                if (callback) {
                    callback();
                } else {
                    showScreen(screenId);
                }
            });
        }
    };

    // Bind Playlist Manager buttons
    bindUtilityBtn("pm-btn-speedtest", "speedtest-screen");
    bindUtilityBtn("pm-btn-linktester", "linktester-screen", () => {
        showScreen("linktester-screen");
        const resEl = document.getElementById("link-test-result");
        if (resEl) resEl.classList.add("hidden");
    });
    bindUtilityBtn("pm-btn-streamtester", "streamtester-screen", () => {
        showScreen("streamtester-screen");
        initStreamTesterUI();
    });
    bindUtilityBtn("pm-btn-settings", null, () => {
        switchSection("settings");
    });

    // Bind Portal buttons
    bindUtilityBtn("portal-btn-speedtest", "speedtest-screen");
    bindUtilityBtn("portal-btn-linktester", "linktester-screen", () => {
        showScreen("linktester-screen");
        const resEl = document.getElementById("link-test-result");
        if (resEl) resEl.classList.add("hidden");
    });
    bindUtilityBtn("portal-btn-streamtester", "streamtester-screen", () => {
        showScreen("streamtester-screen");
        initStreamTesterUI();
    });
    bindUtilityBtn("portal-btn-settings", null, () => {
        switchSection("settings");
    });
    bindUtilityBtn("portal-btn-reload", null, () => {
        reloadActivePlaylist();
    });

    document.getElementById("portal-btn-accounts").addEventListener("click", () => {
        showScreen("playlist-manager-screen");
        renderPlaylistsGrid();
    });

    // Standalone Diagnostic Screens Back Buttons
    const btnSpeedtestBack = document.getElementById("btn-speedtest-back");
    if (btnSpeedtestBack) {
        btnSpeedtestBack.addEventListener("click", () => {
            const parentScreen = state.utilityParentScreen || "playlist-manager-screen";
            if (parentScreen === "portal-screen") {
                showScreen("portal-screen");
            } else {
                showScreen("playlist-manager-screen");
            }
            focusFirst();
        });
    }

    const btnLinktesterBack = document.getElementById("btn-linktester-back");
    if (btnLinktesterBack) {
        btnLinktesterBack.addEventListener("click", () => {
            const parentScreen = state.utilityParentScreen || "playlist-manager-screen";
            if (parentScreen === "portal-screen") {
                showScreen("portal-screen");
            } else {
                showScreen("playlist-manager-screen");
            }
            focusFirst();
        });
    }

    const btnStreamtesterBack = document.getElementById("btn-streamtester-back");
    if (btnStreamtesterBack) {
        btnStreamtesterBack.addEventListener("click", () => {
            const parentScreen = state.utilityParentScreen || "playlist-manager-screen";
            if (parentScreen === "portal-screen") {
                showScreen("portal-screen");
            } else {
                showScreen("playlist-manager-screen");
            }
            focusFirst();
        });
    }
    
    // Back to portal / playlist manager
    document.getElementById("btn-header-back").addEventListener("click", () => {
        if (state.currentSection === "settings") {
            const parentScreen = state.utilityParentScreen || "playlist-manager-screen";
            if (parentScreen === "portal-screen") {
                showScreen("portal-screen");
            } else {
                showScreen("playlist-manager-screen");
                renderPlaylistsGrid();
            }
            focusFirst();
        } else {
            showScreen("portal-screen");
        }
    });
    
    // Preview Video Container trigger for fullscreen
    const previewContainer = document.getElementById("preview-video-container");
    if (previewContainer) {
        previewContainer.addEventListener("click", (e) => {
            if (state.currentPlayingStream && state.currentPlayingStream.section === 'live') {
                e.preventDefault();
                e.stopPropagation();
                if (typeof goFullscreenFromPreview === 'function') {
                    goFullscreenFromPreview();
                }
            }
        });
    }

    // Handle click overlay on the player screen when in preview-mode
    const playerScreen = document.getElementById("player-screen");
    if (playerScreen) {
        playerScreen.addEventListener("click", (e) => {
            if (playerScreen.classList.contains("preview-mode")) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof goFullscreenFromPreview === 'function') {
                    goFullscreenFromPreview();
                }
            }
        });
    }

    // Update preview position on window resize and fullscreen changes
    window.addEventListener("resize", () => {
        if (typeof updatePreviewVideoPosition === 'function') {
            updatePreviewVideoPosition();
        }
    });

    const onFullscreenChange = () => {
        if (typeof updatePreviewVideoPosition === 'function') {
            updatePreviewVideoPosition();
            setTimeout(updatePreviewVideoPosition, 100);
            setTimeout(updatePreviewVideoPosition, 300);
            setTimeout(updatePreviewVideoPosition, 500);
        }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("MSFullscreenChange", onFullscreenChange);
    
    // Series Back
    document.getElementById("series-btn-back").addEventListener("click", () => {
        showScreen("home-screen");
        if (state.lastFocusedElement) {
            state.lastFocusedElement.focus();
        } else {
            focusFirst();
        }
    });
    
    // Search
    const triggerSearch = () => {
        const queryEl = document.getElementById("search-bar");
        const query = queryEl ? queryEl.value.toLowerCase().trim() : "";
        let filtered = state.categoryGridItems || [];
        if (!Array.isArray(filtered)) filtered = [];
        
        if (query) {
            filtered = filtered.filter(item => {
                if (!item) return false;
                const name = (item.name || item.title || "").toString().toLowerCase();
                return name.includes(query);
            });
        }
        state.currentGridItems = filtered;
        state.gridCurrentPage = 1;
        renderGrid(filtered, state.currentSection);
    };
    
    const searchInputEl = document.getElementById("search-bar");
    if (searchInputEl) {
        searchInputEl.addEventListener("input", triggerSearch);
    }
    
    // Category search
    const catSearchBar = document.getElementById("category-search-bar");
    if (catSearchBar) {
        catSearchBar.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const currentCats = state.categories[state.currentSection] || [];
            const filteredCats = currentCats.filter(cat => {
                if (!cat) return false;
                const catName = (cat.category_name || cat.name || "").toString().toLowerCase();
                return catName.includes(query);
            });
            renderCategories(filteredCats);
        });
    }
    
    // DoH & Proxy bypass mode using a native <select> element.
    window.applyBypassModeUI = function(mode) {
        const sel = document.getElementById("setting-bypass-mode");
        if (sel) sel.value = mode;
        const resolverGroup = document.getElementById("setting-doh-resolver-group");
        if (resolverGroup) resolverGroup.style.display = (mode === 'doh') ? '' : 'none';
        const loginToggle = document.getElementById("login-doh-toggle");
        if (loginToggle) loginToggle.checked = (mode !== 'none');
    };

    window.setBypassMode = function(mode, withToast) {
        state.bypassMode = mode;
        state.isDohEnabled = (mode !== 'none');
        window.applyBypassModeUI(mode);
        if (typeof saveSettings === 'function') saveSettings();
        if (withToast) {
            const t = TRANSLATIONS[state.language || 'en'];
            let toastMsg = t.dohDisabledToast || "Contournement désactivé";
            if (mode === 'doh') toastMsg = t.dohEnabledToast || "Contournement DNS (DoH) activé";
            else if (mode === 'proxy') toastMsg = "Tunneling Proxy (Bypass DNS & IP) activé";
            showToast(toastMsg, 2500);
        }
    };

    const loginDohLabel = document.getElementById("login-doh-label");
    const loginDohToggle = document.getElementById("login-doh-toggle");
    if (loginDohLabel && loginDohToggle) {
        loginDohLabel.addEventListener("click", (e) => {
            e.preventDefault();
            loginDohToggle.checked = !loginDohToggle.checked;
            window.setBypassMode(loginDohToggle.checked ? 'proxy' : 'none', false);
        });
        loginDohToggle.addEventListener("change", (e) => {
            window.setBypassMode(e.target.checked ? 'proxy' : 'none', false);
        });
    }

    const settingBypassModeEl = document.getElementById("setting-bypass-mode");
    if (settingBypassModeEl) {
        settingBypassModeEl.addEventListener("change", (e) => {
            window.setBypassMode(e.target.value, true);
        });
    }

    // Apply the restored bypass mode settings at startup
    window.applyBypassModeUI(state.bypassMode);
    
    document.getElementById("setting-doh-url").addEventListener("change", (e) => {
        state.dohResolver = e.target.value;
        saveSettings();
        const t = TRANSLATIONS[state.language || 'en'];
        showToast(t.dohUpdatedToast, 2000);
    });
    
    // Language select change listener
    document.getElementById("setting-lang-select").addEventListener("change", (e) => {
        const newLang = e.target.value;
        applyLanguage(newLang);
        const t = TRANSLATIONS[newLang];
        showToast(t.langUpdatedToast, 2000);
    });

    // Player selection change listeners
    const playerLiveEl = document.getElementById("setting-player-live");
    if (playerLiveEl) {
        playerLiveEl.addEventListener("change", (e) => {
            state.playerSettings.live = e.target.value;
            saveSettings();
        });
    }
    const playerLiveFormatEl = document.getElementById("setting-player-live-format");
    if (playerLiveFormatEl) {
        playerLiveFormatEl.addEventListener("change", (e) => {
            state.playerSettings.liveFormat = e.target.value;
            saveSettings();
        });
    }
    const playerMoviesEl = document.getElementById("setting-player-movies");
    if (playerMoviesEl) {
        playerMoviesEl.addEventListener("change", (e) => {
            state.playerSettings.movies = e.target.value;
            saveSettings();
        });
    }
    const playerSeriesEl = document.getElementById("setting-player-series");
    if (playerSeriesEl) {
        playerSeriesEl.addEventListener("change", (e) => {
            state.playerSettings.series = e.target.value;
            saveSettings();
        });
    }
    
    // Hash routing change listener
    window.addEventListener("hashchange", () => {
        const currentLang = detectLanguage();
        if (currentLang !== state.language) {
            applyLanguage(currentLang);
        }
    });
    
    // Update Playlist & Logout
    const btnUpdatePlaylist = document.getElementById("btn-update-playlist");
    if (btnUpdatePlaylist) {
        btnUpdatePlaylist.addEventListener("click", () => {
            reloadActivePlaylist();
        });
    }

    document.getElementById("btn-logout").addEventListener("click", () => {
        logout();
    });
    
    // Player controls
    document.getElementById("player-btn-back").addEventListener("click", (e) => {
        e.stopPropagation();
        closeVideoPlayer();
    });
    document.getElementById("player-btn-play").addEventListener("click", () => {
        togglePlayPause();
    });
    
    document.getElementById("player-btn-prev").addEventListener("click", () => {
        const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
        if (isLive) {
            zapChannel('prev');
        } else {
            const video = document.getElementById("video-player");
            video.currentTime = Math.max(0, video.currentTime - 10);
        }
    });
    
    document.getElementById("player-btn-next-channel").addEventListener("click", () => {
        const isLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
        if (isLive) {
            zapChannel('next');
        } else {
            const video = document.getElementById("video-player");
            if (video.duration) {
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
            }
        }
    });
    
    document.getElementById("player-btn-channels").addEventListener("click", () => {
        if (state.zapDrawerOpen) {
            closeZapDrawer();
        } else {
            showZapDrawer();
        }
    });
    
    const zapDrawerClose = document.getElementById("zap-drawer-close");
    if (zapDrawerClose) {
        zapDrawerClose.addEventListener("click", (e) => {
            e.stopPropagation();
            closeZapDrawer();
        });
    }
    
    document.getElementById("player-btn-fullscreen").addEventListener("click", () => {
        toggleFullscreen();
    });
    
    // Volume Control Logic
    const volumeSlider = document.getElementById("player-volume-slider");
    const volumeBtn = document.getElementById("player-btn-volume");
    const volumeIcon = document.getElementById("player-icon-volume");
    const video = document.getElementById("video-player");

    if (volumeSlider && volumeBtn && volumeIcon && video) {
        const updateVolumeSliderTrack = () => {
            const val = parseFloat(volumeSlider.value);
            const percent = isNaN(val) ? 100 : Math.min(100, Math.max(0, val * 100));
            volumeSlider.style.setProperty('--volume-percent', percent + '%');
        };

        // Set initial volume from local storage if available
        try {
            const savedVolume = safeStorage.local.getItem("player_volume");
            if (savedVolume !== null) {
                const vol = parseFloat(savedVolume);
                video.volume = vol;
                volumeSlider.value = vol;
                updateVolumeIcon(vol);
            } else {
                video.volume = 1.0;
                volumeSlider.value = 1.0;
            }
            updateVolumeSliderTrack();
        } catch (e) {
            console.warn("Failed to load initial volume:", e);
        }

        volumeSlider.addEventListener("input", (e) => {
            const vol = parseFloat(e.target.value);
            video.volume = vol;
            video.muted = (vol === 0);
            try {
                safeStorage.local.setItem("player_volume", vol.toString());
            } catch(ex){}
            updateVolumeIcon(vol);
            updateVolumeSliderTrack();
            resetPlayerActivity();
        });

        volumeSlider.addEventListener("click", (e) => {
            e.stopPropagation();
            resetPlayerActivity();
        });

        volumeSlider.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            resetPlayerActivity();
        });

        volumeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            video.muted = !video.muted;
            if (video.muted) {
                volumeIcon.innerText = "volume_off";
                volumeSlider.value = 0;
            } else {
                const currentVol = video.volume || 1.0;
                volumeSlider.value = currentVol;
                updateVolumeIcon(currentVol);
            }
            updateVolumeSliderTrack();
            resetPlayerActivity();
        });

        video.addEventListener("volumechange", () => {
            if (video.muted) {
                volumeSlider.value = 0;
                volumeIcon.innerText = "volume_off";
            } else {
                volumeSlider.value = video.volume;
                updateVolumeIcon(video.volume);
            }
            updateVolumeSliderTrack();
            resetPlayerActivity();
        });
    }

    function updateVolumeIcon(vol) {
        if (vol === 0) {
            volumeIcon.innerText = "volume_off";
        } else if (vol < 0.5) {
            volumeIcon.innerText = "volume_down";
        } else {
            volumeIcon.innerText = "volume_up";
        }
    }
    
    // VLC / External Player launching (global for timeout auto-fallback)
    window.launchVlc = () => {
        if (state.currentPlayingStreamUrl) {
            let targetUrl = state.currentPlayingStreamUrl;
            if (state.currentPlayingStream && state.currentPlayingStream.item && (state.currentPlayingStream.section === 'movies' || state.currentPlayingStream.section === 'series')) {
                const originalExt = (state.currentPlayingStream.item.container_extension || "mp4").toLowerCase();
                const section = state.currentPlayingStream.section;
                const streamId = state.currentPlayingStream.item.stream_id || state.currentPlayingStream.item.id;
                targetUrl = `${state.serverUrl}/${section === 'series' ? 'series' : 'movie'}/${state.username}/${state.password}/${streamId}.${originalExt}`;
            }

            // On Electron, launch directly via main process spawn
            if (window.electronAPI && window.electronAPI.isElectron) {
                console.log("[VLC] Launching stream via Electron helper:", targetUrl);
                window.electronAPI.openVlcExternal(targetUrl);
                return;
            }
            // On Android TV, use native intent to open external player (VLC, MX Player, etc.)
            if (window.AndroidApp && typeof window.AndroidApp.openExternalPlayer === 'function') {
                console.log("[VLC] Launching stream via Android native intent:", state.currentPlayingStreamUrl);
                window.AndroidApp.openExternalPlayer(state.currentPlayingStreamUrl);
                return;
            }
            // On web/PC, use vlc:// protocol
            let vlcUrl = state.currentPlayingStreamUrl;
            if (vlcUrl.startsWith('http://')) {
                vlcUrl = vlcUrl.replace('http://', 'vlc://');
            } else if (vlcUrl.startsWith('https://')) {
                vlcUrl = vlcUrl.replace('https://', 'vlc://');
            } else {
                vlcUrl = 'vlc://' + vlcUrl;
            }
            console.log("[VLC] Launching stream in external player:", vlcUrl);
            window.location.href = vlcUrl;
        }
    };
    const launchVlc = window.launchVlc;

    const loaderVlcBtn = document.getElementById("player-loader-vlc");
    if (loaderVlcBtn) {
        loaderVlcBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            launchVlc();
        });
    }

    const overlayVlcBtn = document.getElementById("player-btn-vlc");
    if (overlayVlcBtn) {
        overlayVlcBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            launchVlc();
        });
    }

    const vlcBtnClose = document.getElementById("vlc-btn-close");
    if (vlcBtnClose) {
        vlcBtnClose.addEventListener("click", (e) => {
            e.stopPropagation();
            closeVideoPlayer();
        });
    }

    if (window.electronAPI && window.electronAPI.isElectron && window.electronAPI.onVlcExited) {
        window.electronAPI.onVlcExited(() => {
            console.log("[VLC] Received vlc-exited event from main process, closing player...");
            closeVideoPlayer();
        });
    }
    
    if (window.electronAPI && window.electronAPI.isElectron && window.electronAPI.onNativeExited) {
        window.electronAPI.onNativeExited(() => {
            console.log("[Native] Received native-exited event from main process, closing player...");
            closeVideoPlayer();
        });
    }
    
    // Timeline Scrubbing: Mouse Seek + Tooltip
    const progressBar = document.getElementById("player-progress-bar");
    const tooltip = document.getElementById("player-progress-tooltip");
    
    progressBar.addEventListener("click", (e) => {
        const video = document.getElementById("video-player");
        if (!video.duration) return;
        
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = clickX / rect.width;
        video.currentTime = percent * video.duration;
    });
    
    progressBar.addEventListener("mousemove", (e) => {
        const video = document.getElementById("video-player");
        if (!video.duration) return;
        
        const rect = progressBar.getBoundingClientRect();
        const hoverX = e.clientX - rect.left;
        const percent = hoverX / rect.width;
        const hoverTime = percent * video.duration;
        
        tooltip.classList.remove("hidden");
        tooltip.style.left = `${hoverX}px`;
        tooltip.innerText = formatTime(hoverTime);
        
        const hoverBar = document.getElementById("player-progress-hover");
        if (hoverBar) {
            hoverBar.style.width = `${percent * 100}%`;
        }
    });
    
    progressBar.addEventListener("mouseleave", () => {
        tooltip.classList.add("hidden");
        const hoverBar = document.getElementById("player-progress-hover");
        if (hoverBar) {
            hoverBar.style.width = "0%";
        }
    });
    
    // Player screen activity listeners
    let lastMouseX = null;
    let lastMouseY = null;
    playerScreen.addEventListener("mousemove", (e) => {
        if (isTvWrapper) return; // Completely ignore mousemove on Android TV wrapper
        
        if (lastMouseX !== null && lastMouseY !== null) {
            const deltaX = Math.abs(e.clientX - lastMouseX);
            const deltaY = Math.abs(e.clientY - lastMouseY);
            if (deltaX < 15 && deltaY < 15) return;
        }
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        resetPlayerActivity();
    });
    playerScreen.addEventListener("click", (e) => {
        const overlay = document.getElementById("player-overlay");
        if (overlay.classList.contains("hidden")) {
            resetPlayerActivity();
        } else {
            if (!e.target.closest(".player-btn") && !e.target.closest("#player-progress-bar") && !e.target.closest(".player-volume-container")) {
                overlay.classList.add("hidden");
                playerScreen.style.cursor = "none";
            }
        }
    });

    document.addEventListener("mousedown", (e) => {
        const focusable = e.target.closest(".focusable");
        if (focusable && focusable.tagName !== 'INPUT' && focusable.tagName !== 'SELECT') {
            e.preventDefault();
        }
    });

    // Speed Test Trigger
    const btnSpeedtest = document.getElementById("btn-run-speedtest");
    if (btnSpeedtest) {
        btnSpeedtest.addEventListener("click", runSpeedTest);
    }
    
    // Link Tester Trigger
    const btnLinktest = document.getElementById("btn-run-linktest");
    if (btnLinktest) {
        btnLinktest.addEventListener("click", runLinkTest);
    }

    // Stream Tester Trigger
    const btnStreamtest = document.getElementById("btn-run-streamtest");
    if (btnStreamtest) {
        btnStreamtest.addEventListener("click", runStreamTesterTest);
    }
}

function initTvInputs() {
    if (!isTvWrapper) return;
    const textInputs = document.querySelectorAll('input[type="text"], input[type="url"], input[type="password"]');
    textInputs.forEach(input => {
        input.setAttribute('readonly', 'true');
        
        input.addEventListener('click', function() {
            if (this.hasAttribute('readonly')) {
                this.removeAttribute('readonly');
                this.focus();
            }
        });
        
        input.addEventListener('blur', function() {
            this.setAttribute('readonly', 'true');
        });
    });
}
