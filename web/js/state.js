/* ==========================================================================
   SHIELDIPTV APP STATE & CONSTANTS
   ========================================================================== */

const isTvWrapper = window.cordova || 
                    /SmartTV|GoogleTV|AppleTV|AndroidTV|webOS|webOSTV/i.test(navigator.userAgent);

// Fallback dynamic placeholder SVG Data-URIs
const PLACEHOLDERS = {
    live: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150"><rect width="300" height="150" fill="%230f1423"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Outfit,sans-serif" font-size="18" fill="%2364748b">Direct TV</text></svg>',
    vod: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="%230f1423"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Outfit,sans-serif" font-size="18" fill="%2364748b">ShieldIPTV</text></svg>'
};

// Corporate Demo Playlist Data (France 24 removed)
const DEMO_PLAYLIST_DATA = {
    live: [
        {
            stream_id: "demo_live_dw",
            name: "Deutsche Welle (DW English)",
            category_id: "demo_live_cat_1",
            category_name: "Documentaires",
            stream_icon: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Deutsche_Welle_logo.svg",
            cover: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Deutsche_Welle_logo.svg",
            url: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8"
        },
        {
            stream_id: "demo_live_mux",
            name: "Mire de Test (Mux HLS)",
            category_id: "demo_live_cat_1",
            category_name: "Documentaires",
            stream_icon: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Mux_logo.svg",
            cover: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Mux_logo.svg",
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
        }
    ],
    movies: [
        {
            stream_id: "demo_vod_sintel",
            name: "Sintel Trailer (MP4)",
            category_id: "demo_vod_cat_1",
            category_name: "Animation / Libre",
            stream_icon: "https://upload.wikimedia.org/wikipedia/commons/2/2a/W3Schools_logo.svg",
            cover: "https://upload.wikimedia.org/wikipedia/commons/2/2a/W3Schools_logo.svg",
            rating: "8.2",
            container_extension: "mp4",
            url: "https://media.w3.org/2010/05/sintel/trailer_hd.mp4"
        },
        {
            stream_id: "demo_vod_bbb_trailer",
            name: "Big Buck Bunny Trailer (MP4)",
            category_id: "demo_vod_cat_1",
            category_name: "Animation / Libre",
            stream_icon: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_Buck_Bunny_Blender_icon.png",
            cover: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_Buck_Bunny_Blender_icon.png",
            rating: "7.8",
            container_extension: "mp4",
            url: "https://media.w3.org/2010/05/bunny/trailer.mp4"
        },
        {
            stream_id: "demo_vod_tos",
            name: "Tears of Steel (HLS Adaptatif)",
            category_id: "demo_vod_cat_2",
            category_name: "Sci-Fi / Libre",
            stream_icon: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Tears_of_Steel_poster.jpg",
            cover: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Tears_of_Steel_poster.jpg",
            rating: "7.0",
            container_extension: "m3u8",
            url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8"
        }
    ],
    series: [
        {
            series_id: "demo_series_retro",
            name: "Séries Classiques & Rétro",
            category_id: "demo_series_cat_1",
            category_name: "Séries Classiques",
            cover: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Television_icon.svg",
            rating: "8.5",
            episodes: {
                "1": [
                    {
                        id: "demo_series_ep_1",
                        title: "Big Buck Bunny (S01E01 - MP4)",
                        episode_num: "1",
                        url: "https://www.w3schools.com/html/mov_bbb.mp4",
                        container_extension: "mp4"
                    },
                    {
                        id: "demo_series_ep_2",
                        title: "Sinfonía de la Naturaleza (S01E02 - MP4)",
                        episode_num: "2",
                        url: "https://www.w3schools.com/html/movie.mp4",
                        container_extension: "mp4"
                    }
                ]
            }
        }
    ]
};

