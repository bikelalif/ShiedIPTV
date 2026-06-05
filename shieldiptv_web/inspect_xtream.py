import os
import json
import urllib.request
import urllib.parse
from urllib.error import URLError, HTTPError

def fetch_json(url):
    print(f"Fetching: {url}")
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read()
            return json.loads(data.decode('utf-8'))
    except HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
    except URLError as e:
        print(f"URL Error: {e.reason}")
    except Exception as e:
        print(f"Error: {e}")
    return None

def main():
    print("=== XTREAM CODES API INSPECTOR ===")
    server_url = input("URL du serveur (ex: http://iptv.domain.com:8080) : ").strip()
    username = input("Username : ").strip()
    password = input("Password : ").strip()

    if not server_url.startswith("http"):
        server_url = "http://" + server_url

    if server_url.endswith("/"):
        server_url = server_url[:-1]

    # Create debug folder in same directory as script
    debug_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "xtream_debug")
    os.makedirs(debug_dir, exist_ok=True)
    print(f"\nLes fichiers de debug seront enregistrés dans : {debug_dir}\n")

    base_api = f"{server_url}/player_api.php?username={username}&password={password}"

    # 1. Login & Server Info
    print("--- 1. Login & Server Info ---")
    login_info = fetch_json(base_api)
    if login_info:
        with open(os.path.join(debug_dir, "login_info.json"), "w", encoding="utf-8") as f:
            json.dump(login_info, f, indent=2, ensure_ascii=False)
        
        user_info = login_info.get("user_info", {})
        server_info = login_info.get("server_info", {})
        print(f"Statut : {user_info.get('status')}")
        print(f"Date d'expiration : {user_info.get('exp_date')}")
        print(f"Format de flux préféré : {server_info.get('container_type')}")
        print(f"✓ login_info.json enregistré.\n")
    else:
        print("Échec de connexion ou informations incorrectes.\n")
        return

    # 2. Live Categories
    print("--- 2. Live Categories ---")
    live_cats = fetch_json(f"{base_api}&action=get_live_categories")
    if live_cats:
        with open(os.path.join(debug_dir, "live_categories.json"), "w", encoding="utf-8") as f:
            json.dump(live_cats[:20], f, indent=2, ensure_ascii=False)
        print(f"Nombre total de catégories Live : {len(live_cats)}")
        print(f"✓ live_categories.json enregistré.\n")

    # 3. Live Streams (Sample)
    print("--- 3. Live Streams Sample ---")
    live_streams = fetch_json(f"{base_api}&action=get_live_streams")
    if live_streams:
        with open(os.path.join(debug_dir, "live_streams_sample.json"), "w", encoding="utf-8") as f:
            json.dump(live_streams[:5], f, indent=2, ensure_ascii=False)
        print(f"Nombre total de chaînes : {len(live_streams)}")
        print(f"✓ live_streams_sample.json enregistré.\n")

    # 4. VOD Categories
    print("--- 4. VOD Categories ---")
    vod_cats = fetch_json(f"{base_api}&action=get_vod_categories")
    if vod_cats:
        with open(os.path.join(debug_dir, "vod_categories.json"), "w", encoding="utf-8") as f:
            json.dump(vod_cats[:20], f, indent=2, ensure_ascii=False)
        print(f"Nombre total de catégories VOD : {len(vod_cats)}")
        print(f"✓ vod_categories.json enregistré.\n")

    # 5. VOD Streams (Sample)
    print("--- 5. Movies Sample ---")
    vod_streams = fetch_json(f"{base_api}&action=get_vod_streams")
    if vod_streams:
        with open(os.path.join(debug_dir, "vod_streams_sample.json"), "w", encoding="utf-8") as f:
            json.dump(vod_streams[:5], f, indent=2, ensure_ascii=False)
        print(f"Nombre total de films : {len(vod_streams)}")
        print(f"✓ vod_streams_sample.json enregistré.\n")

    # 6. Series Categories
    print("--- 6. Series Categories ---")
    series_cats = fetch_json(f"{base_api}&action=get_series_categories")
    if series_cats:
        with open(os.path.join(debug_dir, "series_categories.json"), "w", encoding="utf-8") as f:
            json.dump(series_cats[:20], f, indent=2, ensure_ascii=False)
        print(f"Nombre total de catégories Séries : {len(series_cats)}")
        print(f"✓ series_categories.json enregistré.\n")

    # 7. Series (Sample)
    print("--- 7. Series Sample ---")
    series = fetch_json(f"{base_api}&action=get_series")
    if series:
        with open(os.path.join(debug_dir, "series_sample.json"), "w", encoding="utf-8") as f:
            json.dump(series[:5], f, indent=2, ensure_ascii=False)
        print(f"Nombre total de séries : {len(series)}")
        print(f"✓ series_sample.json enregistré.\n")

    print("=== FIN DE L'INSPECTION ===")
    print("Tous les échantillons ont été sauvegardés. Vous pouvez les ouvrir pour voir leur structure.")

if __name__ == "__main__":
    main()
