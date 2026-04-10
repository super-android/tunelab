🏎️ TuneLab for Forza Horizon 6

TuneLab is a high-precision, local-first tuning calculator for Forza Horizon 6. Designed specifically for the Japan-based meta, it provides instant, physics-based suspension and gearing setups optimized for Touge mountain passes and Wangan highway sprints.
🧠 Core Philosophy: Raw Tuning

Unlike generic calculators that rely on static lookup tables, TuneLab utilizes a real-time math engine based on natural frequency and critical damping ratios. Every tune is tailored to the specific weight distribution and PI class of your build.
🔥 Key Features
🏔️ Touge & Wangan Specialized Physics

Optimized logic branches for the unique Japanese terrain of FH6:

    Touge Mode: Automatically softens Anti-Roll Bars (ARBs) by 15% and increases rear deceleration differential to maintain stability over mountain bumps and steep downhill hairpins.

    Wangan Mode: Engineered for the Shuto Expressway. Features stretched final drives (0.88x) and increased tire pressures to ensure 200+ MPH high-speed stability.

🔧 Intelligent Tuning Wizard

A handling feedback loop designed to diagnose mechanical issues. Input symptoms like "Loose on Exit" to receive targeted fixes based on traction circle physics.
✦ Optional AI Analysis

A "Bring Your Own Key" (BYOK) model. Users can optionally connect a Gemini, Grok, or OpenAI API key for car-specific expert notes and deeper setup rationale without any middleman data collection.
🛠️ Tech Stack
🛡️ Privacy & Security

TuneLab is a Zero-Knowledge application:

    No Servers: We operate zero infrastructure. Your data never leaves your device.

    Direct Connect: AI processing is performed via direct client-side API calls to your chosen provider.

    API Keys: Keys are stored on your device only (localStorage) and are never transmitted to us.

🚀 Installation

    Clone: git clone https://github.com/super-android/tunelab

    Install: npm install

    Run: npm run dev

📱 Mobile App

<a href=''><img alt='Get it on Google Play' src='' height='60'/></a>
(Coming Soon — Launching with Forza Horizon 6)

TuneLab is an independent tool and is not affiliated with Xbox Game Studios, Turn 10, or Playground Games. Forza Horizon™ is a registered trademark of Microsoft Corporation.
