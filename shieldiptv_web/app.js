/* ==========================================================================
   SHIELDIPTV APP ENGINE (PURE VANILLA JS) - V4
   ========================================================================== */


// Fallback dynamic placeholder SVG Data-URIs (Resolves poster loading delays & mixed content issues)
const PLACEHOLDERS = {
    live: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150"><rect width="300" height="150" fill="%230f1423"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Outfit,sans-serif" font-size="18" fill="%2364748b">Direct TV</text></svg>',
    vod: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%230f1423"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Outfit,sans-serif" font-size="18" fill="%2364748b">ShieldIPTV</text></svg>'
};

// Helper to decode Base64 encoded UTF-8 strings (resolves EPG character encoding issues)
function decodeUtf8Base64(base64Str) {
    if (!base64Str) return "";
    try {
        const binaryString = atob(base64Str);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
        try {
            return atob(base64Str);
        } catch (err) {
            return base64Str;
        }
    }
}

// Helper to strip series name and season/episode code from episode title
function cleanEpisodeTitle(title, seriesName) {
    if (!title) return "";
    let clean = title;
    
    // Try to find a season-episode pattern like S01E01, E01, Saison 1 Episode 1
    const sePattern = /\b(s\d+\s*[-]?\s*e\d+|e\d+|saison\s*\d+\s*épisode\s*\d+)\b/i;
    const match = title.match(sePattern);
    
    if (match) {
        // Take everything after the matched pattern
        const index = title.indexOf(match[0]);
        clean = title.substring(index + match[0].length);
        // Remove leading separators
        clean = clean.replace(/^[\s\-:]+/, '');
    } else {
        if (seriesName) {
            const escapedSeriesName = seriesName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp('^' + escapedSeriesName + '\\s*([-:]\\s*)?', 'i');
            clean = clean.replace(regex, '');
        }
    }
    
    clean = clean.trim();
    return clean || title;
}

