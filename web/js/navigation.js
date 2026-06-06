/* ==========================================================================
   SHIELDIPTV NAVIGATION & VIEW SWITCHING (WITH SPATIAL D-PAD REMOTE LOGIC)
   ========================================================================== */

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.add("hidden");
    });
    const scr = document.getElementById(screenId);
    if (scr) scr.classList.remove("hidden");
    
    if (screenId !== 'home-screen' || state.currentSection !== 'live') {
        destroyPreviewMpegtsPlayer();
    }
    
    if (screenId !== 'streamtester-screen') {
        destroyTesterPlayer();
    }

    if (screenId && screenId !== "intro-screen" && screenId !== "loader" && screenId !== "player-screen") {
        localStorage.setItem("shield_last_screen", screenId);
    }
}

function activeScreenId() {
    const visibleScreen = document.querySelector(".screen:not(.hidden)");
    return visibleScreen ? visibleScreen.id : "";
}

function showLoader(text) {
    const t = TRANSLATIONS[state.language || 'fr'];
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
    localStorage.setItem("shield_last_section", section);
    const isMobileWeb = (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && 
                        window.location.protocol !== 'file:' && 
                        !window.cordova && 
                        !/SmartTV|GoogleTV|AppleTV|AndroidTV/i.test(navigator.userAgent) && 
                        window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
    console.log(`[Browser Check] Section: ${section}, isMobileWeb: ${isMobileWeb}, Width: ${window.innerWidth}, UA: ${navigator.userAgent}`);
    const warningBanner = document.getElementById("browser-warning-banner");
    if (warningBanner) {
        if (isMobileWeb && (section === 'live' || section === 'movies')) {
            warningBanner.classList.remove("hidden");
        } else {
            warningBanner.classList.add("hidden");
        }
    }

    const homeScreen = document.getElementById("home-screen");
    if (homeScreen) {
        homeScreen.setAttribute("data-section", section);
    }
    
    const catSearchBar = document.getElementById("category-search-bar");
    if (catSearchBar) {
        catSearchBar.value = "";
    }

    const t = TRANSLATIONS[state.language || 'fr'];

    if (section === 'settings') {
        state.currentSection = 'settings';
        
        document.getElementById("breadcrumb-section").innerText = t.breadcrumbSettings;
        document.getElementById("breadcrumb-category").innerText = t.breadcrumbGeneral;
        
        document.getElementById("category-sidebar").classList.add("hidden");
        document.getElementById("media-grid-container").classList.add("hidden");
        document.getElementById("settings-panel").classList.remove("hidden");
        document.getElementById("live-preview-panel").classList.add("hidden");
        
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
    destroyPreviewMpegtsPlayer();
    state.currentPlayingStream = null;
    
    showScreen("home-screen");
    
    renderCategories(state.categories[section]);
    
    state.activeCategoryId = "all";
    loadCategoryStreamsCached(section, "all");
}

function renderCategories(cats) {
    const listEl = document.getElementById("category-list");
    listEl.innerHTML = "";
    
    const t = TRANSLATIONS[state.language || 'fr'];
    
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
            localStorage.setItem("shield_last_category_id", cat.category_id);
            
            document.getElementById("breadcrumb-category").innerText = (cat.category_id === 'all') ? t.breadcrumbAll : cat.category_name;
            loadCategoryStreamsCached(state.currentSection, cat.category_id);
        });
        
        listEl.appendChild(btn);
    });
}

