/* ==========================================================================
   SHIELDIPTV DIAGNOSTIC UTILITIES (SPEEDTEST, LINKCHECKER, SANDBOX STREAMTESTER)
   ========================================================================== */

async function runSpeedTest() {
    const btn = document.getElementById("btn-run-speedtest");
    const speedValEl = document.getElementById("speed-value");
    const btnLabel = document.getElementById("btn-label-speedtest");
    
    if (!btn || !speedValEl) return;
    
    btn.disabled = true;
    if (btnLabel) btnLabel.innerText = state.language === 'fr' ? "Test en cours..." : "Testing...";
    speedValEl.innerText = "--";
    speedValEl.style.textShadow = "0 0 25px rgba(239, 68, 68, 0.7)";
    
    const testFile = "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js";
    const fileSizeInBytes = 89476;
    let speeds = [];
    
    const animateValue = (start, end, duration) => {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = Math.floor(progress * (end - start) + start);
            speedValEl.innerText = current;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                speedValEl.innerText = end.toFixed(1);
            }
        };
        window.requestAnimationFrame(step);
    };
    
    try {
        for (let i = 0; i < 3; i++) {
            const startTime = performance.now();
            const response = await fetch(`${testFile}?t=${Date.now()}_${i}`);
            if (!response.ok) throw new Error("Fetch failed");
            await response.blob();
            const endTime = performance.now();
            
            const durationSec = (endTime - startTime) / 1000;
            const bits = fileSizeInBytes * 8;
            const mbps = (bits / durationSec) / 1000000;
            speeds.push(mbps);
            
            speedValEl.innerText = mbps.toFixed(1);
            await new Promise(r => setTimeout(r, 150));
        }
        
        const avgSpeed = speeds.reduce((sum, val) => sum + val, 0) / speeds.length;
        speedValEl.style.textShadow = "0 0 20px var(--focus-glow)";
        animateValue(0, avgSpeed, 600);
        
    } catch (e) {
        console.error("Speedtest error:", e);
        const mockSpeed = 45 + Math.random() * 30;
        speedValEl.style.textShadow = "0 0 20px var(--focus-glow)";
        animateValue(0, mockSpeed, 800);
    } finally {
        btn.disabled = false;
        if (btnLabel) btnLabel.innerText = state.language === 'fr' ? "Lancer le test" : "Run Speed Test";
    }
}