// Global State
const state = {
    language: 'en',
    currentPlaylistType: '',
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
    
    // Pagination state for Grid rendering
    gridCurrentPage: 1,
    gridItemsPerPage: 100,
    
    // Video Player state
    currentPlayingStream: null,
    currentPlayingStreamUrl: '',
    overlayTimeout: null,
    zapDrawerOpen: false,
    mpegtsPlayer: null, // mpegts.js instance reference
    previewMpegtsPlayer: null, // mpegts.js preview instance reference
    testerHlsPlayer: null, // HLS.js instance reference for tester
    testerMpegtsPlayer: null, // mpegts.js instance reference for tester
    reconnectTimer: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    
    // Series details page state
    currentSeriesDetails: null,
    activeSeasonNum: null,
    
    // Focus management helper
    lastFocusedElement: null,
    // Parent screen tracking for settings/diagnostics return behavior
    utilityParentScreen: ''
};

// Helper to decode Base64 encoded UTF-8 strings
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
    const sePattern = /\b(s\d+\s*[-]?\s*e\d+|e\d+|saison\s*\d+\s*épisode\s*\d+)\b/i;
    const match = title.match(sePattern);
    
    if (match) {
        const index = title.indexOf(match[0]);
        clean = title.substring(index + match[0].length);
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
        langTitle: "Langue / Language",
        langDesc: "Sélectionnez la langue de l'interface.",
        langLabel: "Langue",
        subInfo: "Informations de l'abonnement",
        subStatus: "Statut du compte :",
        subExpiry: "Date d'expiration :",
        subMaxConn: "Connexions Max :",
        subServer: "Serveur IPTV :",
        logout: "Retour aux Playlists",
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
        toastLoginSuccess: "Playlist chargée avec succès !",
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
        toastLogout: "Session fermée.",
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
        browserPlayBlocked: "Ce contenu nécessite l'application ShieldIPTV pour être lu.",
        
        cguTitle: "Avertissement Légal & Conditions",
        cguText1: "ShieldIPTV Player est un lecteur multimédia vidéo générique. L'application est fournie sans aucun contenu ni flux média.",
        cguText2: "En tant qu'utilisateur, vous devez fournir vos propres flux vidéo (liens de playlists légaux, comptes Xtream Codes, etc.). ShieldIPTV n'approuve pas, ne fournit pas et ne facilite pas l'accès à du contenu protégé par le droit d'auteur sans l'accord des ayants droit.",
        cguText3: "En continuant, vous confirmez posséder les droits d'utilisation des flux et contenus que vous importerez dans ce lecteur.",
        cguCheckbox: "J'accepte les Conditions Générales d'Utilisation et je confirme que je possède les droits des contenus importés.",
        cguAcceptBtn: "Accepter et Continuer",
        pmTitle: "Sélectionnez ou ajoutez une playlist pour commencer",
        pmAddPlaylist: "Ajouter une playlist",
        pmAddPlaylistSub: "Xtream Codes ou Lien M3U",
        pmTitleForm: "Ajouter une Playlist",
        pmNameLabel: "Nom de la playlist",
        pmUrlLabel: "URL du serveur",
        pmUrlM3uLabel: "Lien de la Playlist (M3U/M3U8)",
        pmConnectBtn: "Sauvegarder et Charger",
        diagTitle: "Diagnostics & Outils Réseau",
        diagDesc: "Vérifiez les performances réseau et testez la validité de vos liens de streaming.",
        diagSpeedtest: "Test de débit (Speed Test)",
        diagSpeedtestBtn: "Lancer le test",
        diagSpeedtestBtnRunning: "Test en cours...",
        diagLinktester: "Vérificateur de lien",
        diagLinktesterBtn: "Tester",
        diagLinktesterBtnRunning: "Vérification...",
        diagLinktesterPlaceholder: "http://domain.com/live/stream.ts",
        aboutTitle: "À Propos & Mentions Légales",
        aboutDesc: "Informations sur l'application et support technique.",
        aboutVersion: "Version de l'application :",
        aboutPrivacy: "Politique de Confidentialité :",
        aboutSupport: "Email de contact / Support :",
        aboutCredits: "Licences Open Source :",
        toastM3uLoad: "Chargement de la playlist M3U...",
        vlcBtnText: "Ouvrir dans VLC",
        deletePlaylist: "Playlist supprimée."
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
        langTitle: "Language / Langue",
        langDesc: "Select the interface language.",
        langLabel: "Language",
        subInfo: "Subscription Information",
        subStatus: "Account Status:",
        subExpiry: "Expiration Date:",
        subMaxConn: "Max Connections:",
        subServer: "IPTV Server:",
        logout: "Back to Playlists",
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
        toastLoginSuccess: "Playlist loaded successfully!",
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
        toastLogout: "Session closed.",
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
        browserPlayBlocked: "This content requires the ShieldIPTV application to play.",
        
        cguTitle: "Legal Disclaimer & Conditions",
        cguText1: "ShieldIPTV Player is a generic video media player. The application is provided without any content or media streams.",
        cguText2: "As a user, you must provide your own video streams (legal playlist links, Xtream Codes accounts, etc.). ShieldIPTV does not endorse, provide or facilitate access to copyrighted content without the consent of the rights holders.",
        cguText3: "By continuing, you confirm that you possess the usage rights for the streams and content you import into this player.",
        cguCheckbox: "I accept the General Terms of Use and confirm that I own the rights to the imported content.",
        cguAcceptBtn: "Accept and Continue",
        pmTitle: "Select or add a playlist to begin",
        pmAddPlaylist: "Add a playlist",
        pmAddPlaylistSub: "Xtream Codes or M3U Link",
        pmTitleForm: "Add a Playlist",
        pmNameLabel: "Playlist Name",
        pmUrlLabel: "Server URL",
        pmUrlM3uLabel: "Playlist Link (M3U/M3U8)",
        pmConnectBtn: "Save and Load",
        diagTitle: "Diagnostics & Network Tools",
        diagDesc: "Check network performance and validate your streaming links.",
        diagSpeedtest: "Speed Test",
        diagSpeedtestBtn: "Run test",
        diagSpeedtestBtnRunning: "Testing...",
        diagLinktester: "Link Checker",
        diagLinktesterBtn: "Test",
        diagLinktesterBtnRunning: "Checking...",
        diagLinktesterPlaceholder: "http://domain.com/live/stream.ts",
        aboutTitle: "About & Legal Mentions",
        aboutDesc: "Information about the application and technical support.",
        aboutVersion: "Application Version:",
        aboutPrivacy: "Privacy Policy:",
        aboutSupport: "Contact Email / Support:",
        aboutCredits: "Open Source Licenses:",
        toastM3uLoad: "Loading M3U playlist...",
        vlcBtnText: "Open in VLC",
        deletePlaylist: "Playlist deleted."
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
        langTitle: "Idioma / Language",
        langDesc: "Seleccione el idioma de la interfaz.",
        langLabel: "Idioma",
        subInfo: "Información de la Suscripción",
        subStatus: "Estado de la cuenta:",
        subExpiry: "Fecha de expiración:",
        subMaxConn: "Connesiones máximas:",
        subServer: "Servidor IPTV:",
        logout: "Volver a Playlists",
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
        toastLoginSuccess: "¡Playlist cargada con éxito!",
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
        toastLogout: "Sesión cerrada.",
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
        browserPlayBlocked: "Este contenido requiere la aplicación ShieldIPTV para reproducirse.",
        
        cguTitle: "Aviso Legal y Condiciones",
        cguText1: "ShieldIPTV Player es un reproductor multimedia de vídeo genérico. La aplicación se proporciona sin ningún contenido o flujo multimedia.",
        cguText2: "Como usuario, debe proporcionar sus propios flujos de vídeo (enlaces de reproducción legales, cuentas de Xtream Codes, etc.). ShieldIPTV no respalda, proporciona ni facilita el acceso a contenidos protegidos por derechos de autor sin el consentimiento de los titulares de los derechos.",
        cguText3: "Al continuar, confirma que posee los derechos de uso de las transmisiones y contenidos que importa a este reproductor.",
        cguCheckbox: "Acepto las Condiciones Generales de Uso y confirmo que poseo los derechos del contenido importado.",
        cguAcceptBtn: "Aceptar y Continuar",
        pmTitle: "Seleccione o agregue una lista de reproducción para comenzar",
        pmAddPlaylist: "Agregar una lista de reproducción",
        pmAddPlaylistSub: "Xtream Codes o Enlace M3U",
        pmTitleForm: "Agregar Lista de Reproducción",
        pmNameLabel: "Nombre de la lista",
        pmUrlLabel: "URL del servidor",
        pmUrlM3uLabel: "Enlace de la Lista (M3U/M3U8)",
        pmConnectBtn: "Guardar y Cargar",
        diagTitle: "Diagnóstico y Outils Red",
        diagDesc: "Verifique el rendimiento de la red y pruebe la validez de sus enlaces de transmisión.",
        diagSpeedtest: "Prueba de velocidad (Speed Test)",
        diagSpeedtestBtn: "Iniciar prueba",
        diagSpeedtestBtnRunning: "Probando...",
        diagLinktester: "Verificador de enlaces",
        diagLinktesterBtn: "Probar",
        diagLinktesterBtnRunning: "Verificando...",
        diagLinktesterPlaceholder: "http://domain.com/live/stream.ts",
        aboutTitle: "Acerca de y Menciones Legales",
        aboutDesc: "Información sobre la aplicación y soporte técnico.",
        aboutVersion: "Versión de la aplicación:",
        aboutPrivacy: "Política de privacidad:",
        aboutSupport: "Correo electrónico / Soporte:",
        aboutCredits: "Licencias de código abierto:",
        toastM3uLoad: "Cargando lista de reproducción M3U...",
        vlcBtnText: "Abrir en VLC",
        deletePlaylist: "Playlist eliminada."
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
        epgTitle: "Guia Programmi",
        epgLoading: "Caricamento guida...",
        epgEmpty: "Nessun programma disponibile al momento.",
        epgUnavailable: "Guida programmi non disponibile.",
        settingsTitle: "Impostazioni Generali",
        dohTitle: "DNS over HTTPS (DoH)",
        dohDesc: "Consente di aggirare i blocchi DNS imposti da alcuni ISP per riprodurre i flussi IPTV.",
        dohEnable: "Attiva DoH",
        dohResolver: "Risolutore DoH",
        langTitle: "Lingua / Language",
        langDesc: "Seleziona la lingua dell'interfaccia.",
        langLabel: "Lingua",
        subInfo: "Informazioni sull'abbonamento",
        subStatus: "Stato dell'account:",
        subExpiry: "Data di scadenza:",
        subMaxConn: "Connessioni Max:",
        subServer: "Server IPTV:",
        logout: "Torna alle Playlist",
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
        toastLoginSuccess: "Playlist caricata con successo!",
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
        toastLogout: "Sessione chiusa.",
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
        browserPlayBlocked: "Questo contenuto richiede l'applicazione ShieldIPTV per essere riprodotto.",
        
        cguTitle: "Avviso Legale & Condizioni",
        cguText1: "ShieldIPTV Player è un lettore multimediale video generico. L'applicazione viene fornita senza alcun contenuto o flusso multimediale.",
        cguText2: "Come utente, devi fornire i tuoi flussi video (link di playlist legali, account Xtream Codes, etc.). ShieldIPTV non approva, fornisce o facilita l'accesso a contenuti protetti da copyright senza il consenso dei titolari dei diritti.",
        cguText3: "Continuando, confermi di possedere i diritti di utilizzo per i flussi e i contenuti che importi in questo lettore.",
        cguCheckbox: "Accetto le Condizioni Generali d'Uso e confermo di possedere i diritti dei contenuti importati.",
        cguAcceptBtn: "Accetta e Continua",
        pmTitle: "Seleziona o aggiungi una playlist per iniziare",
        pmAddPlaylist: "Aggiungi una playlist",
        pmAddPlaylistSub: "Xtream Codes o Link M3U",
        pmTitleForm: "Aggiungi Playlist",
        pmNameLabel: "Nome della playlist",
        pmUrlLabel: "URL del server",
        pmUrlM3uLabel: "Link della Playlist (M3U/M3U8)",
        pmConnectBtn: "Salva e Carica",
        diagTitle: "Diagnostica & Strumenti di Rete",
        diagDesc: "Verifica le prestazioni della rete e testa la validità dei tuoi link di streaming.",
        diagSpeedtest: "Test di velocità (Speed Test)",
        diagSpeedtestBtn: "Avvia il test",
        diagSpeedtestBtnRunning: "Test in corso...",
        diagLinktester: "Verificatore di link",
        diagLinktesterBtn: "Testa",
        diagLinktesterBtnRunning: "Verifica...",
        diagLinktesterPlaceholder: "http://domain.com/live/stream.ts",
        aboutTitle: "Informazioni & Note Legali",
        aboutDesc: "Informazioni sull'applicazione e supporto tecnico.",
        aboutVersion: "Versione dell'applicazione:",
        aboutPrivacy: "Informativa sulla privacy:",
        aboutSupport: "Email di contatto / Supporto:",
        aboutCredits: "Licences Open Source:",
        toastM3uLoad: "Caricamento playlist M3U...",
        vlcBtnText: "Apri in VLC",
        deletePlaylist: "Playlist deleted."
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
    
    // Default base language is English
    return 'en';
}

