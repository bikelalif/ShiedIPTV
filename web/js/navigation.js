/* ==========================================================================
   SHIELDIPTV NAVIGATION & VIEW SWITCHING (WITH SPATIAL D-PAD REMOTE LOGIC)
   ========================================================================== */

function showScreen(screenId) {
    try {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        document.querySelectorAll(".screen").forEach(screen => {
            // DO NOT hide player-screen if it is in preview-mode and we are showing home-screen
            if (screen.id === 'player-screen' && screen.classList.contains('preview-mode') && screenId === 'home-screen') {
                return;
            }
            screen.classList.add("hidden");
        });
        const scr = document.getElementById(screenId);
        if (scr) scr.classList.remove("hidden");
        
        // Make sure player-screen is not hidden if we are on home-screen and in preview-mode
        if (screenId === 'home-screen') {
            const playerScreen = document.getElementById('player-screen');
            if (playerScreen && playerScreen.classList.contains('preview-mode')) {
                playerScreen.classList.remove('hidden');
                if (typeof updatePreviewVideoPosition === 'function') {
                    try {
                        updatePreviewVideoPosition();
                    } catch(e) {
                        console.warn("Failed to update preview position:", e);
                    }
                }
            }
        }
        
        if (screenId !== 'home-screen' || state.currentSection !== 'live') {
            // Stop the video completely if we navigate away to portal or settings
            if (screenId !== 'player-screen' && screenId !== 'home-screen') {
                if (typeof stopVideoPlaybackCompletely === 'function') {
                    try {
                        stopVideoPlaybackCompletely();
                    } catch(e) {
                        console.warn("Failed to stop video playback:", e);
                    }
                }
            }
        }
        
        if (screenId !== 'streamtester-screen') {
            if (typeof destroyTesterPlayer === 'function') {
                try {
                    destroyTesterPlayer();
                } catch(e) {
                    console.warn("Failed to destroy tester player:", e);
                }
            }
        }

        if (screenId && screenId !== "intro-screen" && screenId !== "loader" && screenId !== "player-screen") {
            safeStorage.local.setItem("shield_last_screen", screenId);
        }
        
        // Automatically focus the first logical element of the screen for TV remote
        if (isTvWrapper) {
            setTimeout(() => {
                try {
                    const active = document.activeElement;
                    const activeOverlay = document.querySelector(".screen-overlay:not(.hidden)");
                    const targetContainer = activeOverlay || document.getElementById(screenId);
                    if (!active || active === document.body || !targetContainer || !targetContainer.contains(active)) {
                        focusFirst();
                    }
                } catch(e) {
                    console.warn("Failed to focus first element:", e);
                }
            }, 50);
        }
    } catch (err) {
        console.error("Error in showScreen:", err);
    }
}

function activeScreenId() {
    const visibleScreen = document.querySelector(".screen:not(.hidden)");
    return visibleScreen ? visibleScreen.id : "";
}

function resumeLivePreviewIfNeeded() {
    const screenId = activeScreenId();
    if (screenId === 'home-screen' && 
        state.currentSection === 'live' && 
        state.playerSettings && 
        state.playerSettings.live === 'exoplayer_preview' && 
        state.exoplayerLaunchedForLive && 
        state.currentPlayingStream && 
        state.currentPlayingStream.section === 'live') {
        
        console.log("[Preview Restore] Resuming Live TV preview...");
        state.exoplayerLaunchedForLive = false;
        
        const previewPanel = document.getElementById("live-preview-panel");
        if (previewPanel) {
            previewPanel.classList.remove("hidden");
        }
        const homeScreen = document.getElementById("home-screen");
        if (homeScreen) {
            homeScreen.classList.add("preview-open");
        }
        const playerScreen = document.getElementById("player-screen");
        if (playerScreen) {
            playerScreen.classList.add("preview-mode");
            playerScreen.classList.remove("hidden");
        }
        
        if (typeof loadLivePreview === 'function') {
            loadLivePreview(state.currentPlayingStream.item);
        }
    }
}

// Global callback for Android native Activity onResume
window.onAndroidResume = function() {
    console.log("[Android Native] onAndroidResume event received");
    resumeLivePreviewIfNeeded();
};

window.onAndroidAppResumeFromBackground = function() {
    console.log("[Android Native] onAndroidAppResumeFromBackground event received");
    if (typeof stopVideoPlaybackCompletely === 'function') {
        stopVideoPlaybackCompletely();
    }
    // Restore focus to last active element or last focused card
    if (state.lastFocusedElement && document.body.contains(state.lastFocusedElement) && state.lastFocusedElement.offsetWidth > 0) {
        state.lastFocusedElement.focus();
        state.lastFocusedElement.scrollIntoView({ block: 'nearest' });
    } else {
        if (typeof focusFirst === 'function') {
            focusFirst();
        }
    }
};

function showLoader(text) {
    const t = TRANSLATIONS[state.language || 'en'];
    document.getElementById("loader-text").innerText = text || t.loaderDefault;
    document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
}

function showToast(text, duration = 3000) {
    const toast = document.getElementById("toast");
    toast.innerText = text;
    toast.classList.remove("hidden");
    
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.add("hidden");
    }, duration);
}