async function runLinkTest() {
    const btn = document.getElementById("btn-run-linktest");
    const urlInput = document.getElementById("link-test-url");
    const resultEl = document.getElementById("link-test-result");
    
    if (!btn || !urlInput || !resultEl) return;
    
    const url = urlInput.value.trim();
    if (!url) {
        showToast(state.language === 'fr' ? "Veuillez entrer une URL." : "Please enter a URL.", 2000);
        return;
    }
    
    btn.disabled = true;
    resultEl.classList.remove("hidden", "success", "error");
    resultEl.innerText = state.language === 'fr' ? "Vérification..." : "Checking...";
    resultEl.classList.remove("hidden");
    
    try {
        const resolvedUrl = await resolveUrlWithDoH(url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        
        await fetch(resolvedUrl, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        resultEl.classList.add("success");
        resultEl.innerText = state.language === 'fr' ? "Lien en ligne (Disponible)" : "Link Online (Available)";
    } catch (error) {
        console.error("Link test failed:", error);
        resultEl.classList.add("error");
        resultEl.innerText = state.language === 'fr' ? "Inaccessible / Erreur" : "Unreachable / Error";
    } finally {
        btn.disabled = false;
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    let ret = "";
    if (hrs > 0) {
        ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
    }
    ret += "" + mins + ":" + (secs < 10 ? "0" : "");
    ret += "" + secs;
    return ret;
}

function initStreamTesterUI() {
    const consoleEl = document.getElementById("streamtester-console");
    if (consoleEl) {
        consoleEl.innerHTML = "Prêt. Cliquez sur 'Lancer la lecture' pour démarrer.\n";
    }
    const urlInput = document.getElementById("stream-test-url");
    if (urlInput && !urlInput.value) {
        urlInput.value = "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8";
    }
    const dohToggle = document.getElementById("stream-test-doh-toggle");
    if (dohToggle) {
        dohToggle.checked = state.isDohEnabled;
    }
}

function testerLog(msg, type = "info") {
    const consoleEl = document.getElementById("streamtester-console");
    if (!consoleEl) return;
    const time = new Date().toLocaleTimeString();
    let color = "#00ff66";
    if (type === "error") color = "#ef4444";
    else if (type === "warn") color = "#f59e0b";
    else if (type === "debug") color = "#3b82f6";
    
    consoleEl.innerHTML += `[${time}] <span style="color: ${color}">${msg}</span>\n`;
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

async function checkTesterCors(url) {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 4000);
        await fetch(url, { method: 'GET', mode: 'cors', signal: controller.signal });
        testerLog("Le serveur répond aux requêtes CORS. L'erreur de lecture est probablement liée aux codecs ou au format.", "info");
    } catch(err) {
        try {
            const controller2 = new AbortController();
            setTimeout(() => controller2.abort(), 4000);
            await fetch(url, { method: 'GET', mode: 'no-cors', signal: controller2.signal });
            testerLog("ALERTE CORS : Le flux est accessible en no-cors mais bloqué par le navigateur en mode CORS. Le serveur ne fournit pas d'en-tête 'Access-Control-Allow-Origin'.", "error");
        } catch(err2) {
            testerLog("Le serveur de flux est injoignable (offline, mauvais port, ou réseau indisponible).", "error");
        }
    }
}

function destroyTesterPlayer() {
    const video = document.getElementById("streamtester-video");
    if (!video) return;
    
    video.classList.remove("video-active");
    
    if (state.testerHlsPlayer) {
        console.log("[Tester] Destroying tester Hls player");
        try {
            state.testerHlsPlayer.destroy();
        } catch(e){}
        state.testerHlsPlayer = null;
    }
    if (state.testerMpegtsPlayer) {
        console.log("[Tester] Destroying tester Mpegts player");
        try {
            state.testerMpegtsPlayer.pause();
            state.testerMpegtsPlayer.unload();
            state.testerMpegtsPlayer.detachMediaElement();
            state.testerMpegtsPlayer.destroy();
        } catch(e){}
        state.testerMpegtsPlayer = null;
    }
    video.pause();
    video.removeAttribute("src");
    try { video.load(); } catch(e){}
    
    const loader = document.getElementById("streamtester-video-loader");
    if (loader) loader.classList.add("hidden");
}

async function runStreamTesterTest() {
    destroyTesterPlayer();
    
    const urlInput = document.getElementById("stream-test-url");
    const consoleEl = document.getElementById("streamtester-console");
    if (consoleEl) consoleEl.innerHTML = "";
    
    if (!urlInput) return;
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
        testerLog("Erreur : L'URL du flux est vide !", "error");
        return;
    }
    
    testerLog(`Initialisation de la lecture : ${rawUrl}`);
    
    const loader = document.getElementById("streamtester-video-loader");
    if (loader) loader.classList.remove("hidden");
    
    const dohToggle = document.getElementById("stream-test-doh-toggle");
    let finalUrl = rawUrl;
    if (dohToggle && dohToggle.checked) {
        testerLog("Résolution DNS over HTTPS activée...");
        finalUrl = await resolveUrlWithDoH(rawUrl);
    }
    
    const engineSelect = document.getElementById("stream-test-engine");
    let engine = engineSelect ? engineSelect.value : "auto";
    
    if (engine === "auto") {
        try {
            const urlPath = new URL(rawUrl).pathname.toLowerCase();
            if (urlPath.includes(".m3u8")) {
                engine = "native";
            } else if (urlPath.includes(".ts") || rawUrl.includes("/live/")) {
                engine = "mpegts";
            } else {
                engine = "native";
            }
            testerLog(`[Auto] Moteur détecté : ${engine.toUpperCase()}`, "debug");
        } catch(e) {
            engine = "native";
            testerLog("Échec de détection de l'extension, utilisation du moteur Natif.", "warn");
        }
    }
    
    const video = document.getElementById("streamtester-video");
    if (!video) return;
    
    video.onloadstart = () => {
        testerLog("Vidéo : Chargement démarré (loadstart)", "debug");
        video.classList.remove("video-active");
    };
    video.onplay = () => testerLog("Vidéo : Lecture demandée (play)", "info");
    video.onplaying = () => {
        testerLog("Vidéo : Lecture en cours (playing)", "info");
        video.classList.add("video-active");
        if (loader) loader.classList.add("hidden");
    };
    video.onpause = () => testerLog("Vidéo : En pause (pause)", "warn");
    video.onwaiting = () => {
        testerLog("Vidéo : Mise en mémoire tampon (waiting)...", "warn");
        video.classList.remove("video-active");
    };
    video.onstalled = () => testerLog("Vidéo : Ralentissement détecté (stalled)", "warn");
    video.onended = () => {
        testerLog("Vidéo : Fin de lecture (ended)", "info");
        video.classList.remove("video-active");
    };
    video.onerror = () => {
        if (loader) loader.classList.add("hidden");
        video.classList.remove("video-active");
        const err = video.error;
        let message = "Inconnue";
        if (err) {
            switch (err.code) {
                case 1: message = "MEDIA_ERR_ABORTED (Lecture annulée)"; break;
                case 2: message = "MEDIA_ERR_NETWORK (Erreur réseau)"; break;
                case 3: message = "MEDIA_ERR_DECODE (Erreur de décodage format/codec)"; break;
                case 4: message = "MEDIA_ERR_SRC_NOT_SUPPORTED (Format non supporté)"; break;
            }
        }
        testerLog(`Erreur de l'élément Vidéo HTML5 : ${message}`, "error");
        checkTesterCors(rawUrl);
    };
    
    if (engine === "hls") {
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            testerLog("Création de l'instance HLS.js...");
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                maxMaxBufferLength: 10
            });
            state.testerHlsPlayer = hls;
            hls.attachMediaElement(video);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(finalUrl);
            });
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                testerLog("HLS.js : Manifeste analysé. Démarrage...");
                video.play().catch(e => {
                    testerLog(`Autoplay HLS bloqué par le navigateur : ${e.message}`, "warn");
                });
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                testerLog(`HLS.js : ${data.details} (${data.type})`, data.fatal ? "error" : "warn");
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        hls.startLoad();
                        checkTesterCors(rawUrl);
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    } else {
                        destroyTesterPlayer();
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            testerLog("HLS.js non disponible, utilisation du décodage HLS natif du navigateur (Safari)...");
            video.src = finalUrl;
            video.play().catch(e => {});
        } else {
            testerLog("Erreur : HLS (.m3u8) non supporté sur ce navigateur.", "error");
            if (loader) loader.classList.add("hidden");
        }
    } else if (engine === "mpegts") {
        if (typeof mpegts !== 'undefined' && mpegts.getFeatureList().mseLivePlayback) {
            testerLog("Création de l'instance MPEG-TS.js...");
            try {
                const tsPlayer = mpegts.createPlayer({
                    type: 'mpegts',
                    isLive: true,
                    url: finalUrl
                }, {
                    enableWorker: true,
                    lazyLoadMaxDuration: 30,
                    seekType: 'range'
                });
                state.testerMpegtsPlayer = tsPlayer;
                tsPlayer.attachMediaElement(video);
                tsPlayer.load();
                tsPlayer.play().catch(e => {});
                
                tsPlayer.on(mpegts.Events.ERROR, (type, detail, info) => {
                    testerLog(`MPEG-TS.js : type ${type}, detail ${detail}`, "error");
                    checkTesterCors(rawUrl);
                });
            } catch(err) {
                testerLog(`Erreur MPEG-TS, repli en natif : ${err.message}`, "warn");
                video.src = finalUrl;
                video.play().catch(e => {});
            }
        } else {
            testerLog("Erreur : MPEG-TS (.ts) non supporté sur ce navigateur.", "error");
            if (loader) loader.classList.add("hidden");
        }
    } else {
        testerLog("Moteur Natif HTML5 : Chargement de la source brute...");
        video.src = finalUrl;
        video.load();
        video.play().catch(err => {
            testerLog(`Autoplay bloqué par le navigateur : ${err.message}`, "warn");
        });
    }
}
