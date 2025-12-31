# Troubleshooting Guide - Unsweet App

## Expo Server Connection Issues (Hotspot Setup)

### Problem Description
When running the app with the Mac connected to iPhone hotspot, you may encounter:
- "Could not connect to development server" errors
- "Endpoint is offline" messages
- App stuck on "New update available, downloading..."
- Old cached tunnel URLs not working
- Placeholder icon showing in Expo Go

### Root Causes
1. ngrok running with `--none` flag (no actual tunnel created)
2. Multiple stale Expo/Metro/ngrok processes running
3. Cached `.expo` directory with old tunnel configurations
4. Expo Go app caching old project data

### **The Fix (Tested & Working)**

This fix was successfully tested on 2025-12-15 and resolved all connection issues.

#### Step 1: Kill All Stale Processes
```bash
killall node ngrok 2>/dev/null
```

#### Step 2: Clear Expo Cache
```bash
rm -rf /Users/netanelhadad/Desktop/Unsweet/.expo
```

#### Step 3: Restart Expo with Tunnel Mode
```bash
npx expo start --tunnel --clear
```

#### Step 4: On iPhone
- **Option A**: In Expo Go app, long-press the Unsweet project and delete it
- **Option B**: Delete and reinstall Expo Go app completely

#### Step 5: Scan New QR Code
- Scan the **NEW** QR code from the terminal (don't reuse old cached connection)
- Verify the tunnel URL has changed (e.g., from `azmejhg-...` to a new subdomain)

### Why Tunnel Mode is Required

**Important**: The Mac is connected via iPhone hotspot, NOT regular WiFi. This setup **REQUIRES** tunnel mode to work. LAN mode will NOT work in this configuration.

### Verification

After following these steps, you should see:
- New tunnel URL in terminal (different subdomain than before)
- App loads successfully in Expo Go
- No "downloading update" stuck state
- Correct app icon shows in Expo Go

### Quick Reference Commands

**Full reset sequence (copy-paste):**
```bash
killall node ngrok 2>/dev/null && \
rm -rf /Users/netanelhadad/Desktop/Unsweet/.expo && \
npx expo start --tunnel --clear
```

---

**Last Updated**: 2025-12-15
**Status**: Verified Working ✅