async function switchSection(section) {
    safeStorage.local.setItem("shield_last_section", section);
    const isMobileWeb = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && 
                        window.location.protocol !== 'file:' && 
                        !window.cordova && 
                        !window.AndroidApp &&
                        !/SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent) && 
                        window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
    console.log(`[Browser Check] Section: ${section}, isMobileWeb: ${isMobileWeb}, Width: ${window.innerWidth}, UA: ${navigator.userAgent}`);
    const warningBanner = document.getElementById("browser-warning-banner");
    if (warningBanner) {
        if (isMobileWeb && section === 'movies') {
            warningBanner.classList.remove("hidden");
        } else {
            warningBanner.classList.add("hidden");
        }
    }

    // Toggle search bar wrapper visibility and clear search query on section switch
    const searchWrapper = document.querySelector(".search-wrapper");
    if (searchWrapper) {
        if (section === 'settings') {
            searchWrapper.classList.add("hidden");
        } else {
            searchWrapper.classList.remove("hidden");
        }
    }
    const searchBar = document.getElementById("search-bar");
    if (searchBar) {
        searchBar.value = "";
    }

    const homeScreen = document.getElementById("home-screen");
    if (homeScreen) {
        homeScreen.setAttribute("data-section", section);
    }
    
    const catSearchBar = document.getElementById("category-search-bar");
    if (catSearchBar) {
        catSearchBar.value = "";
    }

    const t = TRANSLATIONS[state.language || 'en'];

    if (section === 'settings') {
        state.currentSection = 'settings';
        
        document.getElementById("breadcrumb-section").innerText = t.breadcrumbSettings;
        document.getElementById("breadcrumb-category").innerText = t.breadcrumbGeneral;
        
        document.getElementById("category-sidebar").classList.add("hidden");
        document.getElementById("media-grid-container").classList.add("hidden");
        document.getElementById("settings-panel").classList.remove("hidden");
        document.getElementById("live-preview-panel").classList.add("hidden");
        if (homeScreen) {
            homeScreen.classList.remove("preview-open");
        }
        
        destroyPreviewMpegtsPlayer(); // Stop preview playback
        state.currentPlayingStream = null;
        
        showScreen("home-screen");
        return;
    }
    
    state.currentSection = section;
    
    const sectionNames = { 
        live: t.breadcrumbLive, 
        movies: t.breadcrumbMovies, 
        series: t.breadcrumbSeries 
    };
    document.getElementById("breadcrumb-section").innerText = sectionNames[section];
    document.getElementById("breadcrumb-category").innerText = t.breadcrumbAll;
    
    document.getElementById("category-sidebar").classList.remove("hidden");
    document.getElementById("media-grid-container").classList.remove("hidden");
    document.getElementById("settings-panel").classList.add("hidden");
    
    document.getElementById("live-preview-panel").classList.add("hidden");
    if (homeScreen) {
        homeScreen.classList.remove("preview-open");
    }
    destroyPreviewMpegtsPlayer();
    state.currentPlayingStream = null;
    
    showScreen("home-screen");
    
    state.activeCategoryId = "all";
    renderCategories(state.categories[section]);
    loadCategoryStreamsCached(section, "all");
}

function renderCategories(cats) {
    const listEl = document.getElementById("category-list");
    listEl.innerHTML = "";
    
    if (!cats || !Array.isArray(cats)) {
        cats = [];
    }
    
    const t = TRANSLATIONS[state.language || 'en'];
    
    cats.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "category-item focusable";
        if (cat.category_id === state.activeCategoryId) {
            btn.classList.add("active");
        }
        btn.setAttribute("data-id", cat.category_id);
        
        btn.innerText = (cat.category_id === 'all') ? t.breadcrumbAll : cat.category_name;
        
        btn.addEventListener("click", () => {
            document.querySelectorAll(".category-item").forEach(el => el.classList.remove("active"));
            btn.classList.add("active");
            state.activeCategoryId = cat.category_id;
            safeStorage.local.setItem("shield_last_category_id", cat.category_id);
            
            document.getElementById("breadcrumb-category").innerText = (cat.category_id === 'all') ? t.breadcrumbAll : cat.category_name;
            loadCategoryStreamsCached(state.currentSection, cat.category_id);
        });
        
        listEl.appendChild(btn);
    });
}

async function loadCategoryStreamsCached(section, categoryId) {
    state.activeCategoryId = categoryId;
    safeStorage.local.setItem("shield_last_category_id", categoryId);
    const searchBar = document.getElementById("search-bar");
    if (searchBar) {
        searchBar.value = "";
    }

    const t = TRANSLATIONS[state.language || 'en'];
    let filtered = [];

    if (state.currentPlaylistType === 'xtream') {
        let categoryCached = (state.streams[section] || []).filter(item => {
            const catId = item.category_id;
            return catId !== undefined && String(catId) === String(categoryId);
        });

        const totalCached = (state.streams[section] || []).length;

        if ((categoryId === 'all' && totalCached === 0) || (categoryId !== 'all' && categoryCached.length === 0)) {
            showLoader(t.toastPreloadLive || "Chargement...");
            try {
                let action = 'get_live_streams';
                if (section === 'movies') action = 'get_vod_streams';
                if (section === 'series') action = 'get_series';

                const params = categoryId !== 'all' ? `&category_id=${categoryId}` : '';
                const data = await makeApiCall(action, params);
                
                let fetched = Array.isArray(data) ? data : [];
                
                if (!state.streams[section]) {
                    state.streams[section] = [];
                }

                const existing = new Set(state.streams[section].map(item => String(item.stream_id || item.series_id || item.id)));
                fetched.forEach(item => {
                    const id = String(item.stream_id || item.series_id || item.id);
                    if (!existing.has(id)) {
                        state.streams[section].push(item);
                    }
                });

                categoryCached = fetched;
            } catch (e) {
                console.error("Failed to load category streams from server:", e);
            } finally {
                hideLoader();
            }
        }

        if (categoryId === 'all') {
            filtered = state.streams[section] || [];
        } else {
            filtered = (state.streams[section] || []).filter(item => String(item.category_id) === String(categoryId));
        }
    } else {
        let streamsList = state.streams[section] || [];
        if (!Array.isArray(streamsList)) streamsList = [];
        filtered = streamsList;
        if (categoryId !== "all") {
            filtered = streamsList.filter(item => String(item.category_id) === String(categoryId));
        }
    }

    state.categoryGridItems = filtered;
    state.currentGridItems = filtered;
    
    state.gridCurrentPage = 1;
    renderGrid(filtered, section);
    focusFirst();
}

