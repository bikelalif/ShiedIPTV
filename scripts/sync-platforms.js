const fs = require('fs');
const path = require('path');

// Target Directories
const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT_DIR, 'web');
const TARGETS = {
    webos: path.join(ROOT_DIR, 'webOS'),
    pc: path.join(ROOT_DIR, 'pc', 'src'),
    android: path.join(ROOT_DIR, 'android-tv', 'app', 'src', 'main', 'assets', 'www'),
    vidaa: path.join(ROOT_DIR, 'vidaa')
};

// Recursive Copy Directory Function
function copyFolderSync(from, to) {
    if (!fs.existsSync(from)) return;
    if (!fs.existsSync(to)) {
        fs.mkdirSync(to, { recursive: true });
    }
    const elements = fs.readdirSync(from);
    for (const element of elements) {
        const fromPath = path.join(from, element);
        const toPath = path.join(to, element);
        const stat = fs.lstatSync(fromPath);
        
        if (stat.isDirectory()) {
            copyFolderSync(fromPath, toPath);
        } else if (stat.isFile()) {
            fs.copyFileSync(fromPath, toPath);
        }
    }
}

// Main Sync Function
function runSync() {
    const args = process.argv.slice(2);
    let platforms = Object.keys(TARGETS);
    
    // Parse arguments (e.g. node sync-platforms.js --platform webos)
    const platformIndex = args.indexOf('--platform');
    if (platformIndex !== -1 && args[platformIndex + 1]) {
        const requested = args[platformIndex + 1].toLowerCase();
        if (TARGETS[requested]) {
            platforms = [requested];
        } else {
            console.error(`Unknown platform: ${requested}. Valid choices: ${Object.keys(TARGETS).join(', ')}`);
            process.exit(1);
        }
    }

    console.log(`Starting platform synchronization...`);
    console.log(`Source: ${WEB_DIR}`);

    for (const platform of platforms) {
        const dest = TARGETS[platform];
        console.log(`Syncing to ${platform} -> ${dest}`);
        
        try {
            // Copy all web assets
            copyFolderSync(WEB_DIR, dest);
            
            // Platform-specific adjustments
            if (platform === 'webos') {
                // Ensure icons are copied to root of webOS directory
                const webosIcon = path.join(WEB_DIR, 'assets', 'webos_icon.png');
                const webosLargeIcon = path.join(WEB_DIR, 'assets', 'webos_largeIcon.png');
                const defaultIcon = path.join(WEB_DIR, 'assets', 'icon.png');
                
                if (fs.existsSync(webosIcon) && fs.existsSync(webosLargeIcon)) {
                    fs.copyFileSync(webosIcon, path.join(dest, 'icon.png'));
                    fs.copyFileSync(webosLargeIcon, path.join(dest, 'largeIcon.png'));
                    console.log(`[webOS] Copied custom webOS icons successfully.`);
                } else if (fs.existsSync(defaultIcon)) {
                    fs.copyFileSync(defaultIcon, path.join(dest, 'icon.png'));
                    fs.copyFileSync(defaultIcon, path.join(dest, 'largeIcon.png'));
                    console.log(`[webOS] Copied default app icons successfully.`);
                } else {
                    console.warn(`[webOS Warning] Source icon not found.`);
                }
            }
            
            if (platform === 'vidaa') {
                // Ensure custom icon and banner are copied to assets directory in vidaa
                const vidaaIcon = path.join(WEB_DIR, 'assets', 'vidaa_icon.png');
                if (fs.existsSync(vidaaIcon)) {
                    fs.copyFileSync(vidaaIcon, path.join(dest, 'assets', 'icon.png'));
                    console.log(`[Vidaa] Copied custom Vidaa icon successfully.`);
                }
                const vidaaBanner = path.join(WEB_DIR, 'assets', 'vidaa_banner.png');
                if (fs.existsSync(vidaaBanner)) {
                    fs.copyFileSync(vidaaBanner, path.join(dest, 'assets', 'banner.png'));
                    console.log(`[Vidaa] Copied custom Vidaa banner successfully.`);
                }
            }
            
            console.log(`[Success] Synced ${platform} successfully.`);
        } catch (error) {
            console.error(`[Error] Failed to sync ${platform}:`, error.message);
        }
    }
    console.log(`Synchronization process completed.`);
}

runSync();
