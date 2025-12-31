# iOS Development & Troubleshooting Guide

## 1. The "NativeEventEmitter" Error
**Symptom:** The app crashes immediately with `Invariant Violation: new NativeEventEmitter() requires a non-null argument`.
**Cause:** The JavaScript code includes libraries (like RevenueCat) that are not present in the native app currently installed on the device. This happens when the native build is outdated.
**Solution:** Rebuild and reinstall the native app.

### Command to Rebuild & Install:
```bash
npx expo run:ios --device
```

**Requirements for this command:**

* iPhone must be connected via USB.
* **Developer Mode** must be ON (Settings -> Privacy & Security -> Developer Mode).
* iPhone screen must be **UNLOCKED**.

---

## 2. Daily Development Routine

Once the native app is installed correctly, you don't need to rebuild every time. Just start the Metro bundler:

```bash
npx expo start --dev-client
```

---

## 3. Connection Troubleshooting (Hotspot / Network Issues)

If the app opens but gets stuck on "Loading..." or "Failed to connect", or you are working on a Personal Hotspot:

### Option A: Use Tunnel (Best for Hotspots)

Bypasses local network restrictions.

```bash
npx expo start --dev-client --tunnel
```

* Scan the QR code or enter the `exp://...` URL manually in the app.

### Option B: Manual LAN Connection

If Tunnel is slow, connect directly via IP.

1. **Find your IP:** Run `ipconfig getifaddr en0` (or `en1`).
2. **Enter Manually:** In the Unsweet app, tap "Enter URL manually".
3. **Type:** `http://[YOUR_IP]:8081` (e.g., `http://172.20.10.6:8081`).

### Important Notes:

* **Firewall:** If connection fails, ensure macOS Firewall is OFF (Settings -> Network -> Firewall).
* **Hotspot:** If using iPhone Hotspot, ensure "Maximize Compatibility" is off if possible, or use the Tunnel option.