function applyLanguage(lang) {
    if (!TRANSLATIONS[lang]) lang = 'en';
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

    const cardSpeedtest = document.getElementById("portal-card-speedtest");
    if (cardSpeedtest) {
        const h3 = cardSpeedtest.querySelector("h3");
        const p = cardSpeedtest.querySelector("p");
        if (h3) h3.innerText = t.diagSpeedtest;
        if (p) p.innerText = t.language === 'fr' ? "Mesurer la vitesse de connexion" : "Measure connection speed";
    }

    const cardLinktester = document.getElementById("portal-card-linktester");
    if (cardLinktester) {
        const h3 = cardLinktester.querySelector("h3");
        const p = cardLinktester.querySelector("p");
        if (h3) h3.innerText = t.diagLinktester;
        if (p) p.innerText = t.language === 'fr' ? "Vérifier la validité d'un flux" : "Check stream validity";
    }

    const cardAccounts = document.getElementById("portal-card-accounts");
    if (cardAccounts) {
        const h3 = cardAccounts.querySelector("h3");
        const p = cardAccounts.querySelector("p");
        if (h3) h3.innerText = t.language === 'fr' ? "GESTION COMPTES" : "MANAGE ACCOUNTS";
        if (p) p.innerText = t.language === 'fr' ? "Changer ou ajouter une playlist" : "Switch or add playlists";
    }

    const screenSpeedtestTitle = document.getElementById("screen-speedtest-title");
    if (screenSpeedtestTitle) screenSpeedtestTitle.innerText = t.diagSpeedtest;
    
    const screenLinktesterTitle = document.getElementById("screen-linktester-title");
    if (screenLinktesterTitle) screenLinktesterTitle.innerText = t.diagLinktester;
    
    const screenLinktesterDesc = document.getElementById("screen-linktester-desc");
    if (screenLinktesterDesc) screenLinktesterDesc.innerText = t.diagDesc;
    
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
    
    const onboardingH2 = document.getElementById("cgu-modal-title") || document.querySelector("#cgu-modal h2");
    if (onboardingH2) onboardingH2.innerText = t.cguTitle;
    
    const cguLangText = document.getElementById("cgu-lang-text");
    if (cguLangText) {
        const langNames = { fr: "Français", en: "English", es: "Español", it: "Italiano" };
        cguLangText.innerText = langNames[lang] || "Français";
    }
    
    const pmSpeedtest = document.getElementById("pm-btn-speedtest");
    if (pmSpeedtest) pmSpeedtest.title = t.diagSpeedtest;
    
    const pmLinktester = document.getElementById("pm-btn-linktester");
    if (pmLinktester) pmLinktester.title = t.diagLinktester;
    
    const pmStreamtester = document.getElementById("pm-btn-streamtester");
    if (pmStreamtester) pmStreamtester.title = lang === 'fr' ? "Testeur de flux" : "Stream Tester";
    
    const pmSettings = document.getElementById("pm-btn-settings");
    if (pmSettings) pmSettings.title = t.settingsTitle;
    
    const cguContent = document.querySelector("#cgu-modal .cgu-content");
    if (cguContent) {
        cguContent.innerHTML = `
            <p>${t.cguText1}</p>
            <p>${t.cguText2}</p>
            <p>${t.cguText3}</p>
        `;
    }
    const btnCguCloseSpan = document.querySelector("#btn-cgu-close span:not(.material-icons)");
    if (btnCguCloseSpan) btnCguCloseSpan.innerText = t.language === 'fr' ? "Fermer" : "Close";
    
    const pmHeaderP = document.querySelector(".playlist-manager-header p");
    if (pmHeaderP) pmHeaderP.innerText = t.pmTitle;
    
    const loginHeaderH2 = document.querySelector(".login-header-bar h2");
    if (loginHeaderH2) loginHeaderH2.innerText = t.pmTitleForm;
    
    const tabXtream = document.getElementById("tab-xtream");
    const tabM3u = document.getElementById("tab-m3u");
    if (tabXtream) tabXtream.innerText = "Xtream Codes";
    if (tabM3u) tabM3u.innerText = t.language === 'fr' ? "Lien M3U" : (t.language === 'en' ? "M3U Link" : (t.language === 'es' ? "Enlace M3U" : "Link M3U"));
    
    const loginNameLabel = document.querySelector('label[for="login-name"]');
    if (loginNameLabel) loginNameLabel.innerText = t.pmNameLabel;
    
    const playlistTypeEl = document.getElementById("playlist-type");
    const inputType = playlistTypeEl ? playlistTypeEl.value : "xtream";
    const labelUrlEl = document.getElementById("label-url");
    if (labelUrlEl) labelUrlEl.innerText = inputType === 'xtream' ? t.serverUrl : t.pmUrlM3uLabel;
    
    const btnConnectSpan = document.querySelector("#btn-connect span:not(.material-icons)");
    if (btnConnectSpan) btnConnectSpan.innerText = t.pmConnectBtn;
    
    const diagH3 = document.getElementById("settings-diag-title");
    if (diagH3) diagH3.innerText = t.diagTitle;
    
    const diagDescP = document.getElementById("settings-diag-desc");
    if (diagDescP) diagDescP.innerText = t.diagDesc;
    
    const labelSpeedtest = document.getElementById("label-speedtest");
    if (labelSpeedtest) labelSpeedtest.innerText = t.diagSpeedtest;
    
    const btnLabelSpeedtest = document.getElementById("btn-label-speedtest");
    if (btnLabelSpeedtest && !document.getElementById("btn-run-speedtest").disabled) {
        btnLabelSpeedtest.innerText = t.diagSpeedtestBtn;
    }
    
    const labelLinktester = document.getElementById("label-linktester");
    if (labelLinktester) labelLinktester.innerText = t.diagLinktester;
    
    const btnLabelLinktester = document.getElementById("btn-label-linktester");
    if (btnLabelLinktester && !document.getElementById("btn-run-linktest").disabled) {
        btnLabelLinktester.innerText = t.diagLinktesterBtn;
    }
    
    const linkTestUrlInput = document.getElementById("link-test-url");
    if (linkTestUrlInput) linkTestUrlInput.placeholder = t.diagLinktesterPlaceholder || "http://domain.com/live/stream.ts";
    
    const aboutH3 = document.getElementById("settings-about-title");
    if (aboutH3) aboutH3.innerText = t.aboutTitle;
    
    const aboutDescP = document.getElementById("settings-about-desc");
    if (aboutDescP) aboutDescP.innerText = t.aboutDesc;
    
    const aboutLabelVersion = document.getElementById("about-label-version");
    if (aboutLabelVersion) aboutLabelVersion.innerText = t.aboutVersion;
    
    const aboutLabelPrivacy = document.getElementById("about-label-privacy");
    if (aboutLabelPrivacy) aboutLabelPrivacy.innerText = t.aboutPrivacy;
    
    const aboutLabelSupport = document.getElementById("about-label-support");
    if (aboutLabelSupport) aboutLabelSupport.innerText = t.aboutSupport;
    
    const aboutLabelCredits = document.getElementById("about-label-credits");
    if (aboutLabelCredits) aboutLabelCredits.innerText = t.aboutCredits;
    
    const loaderVlcBtnSpan = document.querySelector("#player-loader-vlc span:not(.material-icons)");
    if (loaderVlcBtnSpan) loaderVlcBtnSpan.innerText = t.vlcBtnText || "Ouvrir dans VLC";
    
    updateBreadcrumbs();
}

function updateBreadcrumbs() {
    const breadcrumbSection = document.getElementById("breadcrumb-section");
    const breadcrumbCategory = document.getElementById("breadcrumb-category");
    if (!breadcrumbSection || !breadcrumbCategory) return;
    
    const t = TRANSLATIONS[state.language || 'en'];
    
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
