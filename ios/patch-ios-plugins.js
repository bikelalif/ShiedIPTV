// Registers app-local native Capacitor plugins after `npx cap sync ios`.
//
// `cap sync` regenerates ios/App/App/capacitor.config.json and rebuilds
// `packageClassList` by scanning ONLY installed npm plugin packages — it ignores
// native plugin classes that live directly in the App target. Without this patch
// our local plugins are dropped from packageClassList and never registered, so
// JS calls like Capacitor.Plugins.ShieldVlcPlayer.play(...) silently do nothing.

const fs = require('fs');
const path = require('path');

const CONFIG = path.resolve(__dirname, '..', 'ios', 'App', 'App', 'capacitor.config.json');

// ObjC names (the @objc(Name) of each app-local CAPPlugin subclass).
const APP_LOCAL_PLUGINS = ['ShieldVlcPlayer'];

if (!fs.existsSync(CONFIG)) {
    console.warn(`[patch-ios-plugins] ${CONFIG} not found (run after \`cap sync ios\`). Skipping.`);
    process.exit(0);
}

try {
    const json = JSON.parse(fs.readFileSync(CONFIG, 'utf-8'));
    const list = Array.isArray(json.packageClassList) ? json.packageClassList : [];
    let changed = false;
    for (const plugin of APP_LOCAL_PLUGINS) {
        if (!list.includes(plugin)) {
            list.push(plugin);
            changed = true;
        }
    }
    json.packageClassList = list;
    fs.writeFileSync(CONFIG, JSON.stringify(json, null, '\t') + '\n');
    console.log(`[patch-ios-plugins] packageClassList = ${JSON.stringify(list)}${changed ? ' (updated)' : ' (already present)'}`);
} catch (e) {
    console.error('[patch-ios-plugins] Failed:', e.message);
    process.exit(1);
}