// Global Translation Dictionary
const TRANSLATIONS = {
    fr: {
        loaderInit: "Chargement de votre univers IPTV...",
        loginSubtitle: "Entrez vos informations Xtream Codes pour vous connecter",
        serverUrl: "URL du serveur",
        username: "Nom d'utilisateur",
        password: "Mot de passe",
        connect: "Se connecter",
        accountLabel: "Compte :",
        liveTv: "LIVE TV",
        liveTvDesc: "Chaînes en direct & EPG",
        movies: "FILMS",
        moviesDesc: "Films à la demande (VOD)",
        series: "SÉRIES",
        seriesDesc: "Séries TV & Saisons",
        searchPlaceholder: "Rechercher...",
        searchCategoryPlaceholder: "Rechercher un bouquet...",
        epgTitle: "Guide des Programmes",
        epgLoading: "Chargement du guide...",
        epgEmpty: "Aucun programme disponible pour le moment.",
        epgUnavailable: "Guide de programme indisponible.",
        settingsTitle: "Paramètres globaux",
        dohTitle: "DNS over HTTPS (DoH)",
        dohDesc: "Permet de contourner les blocages DNS imposés par certains FAI pour lire les flux IPTV.",
        dohEnable: "Activer DoH",
        dohResolver: "Résolveur DoH",
        langTitle: "Langue",
        langDesc: "Sélectionnez la langue de l'interface.",
        langLabel: "Langue",
        subInfo: "Informations de l'abonnement",
        subStatus: "Statut du compte :",
        subExpiry: "Date d'expiration :",
        subMaxConn: "Connexions Max :",
        subServer: "Serveur IPTV :",
        logout: "Se déconnecter",
        seriesDetailsTitle: "Fiche de la Série",
        seriesPlotFallback: "Synopsis non disponible.",
        seriesCast: "Acteurs :",
        seriesDirector: "Réalisateur :",
        seasons: "Saisons",
        episodes: "Épisodes",
        playerNowPlaying: "Programme en cours...",
        playerLoaderText: "Chargement du flux...",
        zapTitle: "Zapping rapide",
        zapPrev: "Chaîne précédente",
        zapNext: "Chaîne suivante",
        prev10: "Reculer de 10s",
        next10: "Avancer de 10s",
        playPause: "Lecture/Pause",
        zapListTitle: "Liste des chaînes",
        fullscreen: "Plein Écran",
        toastLoginSuccess: "Connexion réussie !",
        toastLoginAutoFail: "Reconnexion automatique échouée.",
        toastLoginError: "Erreur de connexion : ",
        toastLoginAuth: "Authentification auprès du serveur...",
        toastPreloadCats: "Pré-chargement des catégories...",
        toastPreloadLive: "Pré-chargement de la Playlist TV...",
        toastPreloadMovies: "Pré-chargement des Films (VOD)...",
        toastPreloadSeries: "Pré-chargement des Séries TV...",
        toastEmptyCategory: "Aucun contenu trouvé dans cette catégorie.",
        toastSeriesDetailsLoad: "Chargement de la fiche série...",
        toastSeriesDetailsError: "Impossible de charger les informations de cette série.",
        toastNoSeasons: "Aucune saison disponible.",
        toastNoEpisodes: "Aucun épisode disponible.",
        seasonPrefix: "Saison",
        episodeLabel: "ÉPISODE",
        episodeLabelZap: "Ép.",
        zappingLabel: "Zapping : ",
        toastLogout: "Déconnexion réussie.",
        loaderDefault: "Chargement...",
        playerStreamError: "Erreur : Impossible de lire ce flux vidéo.",
        dohEnabledToast: "DoH activé",
        dohDisabledToast: "DoH désactivé",
        dohUpdatedToast: "Résolveur DoH mis à jour",
        langUpdatedToast: "Langue mise à jour",
        activeText: "Actif",
        inactiveText: "Inactif",
        breadcrumbLive: "Live TV",
        breadcrumbMovies: "Films",
        breadcrumbSeries: "Séries",
        breadcrumbSettings: "Paramètres",
        breadcrumbGeneral: "Général",
        breadcrumbAll: "Tout",
        untitled: "Sans titre",
        browserWarningTitle: "Lecture limitée sur navigateur",
        browserWarningDesc: "Pour regarder le Direct et les Films, veuillez utiliser notre application dédiée. Seules les Séries sont disponibles sur le web.",
        browserPlayBlocked: "Ce contenu nécessite l'application ShieldIPTV pour être lu."
    },
    en: {
        loaderInit: "Loading your IPTV universe...",
        loginSubtitle: "Enter your Xtream Codes credentials to connect",
        serverUrl: "Server URL",
        username: "Username",
        password: "Password",
        connect: "Connect",
        accountLabel: "Account:",
        liveTv: "LIVE TV",
        liveTvDesc: "Live channels & EPG",
        movies: "MOVIES",
        moviesDesc: "Movies on demand (VOD)",
        series: "SERIES",
        seriesDesc: "TV Series & Seasons",
        searchPlaceholder: "Search...",
        searchCategoryPlaceholder: "Search bouquet...",
        epgTitle: "Program Guide",
        epgLoading: "Loading guide...",
        epgEmpty: "No program available at the moment.",
        epgUnavailable: "Program guide unavailable.",
        settingsTitle: "Global Settings",
        dohTitle: "DNS over HTTPS (DoH)",
        dohDesc: "Allows bypassing DNS blocking imposed by some ISPs to play IPTV streams.",
        dohEnable: "Enable DoH",
        dohResolver: "DoH Resolver",
        langTitle: "Language",
        langDesc: "Select the interface language.",
        langLabel: "Language",
        subInfo: "Subscription Information",
        subStatus: "Account Status:",
        subExpiry: "Expiration Date:",
        subMaxConn: "Max Connections:",
        subServer: "IPTV Server:",
        logout: "Log out",
        seriesDetailsTitle: "Series Details",
        seriesPlotFallback: "Synopsis not available.",
        seriesCast: "Cast:",
        seriesDirector: "Director:",
        seasons: "Seasons",
        episodes: "Episodes",
        playerNowPlaying: "Current program...",
        playerLoaderText: "Loading stream...",
        zapTitle: "Quick Zapping",
        zapPrev: "Previous Channel",
        zapNext: "Next Channel",
        prev10: "Rewind 10s",
        next10: "Fast Forward 10s",
        playPause: "Play/Pause",
        zapListTitle: "Channels List",
        fullscreen: "Fullscreen",
        toastLoginSuccess: "Login successful!",
        toastLoginAutoFail: "Automatic reconnection failed.",
        toastLoginError: "Connection error: ",
        toastLoginAuth: "Authenticating with server...",
        toastPreloadCats: "Pre-loading categories...",
        toastPreloadLive: "Pre-loading Live Playlist...",
        toastPreloadMovies: "Pre-loading Movies (VOD)...",
        toastPreloadSeries: "Pre-loading TV Series...",
        toastEmptyCategory: "No content found in this category.",
        toastSeriesDetailsLoad: "Loading series details...",
        toastSeriesDetailsError: "Cannot load details for this series.",
        toastNoSeasons: "No seasons available.",
        toastNoEpisodes: "No episodes available.",
        seasonPrefix: "Season",
        episodeLabel: "EPISODE",
        episodeLabelZap: "Ep.",
        zappingLabel: "Zapping: ",
        toastLogout: "Logged out successfully.",
        loaderDefault: "Loading...",
        playerStreamError: "Error: Unable to play this video stream.",
        dohEnabledToast: "DoH enabled",
        dohDisabledToast: "DoH disabled",
        dohUpdatedToast: "DoH resolver updated",
        langUpdatedToast: "Language updated",
        activeText: "Active",
        inactiveText: "Inactive",
        breadcrumbLive: "Live TV",
        breadcrumbMovies: "Movies",
        breadcrumbSeries: "Series",
        breadcrumbSettings: "Settings",
        breadcrumbGeneral: "General",
        breadcrumbAll: "All",
        untitled: "Untitled",
        browserWarningTitle: "Browser Playback Limited",
        browserWarningDesc: "To watch Live TV and Movies, please use our dedicated app. Only Series are available on the web.",
        browserPlayBlocked: "This content requires the ShieldIPTV application to play."
    },
    es: {
        loaderInit: "Cargando su universo IPTV...",
        loginSubtitle: "Ingrese sus credenciales de Xtream Codes para conectarse",
        serverUrl: "URL del servidor",
        username: "Nombre de usuario",
        password: "Contraseña",
        connect: "Conectarse",
        accountLabel: "Cuenta:",
        liveTv: "TV EN VIVO",
        liveTvDesc: "Canales en vivo y EPG",
        movies: "PELÍCULAS",
        moviesDesc: "Películas bajo demanda (VOD)",
        series: "SERIES",
        seriesDesc: "Series de TV y Temporadas",
        searchPlaceholder: "Buscar...",
        searchCategoryPlaceholder: "Buscar bouquet...",
        epgTitle: "Guía de Programación",
        epgLoading: "Cargando guía...",
        epgEmpty: "Ningún programa disponible por el momento.",
        epgUnavailable: "Guía de programación no disponible.",
        settingsTitle: "Ajustes Globales",
        dohTitle: "DNS sobre HTTPS (DoH)",
        dohDesc: "Permite eludir los bloqueos de DNS impuestos por algunos proveedores de Internet para reproducir transmisiones de IPTV.",
        dohEnable: "Activar DoH",
        dohResolver: "Servidor DoH",
        langTitle: "Idioma",
        langDesc: "Seleccione el idioma de la interfaz.",
        langLabel: "Idioma",
        subInfo: "Información de la Suscripción",
        subStatus: "Estado de la cuenta:",
        subExpiry: "Fecha de expiración:",
        subMaxConn: "Conexiones máximas:",
        subServer: "Servidor IPTV:",
        logout: "Cerrar sesión",
        seriesDetailsTitle: "Detalles de la Serie",
        seriesPlotFallback: "Sinopsis no disponible.",
        seriesCast: "Reparto:",
        seriesDirector: "Director:",
        seasons: "Temporadas",
        episodes: "Episodios",
        playerNowPlaying: "Programa actual...",
        playerLoaderText: "Cargando transmisión...",
        zapTitle: "Zapping rápido",
        zapPrev: "Canal anterior",
        zapNext: "Canal siguiente",
        prev10: "Retroceder 10s",
        next10: "Adelantar 10s",
        playPause: "Reproducir/Pausar",
        zapListTitle: "Lista de canales",
        fullscreen: "Pantalla completa",
        toastLoginSuccess: "¡Inicio de sesión exitoso!",
        toastLoginAutoFail: "Reconexión automática fallida.",
        toastLoginError: "Error de conexión: ",
        toastLoginAuth: "Autenticando con el servidor...",
        toastPreloadCats: "Precargando categorías...",
        toastPreloadLive: "Precargando lista de TV...",
        toastPreloadMovies: "Precargando películas (VOD)...",
        toastPreloadSeries: "Precargando series de TV...",
        toastEmptyCategory: "No se encontró contenido en esta categoría.",
        toastSeriesDetailsLoad: "Cargando detalles de la serie...",
        toastSeriesDetailsError: "No se pudieron cargar los detalles de esta serie.",
        toastNoSeasons: "No hay temporadas disponibles.",
        toastNoEpisodes: "No hay episodios disponibles.",
        seasonPrefix: "Temporada",
        episodeLabel: "EPISODIO",
        episodeLabelZap: "Ep.",
        zappingLabel: "Zapping: ",
        toastLogout: "Sesión cerrada correctamente.",
        loaderDefault: "Cargando...",
        playerStreamError: "Error: No se puede reproducir esta transmisión de video.",
        dohEnabledToast: "DoH activado",
        dohDisabledToast: "DoH desactivado",
        dohUpdatedToast: "Servidor DoH actualizado",
        langUpdatedToast: "Idioma actualizado",
        activeText: "Activo",
        inactiveText: "Inactivo",
        breadcrumbLive: "TV en Vivo",
        breadcrumbMovies: "Películas",
        breadcrumbSeries: "Series",
        breadcrumbSettings: "Ajustes",
        breadcrumbGeneral: "General",
        breadcrumbAll: "Todo",
        untitled: "Sin título",
        browserWarningTitle: "Reproducción limitada en el navegador",
        browserWarningDesc: "Para ver canales en vivo y películas, utilice nuestra aplicación dedicada. Solo las series están disponibles en la web.",
        browserPlayBlocked: "Este contenido requiere la aplicación ShieldIPTV para reproducirse."
    },
    it: {
        loaderInit: "Caricamento del tuo universo IPTV...",
        loginSubtitle: "Inserisci le tue credenziali Xtream Codes per connetterti",
        serverUrl: "URL del server",
        username: "Nome utente",
        password: "Password",
        connect: "Accedi",
        accountLabel: "Account:",
        liveTv: "TV IN DIRETTA",
        liveTvDesc: "Canali in diretta & EPG",
        movies: "FILM",
        moviesDesc: "Film su richiesta (VOD)",
        series: "SERIE TV",
        seriesDesc: "Serie TV & Stagioni",
        searchPlaceholder: "Cerca...",
        searchCategoryPlaceholder: "Cerca bouquet...",
        epgTitle: "Guida Programmi",
        epgLoading: "Caricamento guida...",
        epgEmpty: "Nessun programma disponibile al momento.",
        epgUnavailable: "Guida programmi non disponibile.",
        settingsTitle: "Impostazioni Generali",
        dohTitle: "DNS over HTTPS (DoH)",
        dohDesc: "Consente di aggirare i blocchi DNS imposti da alcuni ISP per riprodurre i flussi IPTV.",
        dohEnable: "Attiva DoH",
        dohResolver: "Risolutore DoH",
        langTitle: "Lingua",
        langDesc: "Seleziona la lingua dell'interfaccia.",
        langLabel: "Lingua",
        subInfo: "Informazioni sull'abbonamento",
        subStatus: "Stato dell'account:",
        subExpiry: "Data di scadenza:",
        subMaxConn: "Connessioni Max:",
        subServer: "Server IPTV:",
        logout: "Disconnetti",
        seriesDetailsTitle: "Dettagli Serie",
        seriesPlotFallback: "Sinossi non disponibile.",
        seriesCast: "Cast:",
        seriesDirector: "Regista:",
        seasons: "Stagioni",
        episodes: "Episodi",
        playerNowPlaying: "Programma in corso...",
        playerLoaderText: "Caricamento flusso...",
        zapTitle: "Zapping rapido",
        zapPrev: "Canale precedente",
        zapNext: "Canale successivo",
        prev10: "Indietro di 10s",
        next10: "Avanti di 10s",
        playPause: "Riproduci/Pausa",
        zapListTitle: "Elenco dei canali",
        fullscreen: "Schermo intero",
        toastLoginSuccess: "Accesso riuscito!",
        toastLoginAutoFail: "Riconnessione automatica non riuscita.",
        toastLoginError: "Errore di connessione: ",
        toastLoginAuth: "Autenticazione con il server...",
        toastPreloadCats: "Precaricamento categorie...",
        toastPreloadLive: "Precaricamento canali...",
        toastPreloadMovies: "Precaricamento film (VOD)...",
        toastPreloadSeries: "Precaricamento serie TV...",
        toastEmptyCategory: "Nessun contenuto trovato in questa categoria.",
        toastSeriesDetailsLoad: "Caricamento dettagli serie...",
        toastSeriesDetailsError: "Impossibile caricare i dettagli di questa serie.",
        toastNoSeasons: "Nessuna stagione disponibile.",
        toastNoEpisodes: "Nessun episodio disponibile.",
        seasonPrefix: "Stagione",
        episodeLabel: "EPISODIO",
        episodeLabelZap: "Ep.",
        zappingLabel: "Zapping: ",
        toastLogout: "Disconnessione riuscita.",
        loaderDefault: "Caricamento...",
        playerStreamError: "Errore: impossibile riprodurre questo flusso video.",
        dohEnabledToast: "DoH attivato",
        dohDisabledToast: "DoH disattivato",
        dohUpdatedToast: "Risolutore DoH aggiornato",
        langUpdatedToast: "Lingua aggiornata",
        activeText: "Attivo",
        inactiveText: "Inattivo",
        breadcrumbLive: "TV in Diretta",
        breadcrumbMovies: "Film",
        breadcrumbSeries: "Serie",
        breadcrumbSettings: "Impostazioni",
        breadcrumbGeneral: "Generale",
        breadcrumbAll: "Tutto",
        untitled: "Senza titolo",
        browserWarningTitle: "Riproduzione limitata nel browser",
        browserWarningDesc: "Per guardare la TV in diretta e i film, utilizza la nostra app dedicata. Solo le serie sono disponibili sul web.",
        browserPlayBlocked: "Questo contenuto richiede l'applicazione ShieldIPTV per essere riprodotto."
    }
};

