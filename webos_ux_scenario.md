# ShieldIPTV - webOS App UX Scenario / QA Testing Guide

**Application ID:** `com.shieldiptv.app`  
**Version:** `1.0.8` (or `1.0.0`)  
**Type:** webOS TV Web Application  
**Control Method:** LG Magic Remote / Standard TV D-Pad Remote (Left, Right, Up, Down, OK, Back)

---

## Overview
ShieldIPTV is a client shell application for loading and playing user-owned IPTV playlists (Xtream Codes API or M3U link format). 
* The application **does not supply or bundle any media content**.
* A built-in **"Demo Playlist"** is provided to allow QA testers to verify the app features immediately using public domain legal streams.

---

## Step-by-Step QA Testing Scenarios

### Scenario 1: Initial App Launch & Terms of Service
1. **Action:** Open the ShieldIPTV application on the webOS emulator or TV.
2. **UX Description:** 
   - A modern splash logo screen fades in.
   - The **Terms & Conditions (CGU)** modal will automatically appear.
3. **QA Verification:**
   - Verify that the cursor is focused on the **"Accept" (Accepter)** button by default.
   - Use the D-pad to change the language toggle to cycle between French, English, Spanish, and Italian.
   - Press **OK** on "Accept". The modal closes and redirects to the Playlist Manager.

---

### Scenario 2: Connecting with Demo Playlist
1. **Action:** On the **Playlist Manager** screen, navigate down to the action buttons.
2. **UX Description:**
   - The two actions are "Demo Playlist" (Playlist Démo) and "Terms & Conditions".
3. **QA Verification:**
   - Press **OK** on the **"Demo Playlist"** button.
   - A loader spinner with "Connecting..." appears.
   - Upon successful connection, the screen transitions to the main **Portal** screen.

---

### Scenario 3: Portal & Navigation (Main Menu)
1. **Action:** Main dashboard navigation.
2. **UX Description:**
   - Three large category cards are displayed side-by-side: **LIVE TV**, **MOVIES**, and **SERIES**.
   - Utility action buttons are accessible at the top right: Account Manager, Speed Test, Link Checker, Stream Tester, Settings, Reload.
3. **QA Verification:**
   - Use D-pad **Left / Right** to scroll between cards. Ensure focus visual border is active and sharp.
   - Press **OK** on **LIVE TV**.

---

### Scenario 4: Live TV Playback & Mini-Player
1. **Action:** Select a category and channel to play.
2. **UX Description:**
   - The screen splits into a left sidebar (Categories list) and a right content area (Channels Grid + Mini Preview Player).
3. **QA Verification:**
   - Select the first category, then move D-pad **Right** to enter the channels grid.
   - Navigate to a channel and press **OK**.
   - The video stream will start playing inside the **Mini Preview Player** on the right side of the screen.
   - Press **OK** again on the playing channel (or click on the Mini Player) to toggle **Full Screen** mode.
   - While in Full Screen, press **OK** to display player controls.
   - Press **BACK** on the remote to exit Full Screen and return to the grid.

---

### Scenario 5: Diagnostics (Speed Test)
1. **Action:** Navigate back to the Portal, select **Speed Test** (top utility bar icon).
2. **UX Description:**
   - Displays a clean fullscreen speed test interface.
3. **QA Verification:**
   - Click the **"Lancer le test" (Run Speed Test)** button.
   - The value counts up dynamically and shows your download throughput in Mbps.
   - Click the **Back** button to return to the previous screen.
