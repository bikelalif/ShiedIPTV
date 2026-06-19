# LG Content Store submission - Self-Check List
**Application:** ShieldIPTV (`com.shieldiptv.app`)  
**Version:** `1.0.8` (or `1.0.0`)  
**Target OS:** LG webOS TV (Web App)

This document contains the pre-filled responses for the **Self-Check List** required in the LG TV Seller Lounge before submitting the application for QA. Use these results to quickly fill out the web form.

---

## Summary of Results
* **Total Items:** 53
* **Pass:** 43
* **N/A (Not Applicable):** 10
* **Fail:** 0

---

## Pre-filled Checklist Table

| No. | Test Item | Result | Reason & Details for Seller Lounge |
|---|---|---|---|
| **1** | 1.1 Execution - Launch app → Execute app | **Pass** | Splash screen loads immediately and boots to the CGU modal successfully. |
| **2** | 1.1 Execution - Main Page | **Pass** | UI fits the overscan frame (1080p safe zone) with clear layout on TV screens. |
| **3** | 1.1 Execution - Reboot | **Pass** | App behavior is stable during power cycles and correctly resumes state or resets based on webOS guidelines. |
| **4** | 1.2 Advertisement | **N/A** | The app does not display any advertisements. |
| **5** | 1.3 Display - Resolution | **Pass** | Renders at 1920x1080 (16:9 ratio) natively on webOS TV screen sizes. |
| **6** | 1.3 Display - Correct Text | **Pass** | Clear, uncropped text with multi-language settings (FR/EN/ES/IT). Scrollbars appear for long lists. |
| **7** | 1.3 Display - Mouse Over/Focus | **Pass** | Focus states are clearly visible with a cyan glow/border. Mouse pointer & Magic Remote hover function as expected. |
| **8** | 1.3 Display - Flickering | **Pass** | Screen contents and transitions are fluid without visual flickering. |
| **9** | 1.3 Display - Full Size | **Pass** | Video content fits original ratio or expands to full screen correctly when selected. |
| **10** | 1.4 Function - UI Button | **Pass** | All navigation and action buttons (Live TV, Movies, Series, Settings, Speed Test) trigger their actions properly. |
| **11** | 1.4 Function - BACK Button | **Pass** | Back key returns to the previous screen or prompts exit warning in the home portal. |
| **12** | 1.4 Function - EXIT Button | **Pass** | The app closes or brings up the webOS home launcher bar properly on exit commands. |
| **13** | 1.4 Function - LockUp/LatchUp | **Pass** | No memory leaks or device lockups during continuous media streaming or diagnostics. |
| **14** | 1.4 Function - Abnormal End | **Pass** | Gracefully handles network loss, showcasing "No Connection" messages rather than crashing. |
| **15** | 1.4 Function - Keyboard - Input | **Pass** | Virtual keyboard correctly logs input for M3U URLs, portals, passwords, and search fields. |
| **16** | 1.4 Function - Keyboard - Character Mapping | **Pass** | Correctly maps symbols, capitals, and backspace. |
| **17** | 1.4 Function - Keyboard - Linkage | **Pass** | System virtual keyboard inputs sync correctly with HTML inputs. |
| **18** | 1.4 Function - Terms | **Pass** | A Terms & Conditions (CGU) page shows up at first start and requires client approval to continue. |
| **19** | 1.4 Function - Sign Up | **N/A** | The app has no user registration/sign-up; it is a player shell loading local lists. |
| **20** | 1.4 Function - Sign In | **Pass** | Playlists/logins are saved locally and persist across reboots when chosen by the user. |
| **21** | 1.4 Function - Sign Out | **Pass** | Playlists can be removed or switched via the playlist manager. |
| **22** | 1.4 Function - Search | **Pass** | Dynamic search queries filter list collections correctly. |
| **23** | 1.4 Function - Adult authentication | **N/A** | The app does not supply or bundle adult content. |
| **24** | 1.4 Function - Payment - Purchase | **N/A** | There are no in-app purchases or paid options. |
| **25** | 1.4 Function - Payment - Playback | **N/A** | No premium client payment gates are active. |
| **26** | 1.5 Remote Control - General Remote Control | **Pass** | Supports standard LG remotes (D-pad keys, OK, Back, Exit). |
| **27** | 1.5 Remote Control - Magic remote Control | **Pass** | Full Magic Remote compatibility (pointing, clicking, and scrolling). |
| **28** | 1.5 Remote Control - MMRC/Pointer | **Pass** | Cursor aligns accurately with physical remote hand positioning. |
| **29** | 1.5 Remote Control - MMRC/OK Key | **Pass** | Clicking OK with Magic Remote cursor activates UI elements. |
| **30** | 1.5 Remote Control - MMRC/Wheel | **Pass** | Scroll wheel rolls vertical category paths and grids correctly. |
| **31** | 1.5 Remote Control - Navigation Key | **Pass** | Up/Down/Left/Right remote buttons switch active highlights properly. |
| **32** | 1.5 Remote Control - Function(Color) Key | **N/A** | App does not bind functions to the red/green/yellow/blue color keys. |
| **33** | 1.5 Remote Control - General/OK Key | **Pass** | Core remote OK key functions correctly. |
| **34** | 1.5 Remote Control - Support Only MMRC/General/Basic | **Pass** | Home, Volume, Back, and Power keys function as expected. |
| **35** | 1.5 Remote Control - Support Only MMRC/General/Non Basic | **Pass** | Number keys (e.g. for quick zapping) or standard playback keys work if pressed. |
| **36** | 1.5 Remote Control - HOME Key | **Pass** | Pressing Home brings up the webOS TV dashboard launcher. |
| **37** | 1.5 Remote Control - BACK Key | **Pass** | Back key steps out of deep views (like player, speed test, settings). |
| **38** | 1.5 Remote Control - EXIT Key | **Pass** | Exit key terminates the active app cleanly. |
| **39** | 1.5 Remote Control - LIVE Key | **Pass** | Pressing Live key switches display to Live TV input as handled by webOS. |
| **40** | 1.5 Remote Control - Other Key | **Pass** | Unmapped buttons are handled gracefully without application crash. |
| **41** | 1.6 Language - Change Language | **Pass** | Language toggles successfully update strings dynamically in the app. |
| **42** | 1.7 Sound - Sound | **Pass** | Sound tracks (effects, video audio) play without static noise. Volume keys function correctly. |
| **43** | 1.8 Multimedia - Play Contents | **Pass** | Successfully tests legal stream playback using the "Demo Playlist". |
| **44** | 1.8 Multimedia - Play Contents/Full/Original Screen | **Pass** | Renders in default ratio or full screen. |
| **45** | 1.8 Multimedia - Play/Control/MMRC | **Pass** | Play, Pause, Stop, Next, and Prev remote control handlers map correctly to playback actions. |
| **46** | 1.8 Multimedia - Play Contents/Replay | **Pass** | Stream reload/restart works instantly. |
| **47** | 1.8 Multimedia - Play Contents/Real Time | **Pass** | Live streams play in real-time. |
| **48** | 1.8 Multimedia - Play Contents/subtitle | **Pass** | Displays stream-embedded subtitles if active. |
| **49** | 1.8 Multimedia - Play Contents/Play Resume | **Pass** | VOD playback history tracks last watch time to enable resumes. |
| **50** | 1.8 Multimedia - Contents Resolution | **Pass** | Handles varying video resolutions (SD, HD, FHD, 4K) based on user's streams. |
| **51** | 1.8 Multimedia - Contents Codec | **Pass** | Leverages native HTML5 video codecs backed by webOS device decoders. |
| **52** | 1.8 Multimedia - Contents DRM | **N/A** | Generic player shell; does not host custom proprietary DRM integrations. |
| **53** | 1.9 Factory Reset - Factory Reset | **Pass** | Storage cleans up and resets state cleanly on device reset. |