function detectLanguage() {
    const hash = window.location.hash;
    if (hash) {
        const matched = hash.match(/^#?\/?([a-z]{2})/i);
        if (matched && TRANSLATIONS[matched[1].toLowerCase()]) {
            return matched[1].toLowerCase();
        }
    }
    
    const savedSettings = localStorage.getItem("shield_iptv_settings");
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            if (settings.language && TRANSLATIONS[settings.language]) {
                return settings.language;
            }
        } catch (e) {}
    }
    
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang) {
        const code = browserLang.substring(0, 2).toLowerCase();
        if (TRANSLATIONS[code]) {
            return code;
        }
    }
    
    return 'fr';
}

function applyLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'fr';
    state.language = lang;
    
    const savedSettings = localStorage.getItem("shield_iptv_settings") || "{}";
    try {
        const settings = JSON.parse(savedSettings);
        settings.language = lang;
        localStorage.setItem("shield_iptv_settings", JSON.stringify(settings));
    } catch(e) {}
    
    const langSelect = document.getElementById("setting-lang-select");
    if (langSelect) {
        langSelect.value = lang;
    }
    
    if (window.location.hash !== "#/" + lang) {
        window.location.hash = "/" + lang;
    }
    
    const t = TRANSLATIONS[lang];
    
    const loaderText = document.getElementById("loader-text");
    if (loaderText && loaderText.innerText.includes("univers")) {
        loaderText.innerText = t.loaderInit;
    }
    
    const loginSubtitle = document.querySelector("#login-screen .subtitle");
    if (loginSubtitle) loginSubtitle.innerText = t.loginSubtitle;
    
    const labelUrl = document.querySelector('label[for="login-url"]');
    if (labelUrl) labelUrl.innerText = t.serverUrl;
    
    const labelUser = document.querySelector('label[for="login-username"]');
    if (labelUser) labelUser.innerText = t.username;
    
    const labelPass = document.querySelector('label[for="login-password"]');
    if (labelPass) labelPass.innerText = t.password;
    
    const btnConnect = document.getElementById("btn-connect");
    if (btnConnect) {
        const span = btnConnect.querySelector("span:not(.material-icons)");
        if (span) span.innerText = t.connect;
    }
    
    const portalUserLabel = document.querySelector(".portal-username-label");
    if (portalUserLabel) {
        portalUserLabel.innerHTML = `${t.accountLabel} <strong id="portal-username">${state.username || 'Bilal'}</strong>`;
    }
    
    const cardLive = document.getElementById("portal-card-live");
    if (cardLive) {
        const h3 = cardLive.querySelector("h3");
        const p = cardLive.querySelector("p");
        if (h3) h3.innerText = t.liveTv;
        if (p) p.innerText = t.liveTvDesc;
    }
    
    const cardMovies = document.getElementById("portal-card-movies");
    if (cardMovies) {
        const h3 = cardMovies.querySelector("h3");
        const p = cardMovies.querySelector("p");
        if (h3) h3.innerText = t.movies;
        if (p) p.innerText = t.moviesDesc;
    }
    
    const cardSeries = document.getElementById("portal-card-series");
    if (cardSeries) {
        const h3 = cardSeries.querySelector("h3");
        const p = cardSeries.querySelector("p");
        if (h3) h3.innerText = t.series;
        if (p) p.innerText = t.seriesDesc;
    }
    
    const searchBar = document.getElementById("search-bar");
    if (searchBar) searchBar.placeholder = t.searchPlaceholder;
    
    const catSearchBar = document.getElementById("category-search-bar");
    if (catSearchBar) catSearchBar.placeholder = t.searchCategoryPlaceholder;
    
    const settingsH2 = document.querySelector("#settings-panel h2");
    if (settingsH2) settingsH2.innerText = t.settingsTitle;
    
    const dohGroup = document.querySelector("#settings-panel .settings-group:nth-of-type(1)");
    if (dohGroup) {
        const h3 = dohGroup.querySelector("h3");
        const desc = dohGroup.querySelector(".settings-desc");
        const labelToggle = dohGroup.querySelector('label[for="setting-doh-toggle"]');
        const labelSelect = dohGroup.querySelector('label[for="setting-doh-url"]');
        if (h3) h3.innerText = t.dohTitle;
        if (desc) desc.innerText = t.dohDesc;
        if (labelToggle) labelToggle.innerText = t.dohEnable;
        if (labelSelect) labelSelect.innerText = t.dohResolver;
    }
    
    const langGroup = document.querySelector("#settings-panel .settings-group:nth-of-type(2)");
    if (langGroup) {
        const h3 = document.getElementById("settings-lang-title");
        const desc = langGroup.querySelector(".settings-desc");
        const labelSelect = document.getElementById("settings-lang-label");
        if (h3) h3.innerText = t.langTitle;
        if (desc) desc.innerText = t.langDesc;
        if (labelSelect) labelSelect.innerText = t.langLabel;
    }
    
    const subGroup = document.querySelector("#settings-panel .settings-group:nth-of-type(3)");
    if (subGroup) {
        const h3 = subGroup.querySelector("h3");
        if (h3) h3.innerText = t.subInfo;
        
        const labels = subGroup.querySelectorAll(".info-label");
        if (labels.length >= 4) {
            labels[0].innerText = t.subStatus;
            labels[1].innerText = t.subExpiry;
            labels[2].innerText = t.subMaxConn;
            labels[3].innerText = t.subServer;
        }
    }
    
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        const span = btnLogout.querySelector("span:not(.material-icons)");
        if (span) span.innerText = t.logout;
    }
    
    const seriesHeaderTitle = document.querySelector(".series-header-title");
    if (seriesHeaderTitle) seriesHeaderTitle.innerText = t.seriesDetailsTitle;
    
    const seriesPlot = document.getElementById("series-plot");
    if (seriesPlot && (seriesPlot.innerText === "Synopsis non disponible." || seriesPlot.innerText === "Synopsis not available." || seriesPlot.innerText === "Sinopsis no disponible." || seriesPlot.innerText === "Sinossi non disponibile.")) {
        seriesPlot.innerText = t.seriesPlotFallback;
    }
    
    const castLabel = document.querySelector(".series-credits p:nth-of-type(1) strong");
    if (castLabel) castLabel.innerText = t.seriesCast;
    
    const directorLabel = document.querySelector(".series-credits p:nth-of-type(2) strong");
    if (directorLabel) directorLabel.innerText = t.seriesDirector;
    
    const seasonsSectionH3 = document.querySelector(".seasons-section h3");
    if (seasonsSectionH3) seasonsSectionH3.innerText = t.seasons;
    
    const episodesSectionH3 = document.querySelector(".episodes-section h3");
    if (episodesSectionH3) episodesSectionH3.innerText = t.episodes;
    
    const playerLoaderText = document.querySelector("#player-loader .player-loader-text");
    if (playerLoaderText) playerLoaderText.innerText = t.playerLoaderText;
    
    const zapDrawerH3 = document.querySelector("#zap-drawer h3");
    if (zapDrawerH3) zapDrawerH3.innerText = t.zapTitle;
    
    const epgContainerH3 = document.querySelector(".preview-epg-container h3");
    if (epgContainerH3) epgContainerH3.innerText = t.epgTitle;
    
    const warningTitle = document.getElementById("browser-warning-title");
    const warningDesc = document.getElementById("browser-warning-desc");
    if (warningTitle) warningTitle.innerText = t.browserWarningTitle;
    if (warningDesc) warningDesc.innerText = t.browserWarningDesc;
    
    updateBreadcrumbs();
}