function loadCategoryStreamsCached(section, categoryId) {
    state.activeCategoryId = categoryId;
    localStorage.setItem("shield_last_category_id", categoryId);
    const searchBar = document.getElementById("search-bar");
    if (searchBar) {
        searchBar.value = "";
    }

    let filtered = state.streams[section];
    if (categoryId !== "all") {
        filtered = state.streams[section].filter(item => item.category_id === categoryId);
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
    
    if (items.length === 0) {
        const t = TRANSLATIONS[state.language || 'fr'];
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
    const t = TRANSLATIONS[state.language || 'fr'];
    
    batch.forEach(item => {
        const card = document.createElement("div");
        card.className = "media-card focusable";
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
        poster.loading = "lazy";
        
        const defaultPoster = section === 'live' ? PLACEHOLDERS.live : PLACEHOLDERS.vod;
        poster.src = item.stream_icon || item.cover || defaultPoster;
        poster.onerror = () => {
            poster.src = defaultPoster;
        };
        
        posterWrapper.appendChild(poster);
        
        if (section !== 'live' && item.rating) {
            const rating = document.createElement("div");
            rating.className = "media-rating";
            rating.innerHTML = `<span class="material-icons">star</span><span>${parseFloat(item.rating).toFixed(1)}</span>`;
            posterWrapper.appendChild(rating);
        }
        
        const title = document.createElement("div");
        title.className = "media-title";
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
    const totalItems = state.currentGridItems.length;
    const loadedCount = state.gridCurrentPage * state.gridItemsPerPage;
    if (loadedCount >= totalItems) return;
    
    const nextBatch = state.currentGridItems.slice(loadedCount, loadedCount + state.gridItemsPerPage);
    state.gridCurrentPage++;
    appendItemsToGrid(nextBatch, section);
    console.log(`[Grid Pagination] Page ${state.gridCurrentPage} appended. Total rendered: ${state.gridCurrentPage * state.gridItemsPerPage}/${totalItems}`);
}

// Spatial Navigation Setup
function setupSpatialNavigation() {
    window.addEventListener("keydown", (e) => {
        const key = e.key;
        
        if (activeScreenId() === "player-screen") {
            resetPlayerActivity();
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
            if (!isTvWrapper) {
                if (key === 'Enter') {
                    const active = document.activeElement;
                    if (active && active.classList.contains("focusable")) {
                        if (active.tagName !== 'INPUT' && active.tagName !== 'SELECT') {
                            e.preventDefault();
                            active.click();
                        }
                    }
                }
                if ((key === 'ArrowLeft' || key === 'ArrowRight') && activeScreenId() === "player-screen") {
                    const video = document.getElementById("video-player");
                    if (video && video.duration) {
                        e.preventDefault();
                        if (key === 'ArrowLeft') {
                            video.currentTime = Math.max(0, video.currentTime - 10);
                        } else {
                            video.currentTime = Math.min(video.duration, video.currentTime + 10);
                        }
                    }
                }
                return;
            }

            const active = document.activeElement;
            const container = document.getElementById(activeScreenId());
            const activeOverlay = document.querySelector(".screen-overlay:not(.hidden)");
            const targetContainer = activeOverlay || container;
            
            if (!active || active === document.body || !active.classList.contains("focusable") || (targetContainer && !targetContainer.contains(active))) {
                e.preventDefault();
                focusFirst();
                return;
            }
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            const active = document.activeElement;
            if (active && active.id === 'player-progress-bar') {
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
            
            e.preventDefault();
            const direction = key.replace('Arrow', '').toLowerCase();
            moveFocus(direction);
        } else if (key === 'Enter') {
            const active = document.activeElement;
            if (active && active.classList.contains("focusable")) {
                if (active.tagName !== 'INPUT' && active.tagName !== 'SELECT') {
                    e.preventDefault();
                    active.click();
                }
            }
        } else if (key === 'Escape' || key === 'Back' || key === 'Backspace' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            handleBackButton();
        }
    });
    
    document.addEventListener("focusin", (e) => {
        const target = e.target;
        if (target && target.classList.contains("media-card")) {
            state.lastFocusedElement = target;
        }
    });
}

function moveFocus(direction) {
    const active = document.activeElement;
    if (!active || !active.classList.contains('focusable')) {
        focusFirst();
        return;
    }
    
    if (active.id === 'player-btn-back' && direction === 'right') {
        return;
    }
    
    const candidates = Array.from(document.querySelectorAll(
        '.screen:not(.hidden) .focusable, .screen-overlay:not(.hidden) .focusable, .zap-drawer:not(.hidden) .focusable'
    ));
    
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
        
        let isDirectional = false;
        let distance = 0;
        const margin = 5;
        
        if (direction === 'left') {
            isDirectional = (centerCandidate.x < centerActive.x - margin);
            distance = Math.abs(deltaX) + Math.abs(deltaY) * 2.5; 
        } else if (direction === 'right') {
            isDirectional = (centerCandidate.x > centerActive.x + margin);
            distance = Math.abs(deltaX) + Math.abs(deltaY) * 2.5;
        } else if (direction === 'up') {
            isDirectional = (centerCandidate.y < centerActive.y - margin);
            distance = Math.abs(deltaY) + Math.abs(deltaX) * 2.5;
        } else if (direction === 'down') {
            isDirectional = (centerCandidate.y > centerActive.y + margin);
            distance = Math.abs(deltaY) + Math.abs(deltaX) * 2.5;
        }
        
        if (isDirectional && distance < minDistance) {
            minDistance = distance;
            bestCandidate = candidate;
        }
    });
    
    if (bestCandidate) {
        bestCandidate.focus();
        bestCandidate.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
        });
    }
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
        } else if (screenId === 'home-screen') {
            target = container.querySelector(".category-item.active") || 
                     container.querySelector(".category-item") || 
                     container.querySelector(".media-card") || 
                     container.querySelector(".focusable:not(.btn-back-round):not(#btn-header-back):not(#search-bar):not(#category-search-bar)");
        }
        
        if (!target) {
            target = container.querySelector(".focusable");
        }
        
        if (target) {
            target.focus();
            target.scrollIntoView({ block: 'nearest' });
        }
    }
}

function handleBackButton() {
    const screenId = activeScreenId();
    
    if (screenId === "player-screen") {
        if (state.zapDrawerOpen) {
            closeZapDrawer();
        } else {
            closeVideoPlayer();
        }
    } else if (screenId === "series-details-screen") {
        showScreen("home-screen");
        if (state.lastFocusedElement) {
            state.lastFocusedElement.focus();
        } else {
            focusFirst();
        }
    } else if (screenId === "home-screen") {
        showScreen("portal-screen");
    } else if (screenId === "settings-panel" || screenId === "home-screen" && state.currentSection === "settings" || screenId === "speedtest-screen" || screenId === "linktester-screen") {
        showScreen("portal-screen");
    } else if (screenId === "login-screen") {
        showScreen("playlist-manager-screen");
        renderPlaylistsGrid();
    } else if (screenId === "portal-screen") {
        showScreen("playlist-manager-screen");
        renderPlaylistsGrid();
    } else if (screenId === "playlist-manager-screen") {
        showToast("Appuyez sur Accueil pour quitter", 2000);
    }
}

function restoreLastScreenState() {
    const lastScreen = localStorage.getItem("shield_last_screen");
    const lastSection = localStorage.getItem("shield_last_section");
    
    if (!lastScreen || lastScreen === "playlist-manager-screen" || lastScreen === "login-screen" || lastScreen === "intro-screen") {
        showScreen("portal-screen");
        return;
    }
    
    console.log(`[State Restore] Restoring screen: ${lastScreen}, section: ${lastSection}`);
    
    if (lastScreen === "home-screen" && lastSection) {
        switchSection(lastSection);
        const lastCatId = localStorage.getItem("shield_last_category_id");
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
        const lastSeriesId = localStorage.getItem("shield_last_series_id");
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
