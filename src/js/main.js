// Initial Setup on Load
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    if (isTvWrapper) {
        document.body.classList.add("tv-mode");
    }
    setupEventListeners();
    setupSpatialNavigation();
    initTvInputs();
    
    // Restore settings
    const savedSettings = localStorage.getItem("shield_iptv_settings");
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            state.isDohEnabled = settings.isDohEnabled !== undefined ? settings.isDohEnabled : true;
            state.dohResolver = settings.dohResolver || 'https://dns.google/resolve';
            
            document.getElementById("setting-doh-toggle").checked = state.isDohEnabled;
            document.getElementById("setting-doh-url").value = state.dohResolver;
        } catch (e) {
            console.error("Error reading settings", e);
        }
    }
    
    // Detect and apply initial language
    const initialLang = detectLanguage();
    applyLanguage(initialLang);
    
    const loginDoh = document.getElementById("login-doh-toggle");
    if (loginDoh) loginDoh.checked = state.isDohEnabled;

    // Show intro screen and setup transitions after 1.8 seconds
    showScreen("intro-screen");
    
    setTimeout(() => {
        const cguAccepted = localStorage.getItem("shield_cgu_accepted") === "true";
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
    }, 1800);
}

function proceedAfterCgu() {
    const isNewSession = !sessionStorage.getItem("shield_session_active");
    sessionStorage.setItem("shield_session_active", "true");
    
    const activePlaylistId = isNewSession ? null : localStorage.getItem("shield_active_playlist_id");
    if (activePlaylistId) {
        const playlists = loadSavedPlaylists();
        const activePlaylist = playlists.find(p => p.id === activePlaylistId);
        if (activePlaylist) {
            connectPlaylist(activePlaylist, true);
        } else {
            showScreen("playlist-manager-screen");
            renderPlaylistsGrid();
        }
    } else {
        showScreen("playlist-manager-screen");
        renderPlaylistsGrid();
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
        btnCguAccept.addEventListener("click", () => {
            localStorage.setItem("shield_cgu_accepted", "true");
            const modal = document.getElementById("cgu-modal");
            if (modal) modal.classList.add("hidden");
            proceedAfterCgu();
        });
    }

    const btnCguDecline = document.getElementById("btn-cgu-decline");
    if (btnCguDecline) {
        btnCguDecline.addEventListener("click", () => {
            if (window.close) {
                window.close();
            }
            alert("Vous devez accepter les conditions d'utilisation pour accéder à l'application.");
        });
    }

    const btnCguLang = document.getElementById("btn-cgu-lang");
    if (btnCguLang) {
        btnCguLang.addEventListener("click", () => {
            const cycle = ['fr', 'en', 'es', 'it'];
            const currentIndex = cycle.indexOf(state.language || 'fr');
            const nextIndex = (currentIndex + 1) % cycle.length;
            const nextLang = cycle[nextIndex];
            applyLanguage(nextLang);
            btnCguLang.focus();
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
            
            const t = TRANSLATIONS[state.language || 'fr'];
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
            
            const t = TRANSLATIONS[state.language || 'fr'];
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
        previewContainer.addEventListener("click", () => {
            if (state.currentPlayingStream && state.currentPlayingStream.section === 'live') {
                const item = state.currentPlayingStream.item;
                const streamUrl = item.url || `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.ts`;
                launchVideoPlayer(streamUrl, item.name, item.stream_icon || item.cover);
            }
        });
    }
    
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
        const query = document.getElementById("search-bar").value.toLowerCase().trim();
        let filtered = state.categoryGridItems;
        if (query) {
            filtered = state.categoryGridItems.filter(item => item.name.toLowerCase().includes(query));
        }
        state.currentGridItems = filtered;
        state.gridCurrentPage = 1;
        renderGrid(filtered, state.currentSection);
    };
    
    document.getElementById("search-bar").addEventListener("input", triggerSearch);
    
    // Category search
    const catSearchBar = document.getElementById("category-search-bar");
    if (catSearchBar) {
        catSearchBar.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const currentCats = state.categories[state.currentSection] || [];
            const filteredCats = currentCats.filter(cat => 
                cat.category_name.toLowerCase().includes(query)
            );
            renderCategories(filteredCats);
        });
    }
    
    // DoH
    const loginDohLabel = document.getElementById("login-doh-label");
    const loginDohToggle = document.getElementById("login-doh-toggle");
    if (loginDohLabel && loginDohToggle) {
        loginDohLabel.addEventListener("click", (e) => {
            e.preventDefault();
            loginDohToggle.checked = !loginDohToggle.checked;
            state.isDohEnabled = loginDohToggle.checked;
            const mainDoh = document.getElementById("setting-doh-toggle");
            if (mainDoh) mainDoh.checked = state.isDohEnabled;
            saveSettings();
        });
    }

    document.getElementById("setting-doh-toggle").addEventListener("change", (e) => {
        state.isDohEnabled = e.target.checked;
        const loginDohToggle = document.getElementById("login-doh-toggle");
        if (loginDohToggle) loginDohToggle.checked = state.isDohEnabled;
        saveSettings();
        const t = TRANSLATIONS[state.language || 'fr'];
        showToast(state.isDohEnabled ? t.dohEnabledToast : t.dohDisabledToast, 2000);
    });
    
    document.getElementById("setting-doh-url").addEventListener("change", (e) => {
        state.dohResolver = e.target.value;
        saveSettings();
        const t = TRANSLATIONS[state.language || 'fr'];
        showToast(t.dohUpdatedToast, 2000);
    });
    
    // Language select change listener
    document.getElementById("setting-lang-select").addEventListener("change", (e) => {
        const newLang = e.target.value;
        applyLanguage(newLang);
        const t = TRANSLATIONS[newLang];
        showToast(t.langUpdatedToast, 2000);
    });
    
    // Hash routing change listener
    window.addEventListener("hashchange", () => {
        const currentLang = detectLanguage();
        if (currentLang !== state.language) {
            applyLanguage(currentLang);
        }
    });
    
    // Logout
    document.getElementById("btn-logout").addEventListener("click", () => {
        logout();
    });
    
    // Player controls
    document.getElementById("player-btn-back").addEventListener("click", () => {
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
    
    document.getElementById("player-btn-fullscreen").addEventListener("click", () => {
        toggleFullscreen();
    });
    
    // VLC Player launching
    const launchVlc = () => {
        if (state.currentPlayingStreamUrl) {
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
    const playerScreen = document.getElementById("player-screen");
    playerScreen.addEventListener("mousemove", () => {
        resetPlayerActivity();
    });
    playerScreen.addEventListener("click", (e) => {
        const overlay = document.getElementById("player-overlay");
        if (overlay.classList.contains("hidden")) {
            resetPlayerActivity();
        } else {
            if (!e.target.closest(".player-btn") && !e.target.closest("#player-progress-bar")) {
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