function updateBreadcrumbs() {
    const breadcrumbSection = document.getElementById("breadcrumb-section");
    const breadcrumbCategory = document.getElementById("breadcrumb-category");
    if (!breadcrumbSection || !breadcrumbCategory) return;
    
    const t = TRANSLATIONS[state.language || 'fr'];
    
    if (state.currentSection === 'settings') {
        breadcrumbSection.innerText = t.breadcrumbSettings;
        if (breadcrumbCategory.innerText === "Général" || breadcrumbCategory.innerText === "General" || breadcrumbCategory.innerText === "Generale") {
            breadcrumbCategory.innerText = t.breadcrumbGeneral;
        }
    } else {
        const sectionNames = {
            live: t.breadcrumbLive,
            movies: t.breadcrumbMovies,
            series: t.breadcrumbSeries
        };
        breadcrumbSection.innerText = sectionNames[state.currentSection] || state.currentSection;
        
        if (state.activeCategoryId === "all") {
            breadcrumbCategory.innerText = t.breadcrumbAll;
        }
    }
}

// 1. App State
const state = {
    language: 'fr',
    serverUrl: '',
    username: '',
    password: '',
    isLoggedIn: false,
    isDohEnabled: true,
    dohResolver: 'https://dns.google/resolve',
    
    currentSection: 'live', // 'live', 'movies', 'series', 'settings'
    activeCategoryId: '',
    
    categories: {
        live: [],
        movies: [],
        series: []
    },
    
    // Cached lists in memory
    streams: {
        live: [],
        movies: [],
        series: []
    },
    
    // Full items for the active category
    categoryGridItems: [],
    // Currently filtered/displayed items in grid
    currentGridItems: [],
    
    // Pagination state for Grid rendering (resolves lag)
    gridCurrentPage: 1,
    gridItemsPerPage: 100,
    
    // Video Player state
    currentPlayingStream: null,
    currentPlayingStreamUrl: '',
    overlayTimeout: null,
    zapDrawerOpen: false,
    mpegtsPlayer: null, // mpegts.js instance reference
    previewMpegtsPlayer: null, // mpegts.js preview instance reference
    
    // Series details page state
    currentSeriesDetails: null,
    activeSeasonNum: null,
    
    // Focus management helper
    lastFocusedElement: null
};