function renderGrid(items, section) {
    const gridEl = document.getElementById("media-grid");
    gridEl.innerHTML = "";
    
    if (!items || !Array.isArray(items)) {
        items = [];
    }
    
    if (items.length === 0) {
        const t = TRANSLATIONS[state.language || 'en'];
        gridEl.innerHTML = `<div class="empty-state">${t.toastEmptyCategory}</div>`;
        return;
    }
    
    const initialBatch = items.slice(0, state.gridItemsPerPage);
    appendItemsToGrid(initialBatch, section);
    
    const container = document.getElementById("media-grid-container");
    container.scrollTop = 0;
    container.onscroll = () => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 300) {
            loadNextGridBatch(section);
        }
    };
}

function appendItemsToGrid(batch, section) {
    const gridEl = document.getElementById("media-grid");
    const t = TRANSLATIONS[state.language || 'en'];
    
    batch.forEach(item => {
        const card = document.createElement("div");
        card.className = "media-card focusable";
        if (section === 'live') {
            card.classList.add("live-card");
        }
        card.setAttribute("tabindex", "0");
        card.setAttribute("data-id", item.stream_id || item.series_id || item.id);
        
        const isLivePlaying = state.currentPlayingStream && 
                             state.currentPlayingStream.section === section && 
                             state.currentPlayingStream.item.stream_id === item.stream_id;
        if (isLivePlaying) {
            card.classList.add("active-playing");
        }
        
        const posterWrapper = document.createElement("div");
        posterWrapper.className = "media-poster-wrapper";
        
        const poster = document.createElement("img");
        poster.className = "media-poster";
        // Disable lazy loading on TV – older Android TV WebViews have bugs with
        // loading="lazy" on images created off-DOM, causing logos to never render.
        if (!isTvWrapper) {
            poster.loading = "lazy";
        }
        
        const defaultPoster = section === 'live' ? PLACEHOLDERS.live : PLACEHOLDERS.vod;
        const logoUrl = item.stream_icon || item.cover || defaultPoster;
        if (typeof loadImageWithFallback === 'function') {
            loadImageWithFallback(poster, logoUrl, defaultPoster);
        } else {
            poster.src = logoUrl;
            poster.onerror = () => { poster.src = defaultPoster; };
        }
        
        posterWrapper.appendChild(poster);
        
        if (section !== 'live' && item.rating) {
            const rating = document.createElement("div");
            rating.className = "media-rating";
            rating.innerHTML = `<span class="material-icons">star</span><span>${parseFloat(item.rating).toFixed(1)}</span>`;
            posterWrapper.appendChild(rating);
        }
        
        const title = document.createElement("div");
        title.className = "media-name";
        title.innerText = item.name;
        
        card.appendChild(posterWrapper);
        card.appendChild(title);
        
        card.addEventListener("click", () => {
            playMedia(item, section);
        });
        
        gridEl.appendChild(card);
    });
}

function loadNextGridBatch(section) {
    let gridItems = state.currentGridItems || [];
    if (!Array.isArray(gridItems)) gridItems = [];
    
    const totalItems = gridItems.length;
    const loadedCount = state.gridCurrentPage * state.gridItemsPerPage;
    if (loadedCount >= totalItems) return;
    
    const nextBatch = gridItems.slice(loadedCount, loadedCount + state.gridItemsPerPage);
    state.gridCurrentPage++;
    appendItemsToGrid(nextBatch, section);
    console.log(`[Grid Pagination] Page ${state.gridCurrentPage} appended. Total rendered: ${state.gridCurrentPage * state.gridItemsPerPage}/${totalItems}`);
}

