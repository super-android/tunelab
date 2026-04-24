# TuneLab — FH6 Tuning Calculator

**Free, open-source, AI-assisted tuning calculator for Forza Horizon 6.**  
No ads. No subscriptions. No paywall. Your API key, your quota.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android-green.svg)](https://play.google.com/store)
[![Version](https://img.shields.io/badge/version-1.3.6-orange.svg)](https://github.com/super-android/tunelab/releases)

---

## What it does

TuneLab generates physics-based tunes for any car in Forza Horizon 6 using real suspension math — natural frequency calculations, critical damping ratios, PI-scaled spring rates, and FH6-specific planted physics corrections.

Connect your own free Gemini API key and every tune gets enhanced with per-value expert notes, section tips, and an AI assessment of what the tune does well and what to adjust first.

**Works fully offline.** AI is optional.

---

## D mode vs S mode

| Feature | D Mode — Quick | S Mode — Advanced |
|---|---|---|
| Input effort | Low — car + tune type | Full specs — RPM, gearing, tires |
| Gearing math | Baseline geometric | Precise RPM-based ratios |
| Best for | Casual / first tune | Rivals, meta builds, time attack |
| Time to tune | ~10 seconds | ~2 minutes |

---

## Features

- **8 tune modes** — Race, Touge, Wangan, Drift, Drag, Rally, Rain, General
- **PI-scaled physics** — springs, damping, and caster scale correctly from D-class to X-class
- **AI Enhance** — per-value notes and overall assessment via Gemini 2.5 Flash (BYOK)
- **Tuning Wizard** — diagnose understeer, oversteer, braking issues, twitchiness
- **Feel Adjuster** — real-time stable ↔ tail-happy and planted ↔ aggressive sliders
- **Save / Load / Share** — up to 20 saved tunes, native Android share sheet
- **Manual Copy fallback** — copy the AI prompt, paste Gemini's response back when quota is limited
- **FH6-aware** — damping multiplier, compound auto-defaults, and ride height tuned for FH6 physics

---

## Physics engine

Spring rates use the natural frequency method: `K = M × (2πf)²` where base frequency scales with PI class using the polynomial `6.79e-7 × (PI-100)² + 2.45` — validated against ForzaTune Pro's decompiled constants.

Damping uses critical damping ratio: `C = 2√(KM)` with a 1.15× FH6 planted physics multiplier applied to rebound and bump.

All physics constants live in a single `PHYSICS` block at the top of `src/App.jsx` and will be updated post-FH6-launch based on in-game telemetry data.

### UDP Telemetry (coming soon)

Planning to add a `/telemetry` folder with a Python listener for FH6's Data Out (UDP) feature to validate physics constants in real-time. If you're a dev interested in helping build this out, hit us up in [Discord](https://discord.gg/N4HfuWEXaN) or open an issue.

---

## AI setup (optional)

TuneLab uses a **BYOK (bring your own key)** model. Your key is stored only on your device and is never transmitted to TuneLab servers.

1. Go to [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Create a free API key
3. **Remove any `$0.00` spending cap** — this silently blocks all requests. Set it to $1–2 or remove it entirely. At ~$0.0001 per tune you will not be charged noticeably.
4. Open TuneLab → ✦ button → AI Provider → paste your key → Test & Save

> **🔐 SECURITY: Keep your API key private.**  
> Never share it, screenshot it, or include it in screen recordings.  
> The AI Settings screen shows your key — anyone who sees it can use your quota.  
> TuneLab stores it only on this device. We never see it.

Free tier: 1,500 requests/day on Gemini 2.5 Flash.

---

## Build & run

```bash
# Install dependencies
npm install

# Dev server
npm run dev

# Production build + Android sync
npm run build && npx cap sync android
```

Then open `android/` in Android Studio and run on device.

**Stack:** React + Vite → Capacitor 7 → Android APK  
**Requirements:** Node 18+, Android Studio, Java 17+

---

## Android config notes

Network security config is required for API calls. `android/app/src/main/res/xml/network_security_config.xml` must exist and be referenced in `AndroidManifest.xml`:

```xml
android:networkSecurityConfig="@xml/network_security_config"
android:forceDarkAllowed="false"
```

The config whitelists: `generativelanguage.googleapis.com`, `api.anthropic.com`, `api.openai.com`, `api.x.ai`

> ⚠️ **Keystore:** Never commit `tunelab.keystore` to this repo. It should be in `.gitignore`. Back it up offline — losing it means you can never push an update to the Play Store.

---

## Contributing

Community contributions welcome — especially:

- **Car database** — make, model, drivetrain, weight, front weight % for FH6 cars
- **Physics validation** — do the spring rates feel right in-game? Report in Discord
- **Tune mode calibration** — per car class feedback after FH6 launches

Join the [Discord](https://discord.gg/N4HfuWEXaN) or open a GitHub issue.

---

## Roadmap

- [ ] FH6 launch day — car database from community data
- [ ] Post-launch physics validation via UDP telemetry  
- [ ] Car height data for ARB roll moment calculation
- [ ] Grok and OpenAI provider support (framework ready, marked Coming Soon)
- [ ] Kotlin v2 — proper haptics, system font scaling, reliable theming

---

## Credits

- **[Kireth](https://youtube.com/@Kireth)** — FH6 early access physics feedback
- Physics constants partially derived from ForzaTune Pro decompiled source (math formulas are not copyrightable)

---

## Legal

TuneLab is not affiliated with Xbox, Turn 10, or Playground Games.  
Forza Horizon® is a registered trademark of Microsoft Corporation.  
API keys entered by users are stored locally on-device only and are never transmitted to TuneLab servers.

---

## Support

Free forever. If TuneLab saves you time:  
☕ [Ko-fi](https://ko-fi.com/tunelabs) — tips appreciated, never required  
💬 [Discord](https://discord.gg/N4HfuWEXaN)  
📧 tunelab.dev@gmail.com