// 2. Initial Setup on Load
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    setupSpatialNavigation();
    
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
    
    // Restore session
    const savedSession = localStorage.getItem("shield_iptv_session");
    if (savedSession) {
        try {
            const session = JSON.parse(savedSession);
            state.serverUrl = session.serverUrl;
            state.username = session.username;
            state.password = session.password;
            
            performLogin(state.serverUrl, state.username, state.password, true);
        } catch (e) {
            console.error("Error restoring session", e);
            showScreen("login-screen");
        }
    } else {
        showScreen("login-screen");
    }
    const loginDoh = document.getElementById("login-doh-toggle");
    if (loginDoh) loginDoh.checked = state.isDohEnabled;
}

// 3. DNS-over-HTTPS (DoH) Resolver
async function resolveUrlWithDoH(url) {
    if (!state.isDohEnabled) return url;
    
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        
        if (/^[0-9.]+$/.test(hostname)) return url;
        
        let dnsData;
        if (state.dohResolver.includes("dns.google")) {
            const dohResponse = await fetch(`${state.dohResolver}?name=${hostname}&type=A`, {
                headers: { 'Accept': 'application/json' }
            });
            dnsData = await dohResponse.json();
        } else {
            const dohResponse = await fetch(`${state.dohResolver}?name=${hostname}&type=A`, {
                headers: { 'Accept': 'application/dns-json' }
            });
            dnsData = await dohResponse.json();
        }
        
        if (dnsData && dnsData.Answer && dnsData.Answer.length > 0) {
            const aRecord = dnsData.Answer.find(record => record.type === 1);
            if (aRecord) {
                const ip = aRecord.data;
                parsedUrl.hostname = ip;
                console.log(`[DoH] Resolved: ${hostname} -> ${ip}`);
                return parsedUrl.toString();
            }
        }
    } catch (error) {
        console.warn("[DoH] DNS lookup failed, using fallback URL:", error);
    }
    
    return url;
}