// Spatial Navigation Setup
let lastArrowTime = 0;
function setupSpatialNavigation() {
    window.addEventListener("keydown", (e) => {
        const key = e.key;
        
        // Prevent key events from moving focus or triggering form actions if editing an input
        const activeEl = document.activeElement;
        if (activeEl && activeEl.tagName === 'INPUT' && activeEl.type !== 'checkbox' && (!isTvWrapper || !activeEl.hasAttribute('readonly'))) {
            if (key === 'Enter') {
                e.preventDefault();
                
                const container = document.getElementById(activeScreenId());
                const inputs = Array.from(container.querySelectorAll('input[type="text"], input[type="url"], input[type="password"]')).filter(input => {
                    return input.offsetWidth > 0 || input.offsetHeight > 0;
                });
                
                const currentIndex = inputs.indexOf(activeEl);
                
                if (isTvWrapper) {
                    activeEl.setAttribute('readonly', 'true');
                }
                activeEl.blur();
                
                if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
                    const nextInput = inputs[currentIndex + 1];
                    if (isTvWrapper) {
                        nextInput.removeAttribute('readonly');
                    }
                    nextInput.focus();
                } else {
                    const form = activeEl.closest('form');
                    const submitBtn = form ? (form.querySelector('button[type="submit"]') || form.querySelector('.btn-primary') || form.querySelector('.focusable')) : null;
                    if (submitBtn) {
                        submitBtn.focus();
                    } else {
                        focusFirst();
                    }
                }
            }
            return;
        }

        // Throttle rapid D-pad/arrow key navigation presses to prevent backlog congestion on TV
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            const now = Date.now();
            const throttleMs = e.repeat ? 85 : 50; // Faster repeat rate (85ms) when holding key, instant (50ms) for manual clicks
            if (now - lastArrowTime < throttleMs) {
                e.preventDefault();
                return;
            }
            lastArrowTime = now;
        }
        
        if (activeScreenId() === "player-screen") {
            const overlay = document.getElementById("player-overlay");
            const wasHidden = overlay && overlay.classList.contains("hidden");
            resetPlayerActivity();
            
            // If the overlay was hidden, first press of arrow keys or Enter just shows it and focuses Play
            if (wasHidden && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Select'].includes(key)) {
                e.preventDefault();
                const playBtn = document.getElementById("player-btn-play");
                if (playBtn) playBtn.focus();
                return;
            }
        }
        
        // TV Remote Specific Key Bindings
        if (['ChannelUp', 'ChannelDown', 'PageUp', 'PageDown'].includes(key)) {
            if (activeScreenId() === "player-screen") {
                e.preventDefault();
                zapChannel((key === 'ChannelUp' || key === 'PageUp') ? 'next' : 'prev');
                return;
            }
        }
        
        if (['MediaPlay', 'MediaPause', 'MediaPlayPause', 'Play', 'Pause'].includes(key)) {
            if (activeScreenId() === "player-screen") {
                e.preventDefault();
                togglePlayPause();
                return;
            }
        }
        
        if (!isTvWrapper) {
            // PC & Web: disable D-pad spatial navigation, only keep media player controls
            if (activeScreenId() === "player-screen") {
                if (key.toLowerCase() === 'f') {
                    e.preventDefault();
                    toggleFullscreen();
                } else if (key === ' ' || key === 'Spacebar') {
                    e.preventDefault();
                    togglePlayPause();
                } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
                    e.preventDefault();
                    if (state.isNativePlaying) {
                        let targetTime = key === 'ArrowLeft' ? Math.max(0, state.nativeCurrentTime - 10) : Math.min(state.nativeDuration, state.nativeCurrentTime + 10);
                        if (window.AndroidApp && typeof window.AndroidApp.seekNative === 'function') {
                            window.AndroidApp.seekNative(targetTime * 1000);
                        }
                        state.nativeCurrentTime = targetTime;
                        onNativePlayerProgress(targetTime, state.nativeDuration);
                    } else {
                        const video = document.getElementById("video-player");
                        if (video && video.duration) {
                            if (key === 'ArrowLeft') {
                                video.currentTime = Math.max(0, video.currentTime - 10);
                            } else {
                                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                            }
                        }
                    }
                } else if (key === 'ArrowUp' || key === 'ArrowDown') {
                    e.preventDefault();
                    const video = document.getElementById("video-player");
                    if (video) {
                        let newVol = key === 'ArrowUp' ? Math.min(1.0, video.volume + 0.05) : Math.max(0.0, video.volume - 0.05);
                        video.volume = newVol;
                        video.muted = (newVol === 0);
                        try {
                            safeStorage.local.setItem("player_volume", newVol.toString());
                        } catch(ex){}
                    }
                } else if (key === 'Escape' || key === 'Backspace') {
                    e.preventDefault();
                    closeVideoPlayer();
                }
            }
            return;
        }

        if (key.toLowerCase() === 'f') {
            if (activeScreenId() === "player-screen") {
                e.preventDefault();
                toggleFullscreen();
            }
        }
        
        if (key === ' ' || key === 'Spacebar') {
            if (activeScreenId() === "player-screen") {
                e.preventDefault();
                togglePlayPause();
            }
        }
        
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
            const active = document.activeElement;
            const container = document.getElementById(activeScreenId());
            const activeOverlay = document.querySelector(".screen-overlay:not(.hidden)");
            const targetContainer = activeOverlay || container;
            
            if (!active || active === document.body || !active.classList.contains("focusable") || (targetContainer && !targetContainer.contains(active))) {
                const screenId = activeScreenId();
                let fallbackElement = state.lastFocusedElement;
                if (screenId === 'home-screen' && state.lastFocusedHomeElement) {
                    fallbackElement = state.lastFocusedHomeElement;
                } else if (screenId === 'series-details-screen' && state.lastFocusedSeriesDetailsElement) {
                    fallbackElement = state.lastFocusedSeriesDetailsElement;
                }
                
                if (fallbackElement && document.body.contains(fallbackElement) && fallbackElement.offsetWidth > 0) {
                    const lastFocusedScreen = fallbackElement.closest('.screen');
                    const isInsideTarget = !targetContainer || targetContainer.contains(fallbackElement);
                    if (isInsideTarget && lastFocusedScreen && lastFocusedScreen.id === screenId) {
                        e.preventDefault();
                        fallbackElement.focus();
                        return;
                    }
                }
                e.preventDefault();
                focusFirst();
                return;
            }
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            const active = document.activeElement;
            
            // Handle CGU scrollbox scrolling
            if (active && active.classList.contains("cgu-content")) {
                const scrollSpeed = 40;
                const isScrollable = active.scrollHeight > active.clientHeight;
                if (isScrollable) {
                    if (key === 'ArrowDown') {
                        const isAtBottom = active.scrollTop + active.clientHeight >= active.scrollHeight - 5;
                        if (!isAtBottom) {
                            e.preventDefault();
                            active.scrollTop += scrollSpeed;
                            return;
                        }
                    } else if (key === 'ArrowUp') {
                        const isAtTop = active.scrollTop <= 5;
                        if (!isAtTop) {
                            e.preventDefault();
                            active.scrollTop -= scrollSpeed;
                            return;
                        }
                    }
                }
            }
            
            if (active && active.id === 'player-progress-bar') {
                if (state.isNativePlaying) {
                    if (key === 'ArrowLeft' || key === 'ArrowRight') {
                        e.preventDefault();
                        let targetTime = key === 'ArrowLeft' ? Math.max(0, state.nativeCurrentTime - 10) : Math.min(state.nativeDuration, state.nativeCurrentTime + 10);
                        if (window.AndroidApp && typeof window.AndroidApp.seekNative === 'function') {
                            window.AndroidApp.seekNative(targetTime * 1000);
                        }
                        state.nativeCurrentTime = targetTime;
                        onNativePlayerProgress(targetTime, state.nativeDuration);
                        return;
                    }
                } else {
                    const video = document.getElementById("video-player");
                    if (video.duration && (key === 'ArrowLeft' || key === 'ArrowRight')) {
                        e.preventDefault();
                        if (key === 'ArrowLeft') {
                            video.currentTime = Math.max(0, video.currentTime - 10);
                        } else {
                            video.currentTime = Math.min(video.duration, video.currentTime + 10);
                        }
                        return;
                    }
                }
            }
            
            e.preventDefault();
            const direction = key.replace('Arrow', '').toLowerCase();
            moveFocus(direction);
        } else if (key === 'Enter' || key === 'Select') {
            const active = document.activeElement;
            if (active && active.classList.contains("focusable")) {
                if (active.tagName === 'INPUT') {
                    if (active.hasAttribute('readonly')) {
                        e.preventDefault();
                        active.removeAttribute('readonly');
                        active.focus();
                    }
                } else if (active.tagName === 'SELECT') {
                    // Do not preventDefault or call click() so that the native browser/WebView dropdown opens
                } else {
                    e.preventDefault();
                    active.click();
                }
            }
        } else if (key === 'Escape' || key === 'Back' || e.keyCode === 461 || e.keyCode === 10009 || key === 'Backspace' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            handleBackButton();
        }
    });
    
    document.addEventListener("focusin", (e) => {
        const target = e.target;
        if (target && target.classList.contains("focusable")) {
            const screen = target.closest('.screen');
            if (screen) {
                if (screen.id === 'home-screen') {
                    const isInsidePreview = target.closest('#live-preview-panel');
                    if (!isInsidePreview) {
                        state.lastFocusedHomeElement = target;
                    }
                } else if (screen.id === 'series-details-screen') {
                    state.lastFocusedSeriesDetailsElement = target;
                }
            }
            state.lastFocusedElement = target;
            
            // Remove focused class from all other focusable elements
            document.querySelectorAll(".focusable.focused").forEach(el => {
                if (el !== target) el.classList.remove("focused");
            });
            target.classList.add("focused");
        }
    });

    window.addEventListener("focus", () => {
        // If we regain window focus, restore focus to screen-specific last focused element
        const screenId = activeScreenId();
        let fallbackElement = state.lastFocusedElement;
        if (screenId === 'home-screen' && state.lastFocusedHomeElement) {
            fallbackElement = state.lastFocusedHomeElement;
        } else if (screenId === 'series-details-screen' && state.lastFocusedSeriesDetailsElement) {
            fallbackElement = state.lastFocusedSeriesDetailsElement;
        }
        if (fallbackElement && document.body.contains(fallbackElement) && fallbackElement.offsetWidth > 0) {
            fallbackElement.focus();
        }

        // If returning from native ExoPlayer playback in exoplayer_preview mode, restore the HTML5 preview playback
        resumeLivePreviewIfNeeded();
    });

    document.addEventListener("focusout", (e) => {
        const target = e.target;
        if (target && target.classList.contains("focusable")) {
            target.classList.remove("focused");
        }
    });
}

