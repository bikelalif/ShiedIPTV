import urllib.request
import urllib.parse
import json
import ssl
import sys

def resolve_host_doh(hostname):
    """
    Resolves the given hostname to an IP address using DNS-over-HTTPS (DoH).
    First tries Google DoH, falls back to Cloudflare DoH on error.
    """
    print(f"[*] Resolving domain '{hostname}' via DoH...")
    
    # Already an IP address
    if all(c.isdigit() or c == '.' for c in hostname):
        return hostname
        
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    # 1. Try Google DoH
    google_url = f"https://dns.google/resolve?name={urllib.parse.quote(hostname)}&type=A"
    try:
        req = urllib.request.Request(google_url, headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req, context=ctx, timeout=8) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and "Answer" in data:
                for ans in data["Answer"]:
                    if ans.get("type") == 1: # A Record
                        ip = ans.get("data")
                        print(f"[+] Google DoH: Resolved to {ip}")
                        return ip
    except Exception as e:
        print(f"[-] Google DoH failed: {e}. Trying Cloudflare...")
        
    # 2. Try Cloudflare DoH
    cf_url = f"https://cloudflare-dns.com/dns-query?name={urllib.parse.quote(hostname)}&type=A"
    try:
        req = urllib.request.Request(cf_url, headers={'Accept': 'application/dns-json'})
        with urllib.request.urlopen(req, context=ctx, timeout=8) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and "Answer" in data:
                for ans in data["Answer"]:
                    if ans.get("type") == 1: # A Record
                        ip = ans.get("data")
                        print(f"[+] Cloudflare DoH: Resolved to {ip}")
                        return ip
    except Exception as e:
        print(f"[-] Cloudflare DoH failed: {e}")
        
    return None

def fetch_endpoint(ip, port, scheme, original_hostname, username, password, action=None):
    """
    Fetches raw data from the IPTV server using the resolved IP and custom Host header.
    """
    host_str = f"{original_hostname}:{port}" if port else original_hostname
    ip_str = f"{ip}:{port}" if port else ip
    
    if action:
        url = f"{scheme}://{ip_str}/player_api.php?username={username}&password={password}&action={action}"
    else:
        url = f"{scheme}://{ip_str}/player_api.php?username={username}&password={password}"
        
    headers = {
        'Host': host_str,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, context=ctx, timeout=20) as response:
        return json.loads(response.read().decode('utf-8', errors='ignore'))

def main():
    print("="*60)
    print("      SHIELDIPTV - DOH STREAM GENERATOR & DUMPER")
    print("="*60)
    
    try:
        server_url = input("1. Enter Xtream Server URL (e.g. http://line.liondnscloud.ru): ").strip()
        username = input("2. Enter Username: ").strip()
        password = input("3. Enter Password: ").strip()
    except KeyboardInterrupt:
        print("\n[!] Aborted by user.")
        sys.exit(0)
        
    if not server_url or not username or not password:
        print("[!] Error: All inputs are required.")
        sys.exit(1)
        
    # Clean and parse URL
    if not server_url.startswith("http"):
        server_url = "http://" + server_url
    if server_url.endswith("/"):
        server_url = server_url[:-1]
        
    parsed_url = urllib.parse.urlparse(server_url)
    hostname = parsed_url.hostname
    port = parsed_url.port
    scheme = parsed_url.scheme or "http"
    
    if not hostname:
        print("[!] Error: Invalid URL.")
        sys.exit(1)
        
    # DoH Resolution
    ip = resolve_host_doh(hostname)
    if not ip:
        print("[-] DNS resolution failed. Check your connection or the domain.")
        sys.exit(1)
        
    print("[*] Connecting to server to check authentication...")
    try:
        profile = fetch_endpoint(ip, port, scheme, hostname, username, password)
        if not profile or not profile.get("user_info") or profile["user_info"].get("auth") != 1:
            print("[!] Authentication failed: Invalid username or password.")
            sys.exit(1)
            
        print("[+] Authentication Successful!")
        print(f"    - Status: {profile['user_info'].get('status')}")
        print(f"    - Expiry Date: {profile['user_info'].get('exp_date')}")
        print(f"    - Max Connections: {profile['user_info'].get('max_connections')}")
    except Exception as e:
        print(f"[-] Connection failed: {e}")
        sys.exit(1)
        
    # Fetch lists
    host_str = f"{hostname}:{port}" if port else hostname
    base_stream_url = f"{scheme}://{host_str}"
    base_stream_url_ip = f"{scheme}://{ip}{f':{port}' if port else ''}"
    
    output_data = {
        "user_info": profile["user_info"],
        "live_streams": [],
        "movies": [],
        "series": []
    }
    
    # 1. Fetch Live Streams
    print("[*] Fetching live channels...")
    try:
        live_raw = fetch_endpoint(ip, port, scheme, hostname, username, password, "get_live_streams")
        if isinstance(live_raw, list):
            for item in live_raw:
                stream_id = item.get("stream_id")
                if stream_id:
                    # Construct stream links
                    item["stream_url"] = f"{base_stream_url}/live/{username}/{password}/{stream_id}.ts"
                    item["stream_url_ip"] = f"{base_stream_url_ip}/live/{username}/{password}/{stream_id}.ts"
                    output_data["live_streams"].append(item)
            print(f"[+] Loaded {len(output_data['live_streams'])} live channels.")
    except Exception as e:
        print(f"[-] Failed to load live channels: {e}")
        
    # 2. Fetch VOD Streams
    print("[*] Fetching movies (VOD)...")
    try:
        vod_raw = fetch_endpoint(ip, port, scheme, hostname, username, password, "get_vod_streams")
        if isinstance(vod_raw, list):
            for item in vod_raw:
                stream_id = item.get("stream_id")
                if stream_id:
                    ext = item.get("container_extension") or "mp4"
                    # Construct stream links
                    item["stream_url"] = f"{base_stream_url}/movie/{username}/{password}/{stream_id}.{ext}"
                    item["stream_url_ip"] = f"{base_stream_url_ip}/movie/{username}/{password}/{stream_id}.{ext}"
                    output_data["movies"].append(item)
            print(f"[+] Loaded {len(output_data['movies'])} movies.")
    except Exception as e:
        print(f"[-] Failed to load movies: {e}")
        
    # 3. Fetch Series
    print("[*] Fetching series list...")
    try:
        series_raw = fetch_endpoint(ip, port, scheme, hostname, username, password, "get_series")
        if isinstance(series_raw, list):
            for item in series_raw:
                series_id = item.get("series_id")
                if series_id:
                    # Add a template link since episodes must be loaded separately
                    item["episode_url_template"] = f"{base_stream_url}/series/{username}/{password}/{{episode_id}}.{{extension}}"
                    item["episode_url_template_ip"] = f"{base_stream_url_ip}/series/{username}/{password}/{{episode_id}}.{{extension}}"
                    output_data["series"].append(item)
            print(f"[+] Loaded {len(output_data['series'])} series.")
    except Exception as e:
        print(f"[-] Failed to load series: {e}")
        
    # Output to JSON
    output_filename = "shieldiptv_channels.json"
    print(f"[*] Saving all channels & links to '{output_filename}'...")
    try:
        with open(output_filename, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=4, ensure_ascii=False)
        print(f"[++] SUCCESS: Saved to '{output_filename}' in the current directory!")
    except Exception as e:
        print(f"[-] Failed to write JSON file: {e}")

if __name__ == "__main__":
    main()