// 4. API Request Handler
async function makeApiCall(action = '', additionalParams = '') {
    const rawUrl = `${state.serverUrl}/player_api.php?username=${state.username}&password=${state.password}${action ? `&action=${action}` : ''}${additionalParams}`;
    const resolvedUrl = await resolveUrlWithDoH(rawUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
    
    try {
        const response = await fetch(resolvedUrl, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`API Error on action: ${action}`, error);
        throw error;
    }
}

// 5. Authentication & Global Asynchronous Data Pre-loading
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
            
            // Save session
            localStorage.setItem("shield_iptv_session", JSON.stringify({
                serverUrl: state.serverUrl,
                username: state.username,
                password: state.password
            }));
            
            // Update UI labels
            if (document.getElementById("status-username")) {
                document.getElementById("status-username").innerText = state.username;
            }
            document.getElementById("portal-username").innerText = state.username;
            document.getElementById("info-status").innerText = data.user_info.status === "Active" ? t.activeText : (data.user_info.status === "Active" ? t.activeText : data.user_info.status);
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
            
            // PRELOAD ALL CONTENT IN BACKGROUND
            await preloadAllData();
            
            hideLoader();
            showToast(t.toastLoginSuccess, 3000);
            showScreen("portal-screen");
        } else {
            throw new Error("Identifiants incorrects.");
        }
    } catch (error) {
        hideLoader();
        console.error("Login Error:", error);
        showToast(isAutoLogin ? t.toastLoginAutoFail : t.toastLoginError + error.message, 5000);
        showScreen("login-screen");
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

// 6. Navigation Switching
async function switchSection(section) {
    const isWebBrowser = window.location.protocol !== 'file:' && !window.cordova && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const warningBanner = document.getElementById("browser-warning-banner");
    if (warningBanner) {
        if (isWebBrowser && (section === 'live' || section === 'movies')) {
            warningBanner.classList.remove("hidden");
        } else {
            warningBanner.classList.add("hidden");
        }
    }

    // Set section name on home screen element for section-specific CSS targeting
    const homeScreen = document.getElementById("home-screen");
    if (homeScreen) {
        homeScreen.setAttribute("data-section", section);
    }
    
    // Clear category search query when switching sections
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
    
    // Always hide live-preview-panel initially when entering Live TV or VOD
    document.getElementById("live-preview-panel").classList.add("hidden");
    destroyPreviewMpegtsPlayer(); // Clear preview stream
    state.currentPlayingStream = null;
    
    showScreen("home-screen");
    
    // Render categories immediately
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
        
        // Translate 'Tout' category name dynamically
        btn.innerText = (cat.category_id === 'all') ? t.breadcrumbAll : cat.category_name;
        
        btn.addEventListener("click", () => {
            document.querySelectorAll(".category-item").forEach(el => el.classList.remove("active"));
            btn.classList.add("active");
            state.activeCategoryId = cat.category_id;
            
            document.getElementById("breadcrumb-category").innerText = (cat.category_id === 'all') ? t.breadcrumbAll : cat.category_name;
            loadCategoryStreamsCached(state.currentSection, cat.category_id);
        });
        
        listEl.appendChild(btn);
    });
}

function loadCategoryStreamsCached(section, categoryId) {
    // Clear search bar when changing category
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

function loadNextGridBatch(section) {
    const totalItems = state.currentGridItems.length;
    const renderedSoFar = state.gridCurrentPage * state.gridItemsPerPage;
    
    if (renderedSoFar >= totalItems) return;
    
    state.gridCurrentPage++;
    const start = renderedSoFar;
    const end = Math.min(start + state.gridItemsPerPage, totalItems);
    const nextBatch = state.currentGridItems.slice(start, end);
    
    appendItemsToGrid(nextBatch, section);
}

function appendItemsToGrid(items, section) {
    const gridEl = document.getElementById("media-grid");
    
    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "media-card focusable";
        card.setAttribute("tabindex", "0");
        card.setAttribute("data-id", item.stream_id || item.series_id);
        
        if (section === 'live') {
            card.classList.add("live-card");
            
            const activeId = state.currentPlayingStream ? (state.currentPlayingStream.item.stream_id || state.currentPlayingStream.item.series_id) : null;
            if (activeId === item.stream_id) {
                card.classList.add("active-playing");
            }
        }
        
        const posterWrapper = document.createElement("div");
        posterWrapper.className = "media-poster-wrapper";
        
        const img = document.createElement("img");
        img.loading = "lazy";
        
        const logoUrl = item.stream_icon || item.cover;
        if (logoUrl) {
            img.src = logoUrl;
        } else {
            img.src = section === 'live' ? PLACEHOLDERS.live : PLACEHOLDERS.vod;
        }
        
        // Fast local SVG fallbacks if image fails to load (resolves network delay)
        img.onerror = () => {
            img.src = section === 'live' ? PLACEHOLDERS.live : PLACEHOLDERS.vod;
        };
        
        posterWrapper.appendChild(img);
        card.appendChild(posterWrapper);
        
        const info = document.createElement("div");
        info.className = "media-info";
        
        const name = document.createElement("div");
        name.className = "media-name";
        name.innerText = item.name;
        info.appendChild(name);
        
        const meta = document.createElement("div");
        meta.className = "media-meta";
        
        if (section === 'movies') {
            const rating = document.createElement("div");
            rating.className = "media-rating";
            rating.innerHTML = `<span class="material-icons">star</span><span>${parseFloat(item.rating || 0).toFixed(1)}</span>`;
            meta.appendChild(rating);
            
            const ext = document.createElement("span");
            ext.className = "media-ext";
            ext.innerText = item.container_extension ? item.container_extension.toUpperCase() : "MP4";
            meta.appendChild(ext);
        } else if (section === 'series') {
            const rating = document.createElement("div");
            rating.className = "media-rating";
            rating.innerHTML = `<span class="material-icons">star</span><span>${parseFloat(item.rating || 0).toFixed(1)}</span>`;
            meta.appendChild(rating);
            
            const release = document.createElement("span");
            release.innerText = item.releaseDate ? item.releaseDate.split("-")[0] : "";
            meta.appendChild(release);
        } else if (section === 'live') {
            const type = document.createElement("span");
            type.className = "badge-live";
            type.innerText = "DIRECT";
            meta.appendChild(type);
        }
        
        info.appendChild(meta);
        card.appendChild(info);
        
        card.addEventListener("click", () => {
            playMedia(item, section);
        });
        
        gridEl.appendChild(card);
    });
}

