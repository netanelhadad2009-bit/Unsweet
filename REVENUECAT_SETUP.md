# RevenueCat + App Store Connect Setup Guide

This guide walks you through configuring in-app purchases for Unsweet.

---

## Part 1: App Store Connect Configuration

### Step 1.1: Check Agreements & Banking

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **Agreements, Tax, and Banking** (bottom left, or under your account menu)
3. Ensure **Paid Applications** agreement is:
   - **Accepted** (green checkmark)
   - Tax forms completed
   - Banking info entered

> **Important:** Without a valid Paid Apps agreement, products will NOT appear in sandbox or production.

### Step 1.2: Create Subscription Products

1. Go to **My Apps** → Select **Unsweet**
2. In the left sidebar, under **In-App Purchases**, click **Subscriptions**
3. Create a **Subscription Group** (e.g., "Unsweet Pro")
4. Inside the group, create TWO subscriptions:

#### Monthly Subscription:
- **Reference Name:** `Unsweet Pro Monthly`
- **Product ID:** `unsweet_pro_monthly` (MUST match RevenueCat exactly)
- **Subscription Duration:** 1 Month
- **Price:** Select your price tier (e.g., $4.99)
- Add **Localizations** (Display Name, Description)
- **Review Screenshot:** Required for submission

#### Annual Subscription:
- **Reference Name:** `Unsweet Pro Annual`
- **Product ID:** `unsweet_pro_annual` (MUST match RevenueCat exactly)
- **Subscription Duration:** 1 Year
- **Price:** Select your price tier (e.g., $29.99)
- Add **Localizations** (Display Name, Description)
- **Review Screenshot:** Required for submission

### Step 1.3: Product Status

Ensure each product shows status:
- **Ready to Submit** (for new apps)
- **Approved** (for existing apps)

> Products in "Missing Metadata" won't work!

---

## Part 2: RevenueCat Dashboard Configuration

Go to [RevenueCat Dashboard](https://app.revenuecat.com)

### Step 2.1: Verify App Configuration

1. Select your project **Unsweet**
2. Go to **Project Settings** → **Apps**
3. Verify your iOS app is configured with:
   - **Bundle ID:** `com.yourcompany.unsweet` (must match exactly)
   - **App Store Connect App-Specific Shared Secret** (get from App Store Connect → App → App Information → App-Specific Shared Secret)

### Step 2.2: Import Products

1. Go to **Products** in the left sidebar
2. Click **+ New** to create products manually, OR
3. Click **Import Products** and select your App Store Connect app

Create/verify these products:
| Identifier | Store | App Store Product ID |
|------------|-------|---------------------|
| `unsweet_pro_monthly` | App Store | `unsweet_pro_monthly` |
| `unsweet_pro_annual` | App Store | `unsweet_pro_annual` |

> The **Identifier** in RevenueCat must match the **Product ID** in App Store Connect!

### Step 2.3: Create Entitlement

1. Go to **Entitlements** in the left sidebar
2. Click **+ New**
3. Create an entitlement:
   - **Identifier:** `pro` (this is what code checks: `entitlements.active['pro']`)
   - **Description:** "Pro access to all features"
4. Click the entitlement to open it
5. **Attach Products:** Click **Attach** and add both:
   - `unsweet_pro_monthly`
   - `unsweet_pro_annual`

### Step 2.4: Create Offering

1. Go to **Offerings** in the left sidebar
2. Click **+ New**
3. Create an offering:
   - **Identifier:** `default` (or any name)
   - Check **"Set as current offering"** ← CRITICAL!
4. Inside the offering, create **Packages**:

#### Annual Package:
- Click **+ New Package**
- **Identifier:** Choose `$rc_annual` (standard) or type `annual`
- **Product:** Select `unsweet_pro_annual`

#### Monthly Package:
- Click **+ New Package**
- **Identifier:** Choose `$rc_monthly` (standard) or type `monthly`
- **Product:** Select `unsweet_pro_monthly`

### Step 2.5: Verify Current Offering

1. Go back to **Offerings** list
2. Your offering should show a **star icon** (★) indicating it's the current offering
3. If not, click the offering → **Make Current**

---

## Part 3: Verify API Key

1. Go to **Project Settings** → **API Keys**
2. Copy the **Apple App Store** public key (starts with `appl_`)
3. Verify it matches the key in your code:

```typescript
// In contexts/SubscriptionContext.tsx
const REVENUECAT_API_KEY = 'appl_zADMHAUuBRjmsDDwRGADRcxThaW';
```

---

## Part 4: Testing Checklist

### Sandbox Testing Setup:
1. In App Store Connect → **Users and Access** → **Sandbox Testers**
2. Create a sandbox test account (use a NEW email, not your real Apple ID)
3. On your iPhone:
   - Settings → App Store → Scroll down → **Sandbox Account**
   - Sign in with your sandbox tester account

### Test the Flow:
1. Run the app on your physical device
2. Navigate to the Paywall
3. Check Metro logs for:
   ```
   [Paywall] ✅ RAW OFFERINGS RESPONSE:
   { current: { identifier: "default", ... }, all: {...} }
   ```
4. You should see plan cards with prices
5. Tap to purchase - sandbox payment sheet should appear

---

## Common Issues & Solutions

### Issue: "No App Store products registered"
**Cause:** Products in RevenueCat don't match App Store Connect
**Solution:**
1. Verify Product IDs match EXACTLY (case-sensitive)
2. Ensure products are in "Ready to Submit" or "Approved" status
3. Check that Shared Secret is configured in RevenueCat

### Issue: "offerings.current is null"
**Cause:** No offering is marked as current
**Solution:** In RevenueCat → Offerings → Select your offering → "Make Current"

### Issue: Products show but purchase fails
**Cause:** Sandbox account not configured
**Solution:** Sign into Sandbox Account on device (Settings → App Store → Sandbox)

### Issue: "Cannot connect to iTunes Store"
**Cause:** Network or Apple server issues
**Solution:**
1. Check internet connection
2. Try again in a few minutes
3. Ensure you're not on a VPN that blocks Apple servers

---

## Quick Reference: IDs to Match

| Location | Value |
|----------|-------|
| App Store Connect Product ID | `unsweet_pro_monthly` |
| RevenueCat Product Identifier | `unsweet_pro_monthly` |
| App Store Connect Product ID | `unsweet_pro_annual` |
| RevenueCat Product Identifier | `unsweet_pro_annual` |
| RevenueCat Entitlement ID | `pro` |
| Code Reference | `entitlements.active['pro']` |
| RevenueCat Offering | Must be marked "Current" |
