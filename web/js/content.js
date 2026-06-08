/* ==========================================================================
   SHIELDIPTV CONTENT DETAIL VIEWS (SERIES METADATA & EPISODES RENDERING)
   ========================================================================== */

async function openSeriesDetails(item) {
    localStorage.setItem("shield_last_series_id", item.series_id || item.id);
    const t = TRANSLATIONS[state.language || 'en'];
    
    if (state.currentPlaylistType === 'demo' || state.currentPlaylistType === 'm3u' || item.episodes) {
        state.currentSeriesDetails = {
            info: {
                name: item.name,
                plot: item.plot || (state.language === 'fr' ? "Série importée via playlist." : "Series imported via playlist."),
                genre: item.category_name || "Série",
                rating: item.rating || "5.0",
                releaseDate: "N/A",
                cast: "N/A",
                director: "N/A",
                cover: item.cover
            },
            episodes: item.episodes || {}
        };
        
        showScreen("series-details-screen");
        
        document.getElementById("series-title").innerText = item.name;
        document.getElementById("series-plot").innerText = state.currentSeriesDetails.info.plot;
        document.getElementById("series-category").innerText = state.currentSeriesDetails.info.genre;
        document.getElementById("series-rating").innerText = parseFloat(state.currentSeriesDetails.info.rating).toFixed(1);
        document.getElementById("series-release").innerText = "N/A";
        document.getElementById("series-cast").innerText = "N/A";
        document.getElementById("series-director").innerText = "N/A";
        
        const posterImg = document.getElementById("series-poster");
        posterImg.src = item.cover || PLACEHOLDERS.vod;
        posterImg.onerror = () => { posterImg.src = PLACEHOLDERS.vod; };
        
        const backdropEl = document.getElementById("series-backdrop");
        if (item.cover) {
            backdropEl.style.backgroundImage = `url('${item.cover}')`;
        } else {
            backdropEl.style.backgroundImage = 'none';
        }
        
        document.querySelector(".series-details-container").scrollTop = 0;
        renderSeasons(item.episodes || {});
        return;
    }
    
    showLoader(t.toastSeriesDetailsLoad);
    
    try {
        const details = await makeApiCall('get_series_info', `&series_id=${item.series_id}`);
        hideLoader();
        
        if (!details) {
            showToast(t.toastSeriesDetailsError, 3000);
            return;
        }
        
        state.currentSeriesDetails = details;
        showScreen("series-details-screen");
        
        const info = details.info || {};
        document.getElementById("series-title").innerText = info.name || item.name;
        document.getElementById("series-plot").innerText = info.plot || t.seriesPlotFallback;
        document.getElementById("series-category").innerText = info.genre || (state.language === 'fr' ? "Série" : "Series");
        document.getElementById("series-rating").innerText = parseFloat(info.rating || 0).toFixed(1);
        document.getElementById("series-release").innerText = info.releaseDate || "N/A";
        document.getElementById("series-cast").innerText = info.cast || "N/A";
        document.getElementById("series-director").innerText = info.director || "N/A";
        
        const posterImg = document.getElementById("series-poster");
        posterImg.src = info.cover || item.cover || PLACEHOLDERS.vod;
        posterImg.onerror = () => { posterImg.src = PLACEHOLDERS.vod; };
        
        const backdropUrl = (info.backdrop_path && info.backdrop_path.length > 0) ? info.backdrop_path[0] : (info.cover || item.cover);
        const backdropEl = document.getElementById("series-backdrop");
        if (backdropUrl) {
            backdropEl.style.backgroundImage = `url('${backdropUrl}')`;
        } else {
            backdropEl.style.backgroundImage = 'none';
        }
        
        document.querySelector(".series-details-container").scrollTop = 0;
        
        renderSeasons(details.episodes || {});
        
    } catch (e) {
        hideLoader();
        showToast("Erreur : " + e.message, 4000);
    }
}

function renderSeasons(episodesMap) {
    const t = TRANSLATIONS[state.language || 'en'];
    const seasonsBar = document.getElementById("seasons-bar");
    seasonsBar.innerHTML = "";
    
    const seasonNums = Object.keys(episodesMap);
    
    if (seasonNums.length === 0) {
        seasonsBar.innerHTML = `<p>${t.toastNoSeasons}</p>`;
        document.getElementById("episodes-list").innerHTML = "";
        return;
    }
    
    seasonNums.sort((a, b) => parseInt(a) - parseInt(b));
    
    seasonNums.forEach((seasonNum, index) => {
        const btn = document.createElement("button");
        btn.className = "season-btn focusable";
        btn.innerText = `${t.seasonPrefix} ${seasonNum}`;
        btn.setAttribute("data-season", seasonNum);
        
        if (index === 0) {
            btn.classList.add("active");
            state.activeSeasonNum = seasonNum;
            renderEpisodes(episodesMap[seasonNum], seasonNum);
        }
        
        btn.addEventListener("click", () => {
            document.querySelectorAll(".season-btn").forEach(el => el.classList.remove("active"));
            btn.classList.add("active");
            state.activeSeasonNum = seasonNum;
            renderEpisodes(episodesMap[seasonNum], seasonNum);
        });
        
        seasonsBar.appendChild(btn);
    });
}

function renderEpisodes(epList, seasonNum) {
    const t = TRANSLATIONS[state.language || 'en'];
    const episodesList = document.getElementById("episodes-list");
    episodesList.innerHTML = "";
    
    if (!epList || epList.length === 0) {
        episodesList.innerHTML = `<p>${t.toastNoEpisodes}</p>`;
        return;
    }
    
    const seriesName = (state.currentSeriesDetails && state.currentSeriesDetails.info) ? (state.currentSeriesDetails.info.name || "") : "";
    
    epList.forEach(ep => {
        const card = document.createElement("div");
        card.className = "episode-card focusable";
        card.setAttribute("tabindex", "0");
        card.setAttribute("data-id", ep.id);
        
        const meta = document.createElement("div");
        meta.className = "episode-meta";
        
        const epNum = document.createElement("span");
        epNum.className = "episode-number";
        epNum.innerText = `${t.episodeLabel} ${ep.episode_num || ep.num}`;
        meta.appendChild(epNum);
        
        const cleanTitle = ep.title ? cleanEpisodeTitle(ep.title, seriesName) : `${t.seasonPrefix} ${seasonNum} ${t.episodeLabelZap} ${ep.episode_num || ep.num}`;
        
        const epTitle = document.createElement("span");
        epTitle.className = "episode-title";
        epTitle.innerText = cleanTitle;
        meta.appendChild(epTitle);
        
        card.appendChild(meta);
        
        const playIcon = document.createElement("div");
        playIcon.className = "episode-play-icon";
        playIcon.innerHTML = `<span class="material-icons">play_arrow</span>`;
        card.appendChild(playIcon);
        
        card.addEventListener("click", () => {
            const ext = ep.container_extension || "mp4";
            const playUrl = ep.url || `${state.serverUrl}/series/${state.username}/${state.password}/${ep.id}.${ext}`;
            const displayTitle = ep.title ? cleanEpisodeTitle(ep.title, seriesName) : `${t.seasonPrefix} ${seasonNum} ${t.episodeLabelZap} ${ep.episode_num || ep.num}`;
            
            state.currentPlayingStream = { item: ep, section: 'series', seasonNum: seasonNum };
            launchVideoPlayer(playUrl, displayTitle, state.currentSeriesDetails.info.cover);
        });
        
        episodesList.appendChild(card);
    });
}