// 7. Series Details Screen Logic
async function openSeriesDetails(item) {
    const t = TRANSLATIONS[state.language || 'fr'];
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
    const t = TRANSLATIONS[state.language || 'fr'];
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
    const t = TRANSLATIONS[state.language || 'fr'];
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
            const playUrl = `${state.serverUrl}/series/${state.username}/${state.password}/${ep.id}.${ext}`;
            const displayTitle = ep.title ? cleanEpisodeTitle(ep.title, seriesName) : `${t.seasonPrefix} ${seasonNum} ${t.episodeLabelZap} ${ep.episode_num || ep.num}`;
            
            state.currentPlayingStream = { item: ep, section: 'series', seasonNum: seasonNum };
            launchVideoPlayer(playUrl, displayTitle, state.currentSeriesDetails.info.cover);
        });
        
        episodesList.appendChild(card);
    });
}

// 8. Player Engine
async function playMedia(item, section) {
    const isWebBrowser = window.location.protocol !== 'file:' && !window.cordova && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isWebBrowser && (section === 'live' || section === 'movies')) {
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
        
        // If already playing in preview OR player screen is currently active (zapping in fullscreen), launch/load directly in fullscreen player
        if (isMobile || isPlayerOpen || (state.currentPlayingStream && state.currentPlayingStream.section === 'live' && state.currentPlayingStream.item.stream_id === item.stream_id)) {
            state.currentPlayingStream = { item, section };
            const streamUrl = `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.ts`;
            launchVideoPlayer(streamUrl, item.name, item.stream_icon || item.cover);
            return;
        }
        
        // Otherwise, play in the right preview panel
        state.currentPlayingStream = { item, section };
        
        // Show right preview panel on selection
        document.getElementById("live-preview-panel").classList.remove("hidden");
        
        // Update selected card UI highlights
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
    const streamUrl = `${state.serverUrl}/movie/${state.username}/${state.password}/${item.stream_id}.${ext}`;
    
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
    state.currentPlayingStreamUrl = url;
    
    // Stop and clean up preview stream decoding before going fullscreen
    destroyPreviewMpegtsPlayer();
    
    // Toggle VLC button on loader for mobile devices
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
    
    // Set subtitle below title depending on section
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
            // Movies (VOD) - Clear subtitle
            nowPlayingEl.innerText = "";
        }
    } else {
        nowPlayingEl.innerText = "";
    }
    
    playerLoader.style.display = "flex";
    
    // Reset progress
    document.getElementById("player-progress-fill").style.width = "0%";
    document.getElementById("player-time-current").innerText = "0:00";
    document.getElementById("player-time-total").innerText = "0:00";
    
    // Dynamic controls
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
    
    // Cleanup any existing mpegts player
    destroyMpegtsPlayer();
    
    resolveUrlWithDoH(url).then(resolvedStreamUrl => {
        const isTsStream = resolvedStreamUrl.includes('.ts') || resolvedStreamUrl.includes('/live/');
        
        // Try mpegts.js if it is a TS stream and supported
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
    
    video.onwaiting = () => { playerLoader.style.display = "flex"; };
    video.onplaying = () => { playerLoader.style.display = "none"; };
    video.onplay = () => {
        document.getElementById("player-icon-play").innerText = "pause";
    };
    video.onpause = () => {
        document.getElementById("player-icon-play").innerText = "play_arrow";
    };
    video.onerror = () => {
        playerLoader.style.display = "none";
        showToast(t.playerStreamError, 5000);
        closeVideoPlayer();
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
    
    // Trigger initial timer to autohide player overlay
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
}

async function loadLivePreview(item) {
    const video = document.getElementById("live-preview-video");
    const loader = document.getElementById("preview-loader");
    const t = TRANSLATIONS[state.language || 'fr'];
    
    if (loader) loader.classList.remove("hidden");
    
    const epgListEl = document.getElementById("preview-epg-list");
    if (epgListEl) epgListEl.innerHTML = `<div class="preview-epg-loading">${t.epgLoading}</div>`;
    
    destroyPreviewMpegtsPlayer();
    
    const streamUrl = `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.ts`;
    
    resolveUrlWithDoH(streamUrl).then(resolvedUrl => {
        const isTsStream = resolvedUrl.includes('.ts') || resolvedUrl.includes('/live/');
        
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
                video.muted = false; // Try playing unmuted by default
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
    
    // Fetch and render preview EPG
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
    video.pause();
    video.removeAttribute("src");
    try {
        video.load();
    } catch(e){}
}

function closeVideoPlayer() {
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    
    const video = document.getElementById("video-player");
    video.pause();
    
    destroyMpegtsPlayer();
    
    video.removeAttribute("src");
    video.load();
    
    // Restore default cursor on exit
    const playerScreen = document.getElementById("player-screen");
    playerScreen.style.cursor = "default";
    
    // Clear overlay timeouts
    clearTimeout(state.overlayTimeout);
    document.getElementById("player-overlay").classList.add("hidden");
    
    const wasLive = state.currentPlayingStream && state.currentPlayingStream.section === 'live';
    const liveItem = wasLive ? state.currentPlayingStream.item : null;
    
    if (state.currentPlayingStream && state.currentPlayingStream.section === 'series') {
        showScreen("series-details-screen");
    } else {
        showScreen("home-screen");
    }
    
    // If it was Live, restore preview playback
    if (wasLive && liveItem) {
        state.currentPlayingStream = { item: liveItem, section: 'live' };
        document.getElementById("live-preview-panel").classList.remove("hidden");
        
        // Update grid highlights to match the new zapped channel when returning to dashboard
        document.querySelectorAll(".media-card").forEach(el => {
            el.classList.remove("active-playing");
        });
        
        // Check if card is rendered in the DOM, if not load batches until found
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
            state.lastFocusedElement = activeCard; // Sync focused element state to newly zapped channel card
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

// Zapping logic (Next/Previous Live TV channel)
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

// User Activity manager (Autohides custom player overlay & hides mouse cursor after 4s)
function resetPlayerActivity() {
    if (activeScreenId() !== "player-screen") return;
    
    const overlay = document.getElementById("player-overlay");
    const playerScreen = document.getElementById("player-screen");
    
    // Re-reveal overlay and mouse cursor
    overlay.classList.remove("hidden");
    playerScreen.style.cursor = "default";
    
    clearTimeout(state.overlayTimeout);
    state.overlayTimeout = setTimeout(() => {
        // Hide overlay & mouse cursor after 4 seconds of absolute idle
        overlay.classList.add("hidden");
        playerScreen.style.cursor = "none";
        
        // Also collapse quick zap list if it is open
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
        // Display other episodes of the current season of the active series
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
            
            // Use a material play icon for episodes
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
                const playUrl = `${state.serverUrl}/series/${state.username}/${state.password}/${ep.id}.${ext}`;
                const displayTitle = ep.title ? cleanEpisodeTitle(ep.title, seriesName) : `${t.seasonPrefix} ${seasonNum} ${t.episodeLabelZap} ${ep.episode_num || ep.num}`;
                
                state.currentPlayingStream = { item: ep, section: 'series', seasonNum: seasonNum };
                launchVideoPlayer(playUrl, displayTitle, state.currentSeriesDetails.info.cover);
            });
            
            listEl.appendChild(btn);
        });
    } else {
        // Display other items from the active grid (current category)
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

// 9. Spatial Navigation (D-pad & Keyboards)
function setupSpatialNavigation() {
    window.addEventListener("keydown", (e) => {
        const key = e.key;
        
        // Track key activities to reset player overlay
        if (activeScreenId() === "player-screen") {
            resetPlayerActivity();
        }
        
        // Fullscreen hotkey: F
        if (key.toLowerCase() === 'f') {
            if (activeScreenId() === "player-screen") {
                e.preventDefault();
                toggleFullscreen();
            }
        }
        
        // Play/Pause hotkey: Space
        if (key === ' ' || key === 'Spacebar') {
            if (activeScreenId() === "player-screen") {
                e.preventDefault();
                togglePlayPause();
            }
        }
        
        // Arrow Keys & Enter spatial navigation initialization
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
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

        // Arrow Keys spatial navigation
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
    
    // Prevent right arrow on the player back button from shifting focus down
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
            // Prioritize category item or media card over navigation/search/back buttons
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
    } else if (screenId === "portal-screen") {
        showToast("Appuyez sur Accueil pour quitter", 2000);
    }
}

// 10. UI Interaction Handlers
function setupEventListeners() {
    // Login
    document.getElementById("login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const url = document.getElementById("login-url").value;
        const user = document.getElementById("login-username").value;
        const pass = document.getElementById("login-password").value;
        performLogin(url, user, pass);
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
    document.getElementById("portal-btn-settings").addEventListener("click", () => {
        switchSection("settings");
    });
    
    // Back to portal
    document.getElementById("btn-header-back").addEventListener("click", () => {
        showScreen("portal-screen");
    });
    
    // Preview Video Container trigger for fullscreen
    const previewContainer = document.getElementById("preview-video-container");
    if (previewContainer) {
        previewContainer.addEventListener("click", () => {
            if (state.currentPlayingStream && state.currentPlayingStream.section === 'live') {
                const item = state.currentPlayingStream.item;
                const streamUrl = `${state.serverUrl}/live/${state.username}/${state.password}/${item.stream_id}.ts`;
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
    
    // (Search trigger button removed from HTML)
    
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
    const loginDoh = document.getElementById("login-doh-toggle");
    if (loginDoh) {
        loginDoh.addEventListener("change", (e) => {
            state.isDohEnabled = e.target.checked;
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
        // Toggle overlay on click
        const overlay = document.getElementById("player-overlay");
        if (overlay.classList.contains("hidden")) {
            resetPlayerActivity();
        } else {
            // If clicking overlay buttons, let them handle it. Else hide it
            if (!e.target.closest(".player-btn") && !e.target.closest("#player-progress-bar")) {
                overlay.classList.add("hidden");
                playerScreen.style.cursor = "none";
            }
        }
    });

    // Prevent mouse click focus on player buttons and icon buttons to avoid stuck focus styles
    // Prevent mouse clicks from leaving stuck focus outline on buttons and clickable cards
    document.addEventListener("mousedown", (e) => {
        const focusable = e.target.closest(".focusable");
        if (focusable && focusable.tagName !== 'INPUT' && focusable.tagName !== 'SELECT') {
            e.preventDefault();
        }
    });
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
    state.isLoggedIn = false;
    state.streams = { live: [], movies: [], series: [] };
    state.categories = { live: [], movies: [], series: [] };
    
    showScreen("login-screen");
    showToast(t.toastLogout, 3000);
    
    setTimeout(() => {
        document.getElementById("login-url").focus();
    }, 100);
}

function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.add("hidden");
    });
    const scr = document.getElementById(screenId);
    if (scr) scr.classList.remove("hidden");
    
    if (screenId !== 'home-screen' || state.currentSection !== 'live') {
        destroyPreviewMpegtsPlayer();
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
