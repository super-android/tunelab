# TuneLab — FH6 Tuning Calculator

**Free, open-source tuning calculator for Forza Horizon 6 with optional AI-assisted insights.** No ads. No subscriptions. No paywalls. Just plug in your own API key and tune.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android-green.svg)](https://play.google.com/store)
[![Version](https://img.shields.io/badge/version-1.7.6-orange.svg)](https://github.com/super-android/tunelab/releases)

---

## What it does

TuneLab calculates physics-based setups for any car in Forza Horizon 6 using proper suspension math—natural frequency calculations, critical damping ratios, PI-scaled spring rates, and FH6-specific physics corrections.

If you want a deeper breakdown, you can connect a free Gemini API key to get tailored, value-by-value expert notes, section tips, and a quick assessment of how the car will handle and what to tweak first.

**Works completely offline.** The AI features are entirely optional.

---

## Quick Mode vs. Full Mode

| Feature | Quick Mode | Full Mode |
|---|---|---|
| **Input Effort** | Low — just the car + tune type | Full specs — RPM, gearing, tires |
| **Gearing Math** | Baseline geometric | Precise RPM-based ratios |
| **Best For** | Casual driving / quick baselines | Rivals, meta builds, time attack |
| **Time to Tune** | ~10 seconds | ~2 minutes |

---

## Features

* **8 Tune Modes** — Race, Touge, Wangan, Drift, Drag, Rally, Rain, and General.
* **PI-Scaled Physics** — Springs, damping, and caster scale accurately all the way from D-class to X-class.
* **AI Setup Enhancement** — Hands you per-value notes and a handling overview via Gemini 2.5 Flash (default, BYOK).
* **Tuning Wizard** — Quick diagnostic tool to solve understeer, oversteer, braking issues, or twitchiness.
* **Feel Adjusters** — Real-time sliders to easily dial in stable vs. tail-happy or planted vs. aggressive traits.
* **Save, Load & Share** — Store up to 20 tunes locally and share them natively via the Android share sheet.
* **Manual Prompt Fallback** — Hit your API quota limit? Just copy the raw text prompt, throw it into the Gemini app, and paste the response right back in.
* **Built for FH6** — Damping multipliers, tire compound auto-defaults, and ride heights are pre-calibrated for the FH6 physics engine.

---

## Physics Engine

Spring rates are derived using the natural frequency method: 

$$K = M \times (2\pi f)^2$$

The base frequency scales with the car's PI class using the polynomial:

$$6.79\times 10^{-7} \times (\text{PI} - 100)^2 + 2.45$$

*(Validated against ForzaTune Pro's decompiled constants).*

Damping relies on the critical damping ratio: 

$$C = 2\sqrt{KM}$$

We then apply a 1.15× physics multiplier to both rebound and bump to keep the car planted.

All physics constants live in a single `PHYSICS` block at the top of `src/App.jsx`, making it easy to tweak as community testing uncovers more telemetry data.

### UDP Telemetry (In Progress)
We are currently working on a `/telemetry` directory containing a Python listener for FH6's Data Out (UDP) feature. This will let us validate and fine-tune our physics constants using real-time in-game data. If you want to help build this out, jump into the [Discord](https://discord.gg/N4HfuWEXaN) or open an issue.

---

## AI Setup (Optional)

TuneLab uses a **BYOK (Bring Your Own Key)** model. Your key is stored locally on your device and never touches an external server besides the provider's direct API endpoint.

1. Grab a free key at [aistudio.google.com](https://aistudio.google.com/app/apikey).
2. **Crucial:** Make sure there isn't a strict $0.00 spending cap on your Google AI account, as this silently blocks requests. Set a small safe limit ($1–2) or clear it. At roughly $0.0001 per tune, the free tier usage won't cost you anything noticeable.
3. Open TuneLab → Tap the ✦ button → AI Provider → Paste your key → Test & Save.

> **🔐 SECURITY NOTE:** Keep your API key to yourself. Never screenshot it or include it in screen recordings. Because the AI Settings screen displays the key in plaintext, anyone watching can grab your quota. 

* **Free tier allowance:** 1,500 requests/day via Gemini 2.5 Flash.

---

## Build & Run

```bash
# Install dependencies
npm install

# Run the local dev server
npm run dev

# Build the project and sync with Android
npm run build && npx cap sync android