function moveFocus(direction) {
    let active = document.activeElement;
    if (!active || active === document.body || !active.classList.contains('focusable')) {
        const screenId = activeScreenId();
        let fallbackElement = state.lastFocusedElement;
        if (screenId === 'home-screen' && state.lastFocusedHomeElement) {
            fallbackElement = state.lastFocusedHomeElement;
        } else if (screenId === 'series-details-screen' && state.lastFocusedSeriesDetailsElement) {
            fallbackElement = state.lastFocusedSeriesDetailsElement;
        }
        
        if (fallbackElement && document.body.contains(fallbackElement) && fallbackElement.offsetWidth > 0) {
            const lastFocusedScreen = fallbackElement.closest('.screen');
            if (lastFocusedScreen && lastFocusedScreen.id === screenId) {
                fallbackElement.focus();
                active = fallbackElement;
            }
        }
    }
    if (!active || !active.classList.contains('focusable')) {
        focusFirst();
        return;
    }
    
    // Custom rule: ArrowUp on first element in settings goes directly to back button
    if (state.currentSection === 'settings') {
        if (active.id === 'setting-doh-toggle' && direction === 'up') {
            const backBtn = document.getElementById("btn-header-back");
            if (backBtn) {
                // Reset scroll positions of settings-panel and page viewport instantly
                const settingsPanel = document.getElementById("settings-panel");
                if (settingsPanel) {
                    settingsPanel.scrollTop = 0;
                }
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
                document.documentElement.scrollTop = 0;
                
                backBtn.focus();
                return;
            }
        }
    }
    
    // Linear list navigation fast-path to prevent laggy bounding-box calculations on large lists
    if (active.classList.contains("category-item")) {
        if (direction === 'down') {
            const categoryItems = Array.from(document.querySelectorAll("#category-list .category-item"));
            const currentIndex = categoryItems.indexOf(active);
            if (currentIndex !== -1 && currentIndex < categoryItems.length - 1) {
                const nextItem = categoryItems[currentIndex + 1];
                nextItem.focus();
                nextItem.scrollIntoView({ behavior: 'auto', block: 'center' });
                return;
            }
        } else if (direction === 'up') {
            const categoryItems = Array.from(document.querySelectorAll("#category-list .category-item"));
            const currentIndex = categoryItems.indexOf(active);
            if (currentIndex > 0) {
                const prevItem = categoryItems[currentIndex - 1];
                prevItem.focus();
                prevItem.scrollIntoView({ behavior: 'auto', block: 'center' });
                return;
            } else {
                const catSearchBar = document.getElementById("category-search-bar");
                if (catSearchBar && catSearchBar.offsetWidth > 0) {
                    catSearchBar.focus();
                    return;
                }
            }
        }
    } else if (active.id === "category-search-bar") {
        if (direction === 'down') {
            const firstCat = document.querySelector("#category-list .category-item");
            if (firstCat) {
                firstCat.focus();
                firstCat.scrollIntoView({ behavior: 'auto', block: 'center' });
                return;
            }
        }
    } else if (active.classList.contains("zap-item")) {
        if (direction === 'down') {
            const zapItems = Array.from(document.querySelectorAll("#zap-list .zap-item"));
            const currentIndex = zapItems.indexOf(active);
            if (currentIndex !== -1 && currentIndex < zapItems.length - 1) {
                const nextItem = zapItems[currentIndex + 1];
                nextItem.focus();
                nextItem.scrollIntoView({ behavior: 'auto', block: 'center' });
                return;
            }
        } else if (direction === 'up') {
            const zapItems = Array.from(document.querySelectorAll("#zap-list .zap-item"));
            const currentIndex = zapItems.indexOf(active);
            if (currentIndex > 0) {
                const prevItem = zapItems[currentIndex - 1];
                prevItem.focus();
                prevItem.scrollIntoView({ behavior: 'auto', block: 'center' });
                return;
            }
        }
    }
    
    // Custom rule: navigation between category sidebar and media grid
    if (active.classList.contains("category-item") && direction === "right") {
        let gridCard = state.lastFocusedHomeElement;
        const isCardInGrid = gridCard && gridCard.classList.contains("media-card") && document.getElementById("media-grid").contains(gridCard);
        if (!isCardInGrid) {
            gridCard = document.querySelector("#media-grid .media-card.active-playing") || 
                       document.querySelector("#media-grid .media-card") || 
                       Array.from(document.querySelectorAll("#media-grid .focusable")).find(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        }
        if (gridCard) {
            gridCard.focus();
            gridCard.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            return;
        }
    }
    if (active.classList.contains("media-card") && direction === "left" && isLeftmostMediaCard(active)) {
        const activeCat = document.querySelector("#category-list .category-item.active") || 
                          document.querySelector("#category-list .category-item");
        if (activeCat) {
            activeCat.focus();
            activeCat.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            return;
        }
    }
    
    // Custom rule: left navigation from preview panel to media grid
    const inPreviewPanel = document.getElementById("live-preview-panel") && 
                           document.getElementById("live-preview-panel").contains(active);
    if (inPreviewPanel && direction === "left") {
        let gridCard = state.lastFocusedHomeElement;
        const isCardInGrid = gridCard && gridCard.classList.contains("media-card") && document.getElementById("media-grid").contains(gridCard);
        if (!isCardInGrid) {
            gridCard = document.querySelector("#media-grid .media-card.active-playing") || 
                       document.querySelector("#media-grid .media-card") || 
                       Array.from(document.querySelectorAll("#media-grid .focusable")).find(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        }
        if (gridCard) {
            gridCard.focus();
            gridCard.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            return;
        }
    }
    
    if (active.id === 'player-btn-back' && direction === 'right') {
        return;
    }
    
    const activeOverlay = document.querySelector(".screen-overlay:not(.hidden)");
    const zapDrawer = document.getElementById("zap-drawer");
    const isZapDrawerOpen = zapDrawer && !zapDrawer.classList.contains("hidden");
    
    let candidates = [];
    if (activeOverlay) {
        candidates = Array.from(activeOverlay.querySelectorAll(".focusable"));
    } else if (isZapDrawerOpen) {
        candidates = Array.from(zapDrawer.querySelectorAll(".focusable"));
    } else {
        candidates = Array.from(document.querySelectorAll('.screen:not(.hidden) .focusable'));
    }
    
    // Filter candidates to keep navigation intuitive and prevent focus from jumping out of lists/grids
    if (active.classList.contains("media-card")) {
        if (direction === 'down') {
            // Keep focus inside media-grid when going down
            candidates = candidates.filter(c => c.classList.contains("media-card"));
        } else if (direction === 'up') {
            // Only allow jumping to header (non-cards) if there are no media cards directly above us
            const cardsAbove = candidates.filter(c => c.classList.contains("media-card") && c.getBoundingClientRect().bottom <= active.getBoundingClientRect().top + 5);
            if (cardsAbove.length > 0) {
                candidates = cardsAbove;
            } else {
                // No cards above, allow focusing header actions (like search bar, back button)
                candidates = candidates.filter(c => !c.classList.contains("media-card") && !c.classList.contains("category-item") && c.id !== "category-search-bar");
            }
        }
    } else if (active.classList.contains("category-item")) {
        if (direction === 'up' || direction === 'down') {
            // Keep vertical navigation in sidebar constrained to category items and category search bar
            candidates = candidates.filter(c => c.classList.contains("category-item") || c.id === "category-search-bar");
        }
    } else if (active.id === "category-search-bar") {
        if (direction === 'down') {
            // Go to first category item
            candidates = candidates.filter(c => c.classList.contains("category-item"));
        }
    }
    
    const activeRect = active.getBoundingClientRect();
    let bestCandidate = null;
    let minDistance = Infinity;
    
    candidates.forEach(candidate => {
        if (candidate === active) return;
        
        const rect = candidate.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        const centerActive = {
            x: activeRect.left + activeRect.width / 2,
            y: activeRect.top + activeRect.height / 2
        };
        
        const centerCandidate = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        
        const deltaX = centerCandidate.x - centerActive.x;
        const deltaY = centerCandidate.y - centerActive.y;
        
        // Overlap checking to prevent skipping wide inputs or off-center buttons
        const overlapX = (rect.left < activeRect.right && rect.right > activeRect.left);
        const overlapY = (rect.top < activeRect.bottom && rect.bottom > activeRect.top);
        
        const effDeltaX = overlapX ? deltaX * 0.1 : deltaX;
        const effDeltaY = overlapY ? deltaY * 0.1 : deltaY;
        
        let isDirectional = false;
        let distance = 0;
        const margin = 2;
        
        if (direction === 'left') {
            isDirectional = (centerCandidate.x < centerActive.x - margin);
            distance = Math.abs(deltaX) + Math.abs(effDeltaY) * 2.5; 
        } else if (direction === 'right') {
            isDirectional = (centerCandidate.x > centerActive.x + margin);
            distance = Math.abs(deltaX) + Math.abs(effDeltaY) * 2.5;
        } else if (direction === 'up') {
            isDirectional = (centerCandidate.y < centerActive.y - margin);
            distance = Math.abs(deltaY) + Math.abs(effDeltaX) * 2.5;
        } else if (direction === 'down') {
            isDirectional = (centerCandidate.y > centerActive.y + margin);
            distance = Math.abs(deltaY) + Math.abs(effDeltaX) * 2.5;
        }
        
        if (isDirectional && distance < minDistance) {
            minDistance = distance;
            bestCandidate = candidate;
        }
    });
    
    if (bestCandidate) {
        bestCandidate.focus();
        if (bestCandidate.classList.contains("category-item")) {
            bestCandidate.scrollIntoView({
                behavior: 'auto',
                block: 'center'
            });
        } else {
            bestCandidate.scrollIntoView({
                behavior: 'auto',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    }
}

function getFocusFallbackForScreen(screenId) {
    if (screenId === 'home-screen') {
        if (state.lastFocusedHomeElement && document.body.contains(state.lastFocusedHomeElement) && state.lastFocusedHomeElement.offsetWidth > 0) {
            return state.lastFocusedHomeElement;
        }
        const container = document.getElementById('home-screen');
        if (container) {
            return container.querySelector("#media-grid .media-card") ||
                   container.querySelector(".category-item.active") ||
                   container.querySelector(".category-item") ||
                   container.querySelector(".focusable:not(.btn-back-round):not(#btn-header-back):not(#search-bar):not(#category-search-bar)");
        }
    } else if (screenId === 'series-details-screen') {
        if (state.lastFocusedSeriesDetailsElement && document.body.contains(state.lastFocusedSeriesDetailsElement) && state.lastFocusedSeriesDetailsElement.offsetWidth > 0) {
            return state.lastFocusedSeriesDetailsElement;
        }
        const container = document.getElementById('series-details-screen');
        if (container) {
            return container.querySelector(".episode-card") ||
                   container.querySelector(".season-btn.active") ||
                   container.querySelector(".season-btn") ||
                   container.querySelector(".focusable");
        }
    }
    return null;
}

function focusFirst() {
    const screenId = activeScreenId();
    let container = document.getElementById(screenId);
    
    const activeOverlay = document.querySelector(".screen-overlay:not(.hidden)");
    if (activeOverlay) container = activeOverlay;
    
    const zapDrawer = document.getElementById("zap-drawer");
    if (zapDrawer && !zapDrawer.classList.contains("hidden")) container = zapDrawer;
    
    if (container) {
        let target = null;
        if (screenId === 'portal-screen') {
            target = container.querySelector("#portal-card-live");
        } else if (screenId === 'playlist-manager-screen') {
            target = container.querySelector(".playlist-card") || container.querySelector(".focusable");
        } else if (screenId === 'login-screen') {
            target = container.querySelector("#login-name") || container.querySelector(".focusable");
        } else if (screenId === 'player-screen') {
            target = container.querySelector("#player-btn-play") || container.querySelector("#player-btn-back") || Array.from(container.querySelectorAll(".focusable")).find(el => el.offsetWidth > 0 || el.offsetHeight > 0);
        } else if (screenId === 'home-screen' || screenId === 'series-details-screen') {
            if (screenId === 'home-screen' && state.currentSection === 'settings') {
                target = container.querySelector("#setting-doh-toggle") || container.querySelector(".settings-panel .focusable");
            } else {
                target = getFocusFallbackForScreen(screenId);
            }
        }
        
        if (!target) {
            target = Array.from(container.querySelectorAll(".focusable")).find(el => el.offsetWidth > 0 || el.offsetHeight > 0);
        }
        
        if (target) {
            target.focus();
            target.scrollIntoView({ block: 'nearest' });
        }
    }
}

function handleBackButton() {
    const playerScreen = document.getElementById("player-screen");
    if (playerScreen && playerScreen.classList.contains("preview-mode")) {
        console.log("[Navigation] Back button clicked in minimized preview mode, returning to portal screen");
        const livePreviewPanel = document.getElementById("live-preview-panel");
        if (livePreviewPanel) {
            livePreviewPanel.classList.add("hidden");
        }
        const homeScreen = document.getElementById("home-screen");
        if (homeScreen) {
            homeScreen.classList.remove("preview-open");
        }
        stopVideoPlaybackCompletely();
        document.querySelectorAll(".media-card").forEach(el => {
            el.classList.remove("active-playing");
        });
        
        showScreen("portal-screen");
        return;
    }

    const screenId = activeScreenId();
    
    if (screenId === "player-screen") {
        if (state.zapDrawerOpen) {
            closeZapDrawer();
        } else {
            closeVideoPlayer();
        }
    } else if (screenId === "series-details-screen") {
        showScreen("home-screen");
        if (state.lastFocusedHomeElement && document.body.contains(state.lastFocusedHomeElement) && state.lastFocusedHomeElement.offsetWidth > 0) {
            state.lastFocusedHomeElement.focus();
        } else if (state.lastFocusedElement) {
            state.lastFocusedElement.focus();
        } else {
            focusFirst();
        }
    } else if (screenId === "home-screen") {
        showScreen("portal-screen");
    } else if (screenId === "settings-panel" || (screenId === "home-screen" && state.currentSection === "settings") || screenId === "speedtest-screen" || screenId === "linktester-screen" || screenId === "streamtester-screen") {
        const parentScreen = state.utilityParentScreen || "playlist-manager-screen";
        if (parentScreen === "portal-screen") {
            showScreen("portal-screen");
        } else {
            showScreen("playlist-manager-screen");
            if (parentScreen === "playlist-manager-screen") {
                renderPlaylistsGrid();
            }
        }
        focusFirst();
    } else if (screenId === "login-screen") {
        showScreen("playlist-manager-screen");
        renderPlaylistsGrid();
    } else if (screenId === "portal-screen") {
        showScreen("playlist-manager-screen");
        renderPlaylistsGrid();
    } else if (screenId === "playlist-manager-screen") {
        if (typeof window.webOS !== 'undefined' || /webOS/i.test(navigator.userAgent)) {
            window.close();
        } else {
            showToast("Appuyez sur Accueil pour quitter", 2000);
        }
    }
}

function restoreLastScreenState() {
    const lastScreen = safeStorage.local.getItem("shield_last_screen");
    const lastSection = safeStorage.local.getItem("shield_last_section");
    
    if (!lastScreen || lastScreen === "playlist-manager-screen" || lastScreen === "login-screen" || lastScreen === "intro-screen") {
        showScreen("portal-screen");
        return;
    }
    
    console.log(`[State Restore] Restoring screen: ${lastScreen}, section: ${lastSection}`);
    
    if (lastScreen === "home-screen" && lastSection) {
        switchSection(lastSection);
        const lastCatId = safeStorage.local.getItem("shield_last_category_id");
        if (lastCatId && lastCatId !== "all") {
            state.activeCategoryId = lastCatId;
            const cats = state.categories[lastSection] || [];
            const cat = cats.find(c => c.category_id === lastCatId);
            if (cat) {
                const breadcrumbCategory = document.getElementById("breadcrumb-category");
                if (breadcrumbCategory) breadcrumbCategory.innerText = cat.category_name;
            }
            loadCategoryStreamsCached(lastSection, lastCatId);
            // Highlight the active category item in the sidebar list
            document.querySelectorAll(".category-item").forEach(el => {
                if (el.getAttribute("data-id") === lastCatId) {
                    el.classList.add("active");
                } else {
                    el.classList.remove("active");
                }
            });
        }
    } else if (lastScreen === "series-details-screen") {
        const lastSeriesId = safeStorage.local.getItem("shield_last_series_id");
        const seriesItem = state.streams.series.find(s => s.series_id === lastSeriesId || s.id === lastSeriesId);
        if (seriesItem) {
            openSeriesDetails(seriesItem);
        } else {
            showScreen("portal-screen");
        }
    } else if (lastScreen === "speedtest-screen" || lastScreen === "linktester-screen" || lastScreen === "streamtester-screen") {
        showScreen(lastScreen);
        if (lastScreen === "streamtester-screen") {
            initStreamTesterUI();
        }
    } else {
        showScreen(lastScreen);
    }
}

function isLeftmostMediaCard(activeCard) {
    const activeRect = activeCard.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll("#media-grid .media-card"));
    for (const card of cards) {
        if (card === activeCard) continue;
        const rect = card.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            // If another card's right side is to the left of our left side (with a tiny margin)
            if (rect.right < activeRect.left - 5) {
                return false;
            }
        }
    }
    return true;
}
