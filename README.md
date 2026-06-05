# ShieldIPTV

ShieldIPTV est un client IPTV moderne, rapide et élégant pour le web, spécialement optimisé pour la navigation sur Smart TV / Android TV (via télécommande D-pad) et sur navigateur de bureau.

## Structure du Dépôt

*   `shieldiptv_web/` : Contient l'application web monopage (HTML, CSS, Vanilla JS) avec décodeur de flux vidéo TS (`mpegts.js`), guide de programmes (EPG), zapping rapide et support DNS-over-HTTPS (DoH).
*   `README.md` : Ce fichier de description globale.

## Fonctionnalités Clés

*   📺 **Optimisé TV & D-pad** : Prise en charge native de la navigation spatiale au clavier ou à la télécommande avec styles de focus fluides et sélecteurs `:focus-visible`.
*   🚀 **Rapide & Léger** : Entièrement développé en HTML5, CSS3 et JavaScript pur (Vanilla JS), sans frameworks lourds.
*   🔒 **DNS-over-HTTPS (DoH)** : Option intégrée pour contourner les blocages DNS imposés par certains FAI lors de la lecture des flux IPTV.
*   🌍 **Multilingue** : Interface disponible en Français, Anglais, Espagnol et Italien, avec routage par fragment d'URL (ex: `#/fr`, `#/en`).
*   🎥 **Prévisualisation en Direct** : Lecteur miniature et guide EPG en direct intégrés au tableau de bord.
