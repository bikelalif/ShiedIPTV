import urllib.request
import json
import ssl
import os
import sys

SERVER_URL = "http://your-iptv-domain.com"
USERNAME = "username"
PASSWORD = "password"

MOCK_USER_INFO = {
    "user_info": {
        "username": USERNAME,
        "password": PASSWORD,
        "message": "Welcome (Mock Profile)",
        "auth": 1,
        "status": "Active",
        "exp_date": "1800000000",
        "is_trial": "0",
        "active_cons": "0",
        "max_connections": "1"
    },
    "server_info": {
        "url": "localhost",
        "port": "8000",
        "https_port": "8000",
        "server_protocol": "http",
        "rtmp_port": "80",
        "timezone": "Europe/Paris"
    }
}

MOCK_LIVE_CATEGORIES = [
    {"category_id": "1", "category_name": "NASA & Space", "parent_id": 0},
    {"category_id": "2", "category_name": "News & Broadcasts (English)", "parent_id": 0}
]

MOCK_LIVE_STREAMS = [
    {
        "num": 1,
        "name": "NASA TV HD (Space)",
        "stream_type": "live",
        "stream_id": 1001,
        "stream_icon": "https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg",
        "epg_channel_id": "NASA.us",
        "added": "1620000000",
        "category_id": "1",
        "custom_sid": "",
        "tv_archive": 0,
        "direct_source": "",
        "tv_archive_duration": 0
    },
    {
        "num": 2,
        "name": "Red Bull TV Live",
        "stream_type": "live",
        "stream_id": 1002,
        "stream_icon": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Red_Bull_logo.svg",
        "epg_channel_id": "RedBull.tv",
        "added": "1620000000",
        "category_id": "2",
        "custom_sid": "",
        "tv_archive": 0,
        "direct_source": "",
        "tv_archive_duration": 0
    }
]

MOCK_VOD_CATEGORIES = [
    {"category_id": "10", "category_name": "Animations Libres", "parent_id": 0},
    {"category_id": "11", "category_name": "Cinéma Ouvert / SF", "parent_id": 0}
]

MOCK_VOD_STREAMS = [
    {
        "num": 1,
        "name": "Big Buck Bunny (Animation)",
        "stream_type": "movie",
        "stream_id": 2001,
        "stream_icon": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_Buck_Bunny_堅守自我_official_poster.jpg",
        "added": "1620000000",
        "category_id": "10",
        "container_extension": "mp4",
        "custom_sid": "",
        "direct_source": ""
    },
    {
        "num": 2,
        "name": "Tears of Steel (Sci-Fi Test)",
        "stream_type": "movie",
        "stream_id": 2002,
        "stream_icon": "https://upload.wikimedia.org/wikipedia/commons/6/6f/Tears_of_Steel_poster.jpg",
        "added": "1620000000",
        "category_id": "11",
        "container_extension": "mp4",
        "custom_sid": "",
        "direct_source": ""
    }
]

MOCK_SERIES_CATEGORIES = [
    {"category_id": "20", "category_name": "Séries d'Animation Libres", "parent_id": 0}
]

MOCK_SERIES = [
    {
        "num": 1,
        "name": "Sintel Series",
        "series_id": 3001,
        "cover": "https://upload.wikimedia.org/wikipedia/commons/8/8f/Sintel_poster.jpg",
        "plot": "Sintel est le troisième court métrage d'animation de la Fondation Blender.",
        "cast": "Sintel, Scales",
        "director": "Colin Levy",
        "genre": "Animation",
        "releaseDate": "2010",
        "last_modified": "1620000000",
        "rating": "8.0",
        "rating_5element": 4.0,
        "category_id": "20"
    }
]

MOCK_SERIES_INFO_3001 = {
    "seasons": [
        {"id": 1, "name": "Saison 1", "season_number": 1}
    ],
    "info": {
        "name": "Sintel Series",
        "cover": "https://upload.wikimedia.org/wikipedia/commons/8/8f/Sintel_poster.jpg",
        "plot": "Sintel est le troisième court métrage d'animation de la Fondation Blender.",
        "cast": "Sintel, Scales",
        "director": "Colin Levy",
        "genre": "Animation",
        "releaseDate": "2010",
        "rating": "8.0"
    },
    "episodes": {
        "1": [
            {
                "id": "sintel_ep1",
                "episode_num": "1",
                "title": "Épisode 1: La Quête de Sintel",
                "container_extension": "mp4",
                "info": {
                    "duration": "14:48",
                    "plot": "Sintel recherche son bébé dragon dans un monde fantastique."
                }
            }
        ]
    }
}

def fetch_endpoint(action=None):
    if action:
        url = f"{SERVER_URL}/player_api.php?username={USERNAME}&password={PASSWORD}&action={action}"
    else:
        url = f"{SERVER_URL}/player_api.php?username={USERNAME}&password={PASSWORD}"
    
    print(f"Attempting to fetch: {url.split('password=')[0]}password=***...")
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
    
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=ctx, timeout=8) as response:
        data = response.read()
        return data.decode('utf-8', errors='ignore')

def main():
    endpoints = {
        "user_info": None,
        "live_categories": "get_live_categories",
        "vod_categories": "get_vod_categories",
        "series_categories": "get_series_categories",
        "live_streams": "get_live_streams",
        "vod_streams": "get_vod_streams",
        "series": "get_series"
    }
    
    success_count = 0
    data_map = {}
    
    # Save directory paths
    paths = [
        ".",          # Root folder
        "./web"       # Web folder
    ]
    
    for name, action in endpoints.items():
        try:
            raw_data = fetch_endpoint(action)
            # Check if it parses as valid JSON
            parsed = json.loads(raw_data)
            print(f"Successfully retrieved and parsed JSON for '{name}'.")
            data_map[name] = parsed
            success_count += 1
        except Exception as e:
            print(f"Unable to fetch '{name}' live: {e}. Falling back to mock data.")
            if name == "user_info":
                data_map[name] = MOCK_USER_INFO
            elif name == "live_categories":
                data_map[name] = MOCK_LIVE_CATEGORIES
            elif name == "live_streams":
                data_map[name] = MOCK_LIVE_STREAMS
            elif name == "vod_categories":
                data_map[name] = MOCK_VOD_CATEGORIES
            elif name == "vod_streams":
                data_map[name] = MOCK_VOD_STREAMS
            elif name == "series_categories":
                data_map[name] = MOCK_SERIES_CATEGORIES
            elif name == "series":
                data_map[name] = MOCK_SERIES
    
    # Add series_info_3001 manually
    data_map["series_info_3001"] = MOCK_SERIES_INFO_3001
    
    # Save all files to target folders
    for name, content in data_map.items():
        for path in paths:
            if not os.path.exists(path):
                continue
            file_path = os.path.join(path, f"{name}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(content, f, indent=4, ensure_ascii=False)
            print(f"Saved: {file_path}")
            
    if success_count == len(endpoints):
        print("\nAll files successfully downloaded from Xtream server and saved!")
        sys.exit(0)
    else:
        print(f"\nGenerated mock files for {len(endpoints) - success_count} unreachable services.")
        print(f"Successfully configured local fallback playlist files at root and web/.")
        sys.exit(0)

if __name__ == "__main__":
    main()
