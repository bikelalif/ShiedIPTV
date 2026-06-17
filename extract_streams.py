import urllib.request
import json
import ssl

# Credentials
SERVER_URL = "http://your-iptv-domain.com"
USERNAME = "username"
PASSWORD = "password"
SEARCH_KEYWORD = "irishman"

def fetch_and_find():
    # Construct API endpoint for VOD streams
    api_url = f"{SERVER_URL}/player_api.php?username={USERNAME}&password={PASSWORD}&action=get_vod_streams"
    
    print(f"Connecting to Xtream server: {SERVER_URL}...")
    
    # Bypass SSL errors if any (for secure connections)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        req = urllib.request.Request(
            api_url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
            data = response.read().decode('utf-8')
            
        streams = json.loads(data)
        if not isinstance(streams, list):
            print("Error: Invalid response format from Xtream API.")
            return

        print(f"Retrieved {len(streams)} movies. Searching for '{SEARCH_KEYWORD}'...")
        
        matches = [m for m in streams if m.get('name') and SEARCH_KEYWORD in m.get('name').lower()]
        
        if not matches:
            print(f"No movie matching '{SEARCH_KEYWORD}' was found.")
            return
            
        print("\nFound matches:")
        for movie in matches:
            name = movie.get('name')
            stream_id = movie.get('stream_id')
            ext = movie.get('container_extension', 'mp4')
            
            # Construct the stream link using the same format as the app code
            stream_url = f"{SERVER_URL}/movie/{USERNAME}/{PASSWORD}/{stream_id}.{ext}"
            
            print(f"- Movie Name: {name}")
            print(f"  Stream ID : {stream_id}")
            print(f"  Extension : {ext}")
            print(f"  Direct URL: {stream_url}\n")
            
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    fetch_and_find()
