import { useState, useEffect, useCallback, Component } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const VERSION       = "1.5.7";

// PI defaults and ranges per class
const CLASS_PI = {
  D:  { min: 100, max: 400, default: 300 },
  C:  { min: 401, max: 500, default: 450 },
  B:  { min: 501, max: 600, default: 550 },
  A:  { min: 601, max: 700, default: 650 },
  S1: { min: 701, max: 800, default: 750 },
  S2: { min: 801, max: 900, default: 850 },
  R:  { min: 901, max: 998, default: 950 },
  X:  { min: 999, max: 999, default: 999 },
};
const PLAY_STORE    = null; // Set to Play Store URL when published
const KOFI_URL      = "https://ko-fi.com/tunelabs";
const DISCORD_URL   = "https://discord.gg/N4HfuWEXaN";
const GITHUB_URL    = "https://github.com/super-android/tunelab";

// ─── PHYSICS CONSTANTS ────────────────────────────────────────────────────────
// FH5-baseline spring frequencies — FH6 rewards SOFTER springs than physics predicts.
// Community standard: run very soft, even minimum. Post-launch: validate and reduce freqMult if stiff.
// ARB, camber, caster, toe updated to FH6 community standards (Apr 2026).
// Base Hz formula (ForzaTune-derived): 6.79e-7 × (PI-100)² + 2.45
// freqMult scales that base per mode: front / rear multipliers.
const PHYSICS = {
  // FH6 uses FM engine — stiffer than FH5, faster transient response
  // freqMult validated May 2026 via telemetry (susp std dev 0.147 → target 0.10)
  // +10% across race modes, Rally/Snow unchanged, Rain slightly stiffer
  freqMult: {
    Race:    {f:1.10, r:1.01},  // +10% — FM engine needs stiffer baseline
    Touge:   {f:1.08, r:0.99},  // +10% — tight corners need planted front
    Drift:   {f:0.85, r:0.78},  // +6% — still soft but more controlled
    Rally:   {f:0.63, r:0.58},  // unchanged — FH5 rally feel confirmed same
    Drag:    {f:0.95, r:0.72},  // +5% — front squat control
    Wangan:  {f:1.04, r:0.97},  // +10% — high speed needs stability
    Rain:    {f:0.85, r:0.79},  // +10% — FM wet model more aggressive
    General: {f:0.96, r:0.91},  // +10% — all-round baseline
  },
  dampRebound:      0.70,  // raised from 0.68 — FM engine rewards slightly more rebound
  dampBump:         0.52,  // raised from 0.50 — faster bump response for FM transients
  horizonDampMult:  1.10,  // reduced from 1.15 — FM base damping already higher than FH5
  casterBase:       5.0,
  casterPIScale:    900,
};

// ─── THEME CSS (injected into DOM, follows device light/dark) ─────────────────
const THEME_STYLE = `
  :root {
    --tl-bg:      #0a0c0f;
    --tl-surface: #14181d;
    --tl-card:    #1a1f26;
    --tl-border:  #283038;
    --tl-text:    #eaf2f7;
    --tl-muted:   #566878;
    --tl-dim:     #2e3740;
    --tl-green:   #00ff85;
    --tl-amber:   #ffb020;
    --tl-red:     #ff4d4d;
    --tl-ice2:    #a8bec8;
  }
  * { box-sizing: border-box; }
  body { background: var(--tl-bg); margin:0; }
  select, input, textarea { color-scheme: dark; }
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-thumb { background: var(--tl-border); border-radius: 2px; }
  @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 6px var(--tl-green)} 50%{opacity:0.5;box-shadow:0 0 2px var(--tl-green)} }
  @keyframes re-fade-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
  input[type=range] { accent-color: var(--tl-accent, var(--tl-green)); }
`;


const C = {
  bg:       "var(--tl-bg)",
  surface:  "var(--tl-surface)",
  card:     "var(--tl-card)",
  border:   "var(--tl-border)",
  accent:   "var(--tl-green)",        // telemetry green — primary action
  accentLo: "rgba(0,255,133,0.08)",
  text:     "var(--tl-text)",
  muted:    "var(--tl-muted)",
  dim:      "var(--tl-dim)",
  green:    "var(--tl-green)",
  amber:    "var(--tl-amber)",
  red:      "var(--tl-red)",
  gold:     "var(--tl-amber)",        // map gold → amber in race engineer
  ice2:     "var(--tl-ice2)",
  // font families
  fCond:    "'Barlow Condensed',sans-serif",
  fBody:    "'Barlow',sans-serif",
  fMono:    "'Share Tech Mono',monospace",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@300;400;500&family=Share+Tech+Mono&display=swap');`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DRIVE_TYPES = ["FWD","RWD","AWD"];

const TUNE_MODES = [
  // color = mode accent used across all UI elements for that mode
  {id:"Race",    icon:"🏁", color:"#00ff85", code:"TARMAC",   label:"Track Day",     sub:"Circuit & road"},   // telemetry green — precision, performance
  {id:"Touge",   icon:"⛰", color:"#7ecc3a", code:"MOUNTAIN", label:"Touge Run",     sub:"Tight corners"},     // lime — mountain roads, technical
  {id:"Wangan",  icon:"🌃", color:"#00cfff", code:"HIGHWAY",  label:"Wangan",        sub:"High speed"},        // ice blue — night highway, speed
  {id:"Drift",   icon:"💨", color:"#ff6b35", code:"ANGLE",    label:"Drift Session", sub:"Sideways"},           // burnt orange — smoke, heat
  {id:"Drag",    icon:"⚡", color:"#e6b800", code:"STRAIGHT", label:"Drag Run",      sub:"Launch focus"},       // electric yellow — launch, voltage
  {id:"Rally",   icon:"🪨", color:"#d4a855", code:"LOOSE",    label:"Rally Stage",   sub:"Gravel & dirt"},      // dirt gold — gravel, dust
  {id:"General", icon:"🔧", color:"#8899aa", code:"GENERAL",  label:"All-Round",     sub:"Balanced setup"},     // steel — neutral, balanced
  {id:"Rain",    icon:"🌧", color:"#6ab0d4", code:"WET",      label:"Wet Control",   sub:"Rain & puddles"},     // muted blue — wet asphalt, last
];

const CLASSES = [
  {id:"D",  range:[100,500]},
  {id:"C",  range:[501,600]},
  {id:"B",  range:[601,700]},
  {id:"A",  range:[701,800]},
  {id:"S1", range:[801,900]},
  {id:"S2", range:[901,998]},
  {id:"R",  range:[800,998]},
  {id:"X",  range:[999,999]},
];

const RPM_SCALES = [
  {label:"0–4k", max:4000},
  {label:"0–5k", max:5000},
  {label:"0–8k", max:8000},
  {label:"0–10k",max:10000},
  {label:"Custom",max:null},
];

const COMPOUNDS = ["Street","Sport","Race Semi-Slick","Race Slick","Rally","Snow","Drag"];
const SURFACES  = ["Road","Dirt","Snow","Mixed"];

const INPUT_DEVICES = [
  {id:"controller", label:"Controller"},
  {id:"wheel",      label:"Wheel"},
  {id:"keyboard",   label:"Keyboard"},
];

const PROBLEMS = [
  {id:"understeer", label:"Understeer",        icon:"↖", desc:"Car pushes wide",
   subs:[{id:"us_entry",label:"Corner entry"},{id:"us_mid",label:"Mid-corner"},{id:"us_exit",label:"On throttle"},{id:"us_high",label:"High speed only"}]},
  {id:"oversteer",  label:"Oversteer",          icon:"↗", desc:"Rear steps out",
   subs:[{id:"os_entry",label:"Corner entry"},{id:"os_mid",label:"Mid-corner snap"},{id:"os_exit",label:"On throttle"},{id:"os_hi",label:"High speed"}]},
  {id:"braking",    label:"Braking instability",icon:"⊗", desc:"Dives, locks, pulls",
   subs:[{id:"br_lock",label:"Front locking"},{id:"br_rear",label:"Rear locking"},{id:"br_dive",label:"Nose dive"},{id:"br_late",label:"Braking too long"}]},
  {id:"sluggish",   label:"Sluggish / numb",    icon:"◎", desc:"Car won't respond",
   subs:[{id:"ur_steer",label:"Steering numb"},{id:"ur_roll",label:"Too much roll"},{id:"ur_trac",label:"Poor traction"},{id:"ur_boost",label:"Turbo lag"}]},
  {id:"twitchy",    label:"Twitchy / snappy",   icon:"≋", desc:"Nervous, unpredictable",
   subs:[{id:"tw_str",label:"Nervous on straights"},{id:"tw_bump",label:"Bouncy over bumps"},{id:"tw_snap",label:"Snaps unexpectedly"},{id:"tw_stiff",label:"Too stiff / harsh"}]},
];

const TUNE_PAGES = ["Tires","Gearing","Alignment","Suspension","ARB","Damping","Braking","Diff"];

const AI_PROVIDERS = [
  {id:"none",   label:"Offline only",   icon:"⚙",  color:"#888899", free:true,  soon:false, key:null,      hint:null,            docs:null},
  {id:"gemini", label:"Google Gemini",  icon:"✦",  color:"#4285f4", free:true,  soon:false, key:"AIza...", hint:"AIza...",        docs:"https://aistudio.google.com/app/apikey"},
  {id:"grok",   label:"xAI Grok",       icon:"𝕏",  color:"#e7e7e7", free:true,  soon:true,  key:null,      hint:"xai-...",        docs:"https://console.x.ai"},
  {id:"openai", label:"OpenAI GPT-4o",  icon:"◈",  color:"#10a37f", free:false, soon:true,  key:null,      hint:"sk-...",         docs:"https://platform.openai.com/api-keys"},
  {id:"claude", label:"Anthropic Claude",icon:"◇", color:"#6c6cff", free:false, soon:true,  key:null,      hint:"sk-ant-api03-...",docs:"https://console.anthropic.com"},
];

// ─── LOCAL STORAGE ────────────────────────────────────────────────────────────
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const SAVES_KEY    = "tl_v1_saves";
const PROVIDER_KEY = "tl_v1_provider";
const KEYS_KEY     = "tl_v1_keys";
const USAGE_KEY    = "tl_v1_ai_usage";
const PREFS_KEY    = "tl_v1_prefs";

// ─── PHYSICS ENGINE ───────────────────────────────────────────────────────────
// Corner weight → spring frequency → spring rate
// f = (1/2π) × sqrt(K/M)  →  K = M × (2πf)²
function calcTune(s) {
  const {
    tuneId, driveType, surface, inputDevice,
    weight, weightDist, redlineRpm, peakTorqueRpm, maxTorque,
    topspeed, gears, tireWF, tireWR, compound,
    hasAero, aeroF, aeroR, dragCd, pi, carClass,
    units, feelBalance, feelAggression, includeGearing,
    carHeight, // mm — used for roll moment ARB calculation
  } = s;

  const wKg        = units.weight === "lbs" ? weight / 2.205 : weight;
  const speedKmh   = units.speed  === "mph" ? topspeed * 1.609 : topspeed;
  const torqueNm   = units.weight === "lbs" ? maxTorque * 1.356 : maxTorque;
  const pUnit      = units.pressure;
  const sUnit      = units.springs;
  const frontPct   = weightDist / 100;
  const rearPct    = 1 - frontPct;

  // Corner weights (kg)
  const cwFL = wKg * frontPct * 0.5;
  const cwRL = wKg * rearPct  * 0.5;

  const isDrift  = tuneId === "Drift";
  const isDrag   = tuneId === "Drag";
  const isRain   = tuneId === "Rain";
  const isRally  = tuneId === "Rally" || surface === "Dirt" || surface === "Mixed";
  const isTouge  = tuneId === "Touge";
  const isWangan = tuneId === "Wangan";
  const isFWD    = driveType === "FWD";
  const isRWD    = driveType === "RWD";
  const isAWD    = driveType === "AWD";
  const isWheel  = inputDevice === "wheel";
  const isSnow   = surface === "Snow";
  const pwr2wt   = (units.weight === "lbs" ? maxTorque * 1.356 : maxTorque) / (wKg / 1000);

  // ── PI-based natural frequency (ForzaTune polynomial method)
  // baseFreq scales with car class: D≈2.45Hz → X≈3.8Hz
  const piNum   = Math.max(100, Math.min(999, pi||500));
  // FH6 base frequency — FM engine runs ~8% stiffer than FH5 at same PI
  // Recalibrated from telemetry: D≈2.65Hz, A≈3.2Hz, S1≈3.6Hz, X≈4.1Hz
  const baseFreq = 7.35e-7 * Math.pow(piNum - 100, 2) + 2.65;

  // Mode multipliers — sourced from PHYSICS constants block (top of file)
  const mod  = PHYSICS.freqMult[tuneId] || PHYSICS.freqMult.General;
  const freq = { f: baseFreq * mod.f, r: baseFreq * mod.r };

  // Damping: FH6 planted physics mult from PHYSICS constants + feel adjuster
  const dampMod = PHYSICS.horizonDampMult * (1.0 + (feelAggression - 50) / 200);

  // ── SPRING RATES
  // K = M × (2πf)²  then convert to display unit
  const calcSpring = (cornerMass, f) => {
    const kNm = cornerMass * Math.pow(2 * Math.PI * f, 2);       // N/m
    if (sUnit === "lbs/in") return +(kNm / 175.127).toFixed(1);  // N/m → lbs/in
    if (sUnit === "n/mm")   return +(kNm / 1000).toFixed(2);     // N/m → N/mm
    if (sUnit === "kgf/mm") return +(kNm / 9806.65 * 1000).toFixed(2);
    return +(kNm / 175.127).toFixed(1); // default lbs/in
  };
  let fSpring = calcSpring(cwFL, freq.f);
  let rSpring = calcSpring(cwRL, freq.r);

  // Feel adjuster: balance slider shifts front/rear spring ratio
  const balanceMod = (feelBalance - 50) / 200; // -0.25 to +0.25
  fSpring = +(fSpring * (1 + balanceMod)).toFixed(1);
  rSpring = +(rSpring * (1 - balanceMod)).toFixed(1);

  // ── RIDE HEIGHT
  const fRide = isDrift ? 3.5 : isRally ? 5.5 : isSnow ? 6.0 : isDrag ? 2.8 : 3.8;
  const rRide = isDrift ? 3.2 : isRally ? 5.2 : isSnow ? 5.8 : isDrag ? 2.6 : 3.5;

  // ── DAMPING (critical damping ratio method)
  // Rebound ≈ 0.65–0.75 × critical, Bump ≈ 0.5–0.6 × critical
  const critDampF = 2 * Math.sqrt(cwFL * (sUnit === "lbs/in" ? fSpring * 175.127 : fSpring * 1000));
  const critDampR = 2 * Math.sqrt(cwRL * (sUnit === "lbs/in" ? rSpring * 175.127 : rSpring * 1000));
  // Damping ratios from PHYSICS constants, scaled by horizonDampMult for FH6
  const rebRatio  = (isDrift ? 0.70 : isRally ? 0.60 : PHYSICS.dampRebound) * PHYSICS.horizonDampMult;
  const bumRatio  = (isDrift ? 0.45 : isRally ? 0.42 : PHYSICS.dampBump)    * PHYSICS.horizonDampMult;
  // FH6 uses 1–20 scale, map from real damping
  const mapDamp = (v) => +Math.max(1, Math.min(20, v / critDampF * 10 * dampMod)).toFixed(1);
  const fRebound = mapDamp(critDampF * rebRatio);
  const rRebound = mapDamp(critDampR * rebRatio);
  const fBump    = mapDamp(critDampF * bumRatio);
  const rBump    = mapDamp(critDampR * bumRatio);

  // ── ARB — weight transfer timing method (FH6 FM engine validated)
  // ARB controls roll stiffness and weight transfer rate, NOT roll moment magnitude.
  // Higher ARB = faster weight transfer = more understeer (front) or oversteer (rear).
  // FH6 meta: AWD = 1/65 (min front, max rear) — locks rear, frees front to rotate.
  // FWD: LOW front, HIGH rear — reduces understeer, rotates car on entry.
  // RWD: moderate front, high rear — rotation without snap oversteer.
  // pwr2wt used to scale RWD rear ARB — more power = more rear stability needed.
  const pwr2wtNorm = Math.min(1, pwr2wt / 800);

  let fARB, rARB;
  if (isDrift) {
    // Drift: soft front for easy initiation, moderate rear for angle hold
    // High aggression = more angle = softer front, stiffer rear
    fARB = 10 + (feelAggression / 100) * 8;   // 10–18
    rARB = 28 + (feelAggression / 100) * 20;  // 28–48
  } else if (isDrag) {
    // Drag: balanced ARB — no cornering, just launch stability
    // Slight rear bias to prevent wheelie tendency on RWD/AWD
    fARB = isRWD ? 35 : isAWD ? 30 : 40;
    rARB = isRWD ? 50 : isAWD ? 45 : 40;
  } else if (isRally) {
    // Rally: both soft for max suspension travel and surface compliance
    // Rear slightly stiffer than front for stability on loose
    fARB = isFWD ? 10 : 8;
    rARB = isFWD ? 18 : isAWD ? 20 : 22;
  } else if (isRain || isSnow) {
    // Wet/snow: very soft both — maximum grip contact patch
    fARB = isFWD ? 8 : 5;
    rARB = isFWD ? 18 : 12;
  } else {
    // Race / Touge / Wangan / General — core meta
    if (isAWD) {
      // 1/65 meta: minimum front, maximum rear
      // Scales very slightly with power — high power AWD needs even more rear lock
      fARB = 1 + Math.round(pwr2wtNorm * 3);   // 1–4
      rARB = 58 + Math.round(pwr2wtNorm * 6);  // 58–64
    } else if (isFWD) {
      // FWD: LOW front (reduce push), HIGH rear (rotate on entry)
      // Opposite of what seems intuitive — rear ARB transfers weight to outside front
      fARB = 15 + Math.round(pwr2wtNorm * 10); // 15–25
      rARB = 50 + Math.round(pwr2wtNorm * 10); // 50–60
    } else {
      // RWD: moderate front for trail braking, high rear for traction stability
      fARB = 8  + Math.round(pwr2wtNorm * 14); // 8–22
      rARB = 45 + Math.round(pwr2wtNorm * 18); // 45–63
    }
  }
  // Feel adjuster: aggression increases rear relative to front
  const arbFeel = (feelAggression - 50) / 10;
  fARB = +Math.max(1, Math.min(65, fARB - arbFeel)).toFixed(1);
  rARB = +Math.max(1, Math.min(65, rARB + arbFeel)).toFixed(1);

  // ── ALIGNMENT
  // Camber: FH6 uses 0 to -2° range — real-world aggressive camber doesn't work here
  // Community standard: RWD more front than rear, FWD more rear than front, AWD close together
  let fCamber = isDrag ? 0.0
              : isSnow ? -0.5
              : isRain  ? -0.8
              : isDrift ? -2.5
              : isRally ? -1.0
              : -1.5;  // base for race/touge/wangan/general
  let rCamber = isDrag ? 0.0
              : isSnow ? -0.3
              : isRain  ? -0.5
              : isDrift ? -1.2
              : isRally ? -0.8
              : -1.0;
  // Drivetrain adjustments per community notes
  if (isFWD) { fCamber = Math.max(fCamber - 0.2, -2.0); rCamber = Math.min(rCamber + 0.3, -0.2); } // FWD: more rear
  if (isRWD) { fCamber = Math.max(fCamber - 0.3, -2.0); }  // RWD: more front than rear
  if (isAWD) { // AWD: values close together
    const avg = (fCamber + rCamber) / 2;
    fCamber = +(avg - 0.1).toFixed(1);
    rCamber = +(avg + 0.1).toFixed(1);
  }
  // Toe: max ±0.3°, prefer small front out for agility, rear in for stability
  let fToe = isDrag ? 0.0 : isDrift ? 0.2 : isRally ? 0.0 : -0.1; // slight out for rotation
  let rToe = isDrag ? 0.0 : isDrift ? -0.2 : isRally ? 0.1 : 0.1; // slight in for stability
  if (isFWD) { fToe = isDrag?0:-0.1; rToe = isDrag?0:0.2; } // FWD: more rear in
  // Caster: community consensus is max 7.0° for all race modes in FH6
  // Lower values for drift (prefer 6.5 for angle control) and snow (stability)
  const caster = isSnow ? 5.5
               : isDrift ? 6.5
               : isDrag  ? 6.0
               : 7.0; // max for all other modes — confirmed community standard

  // ── TIRE PRESSURE
  // Tire pressure: per FH6 tuning guide
  // Stock/Street/Sport: 25-28 psi | Rally road: 28-30 | Semi/Slick/Drift: 30-34
  // Off-road/Rally compound: 15-20 psi
  let fpsi = pUnit === "bar" ? 1.85 : 26.5; // street/sport baseline
  let rpsi = fpsi;
  if (isRain||isSnow) { fpsi = pUnit==="bar"?1.75:25.5; rpsi=fpsi; }
  if (isRally)        { fpsi = pUnit==="bar"?1.95:28.5; rpsi=fpsi; } // rally road: 28-30
  if (isDrag)         { fpsi = pUnit==="bar"?2.00:29.0; rpsi = pUnit==="bar"?1.55:22.5; }
  if (isDrift)        { fpsi = pUnit==="bar"?2.15:31.0; rpsi = pUnit==="bar"?2.00:29.0; }
  if (compound==="Race Slick"||compound==="Race Semi-Slick") { fpsi+=pUnit==="bar"?0.10:1.5; rpsi+=pUnit==="bar"?0.05:0.8; }
  if (compound==="Street") { fpsi-=pUnit==="bar"?0.10:1.5; rpsi-=pUnit==="bar"?0.10:1.5; }
  if (compound==="Rally")  { fpsi-=pUnit==="bar"?0.15:2.0; rpsi-=pUnit==="bar"?0.15:2.0; } // lower pressure for loose surface compliance
  if (compound==="Snow")   { fpsi-=pUnit==="bar"?0.20:3.0; rpsi-=pUnit==="bar"?0.20:3.0; } // much lower for snow traction
  if (compound==="Drag")   { fpsi+=pUnit==="bar"?0.05:0.5; rpsi-=pUnit==="bar"?0.20:3.0; } // high front, low rear for launch
  fpsi=+fpsi.toFixed(pUnit==="bar"?2:1);
  rpsi=+rpsi.toFixed(pUnit==="bar"?2:1);

  // ── BRAKING
  // Traction circle: front bias supports trail braking
  let brakeBal = isDrift ? 46 : isDrag ? 54 : isRain||isSnow ? 52 : isRally ? 54 : 56;
  // Weight distribution adjustment: more front weight = more front bias
  brakeBal += Math.round((frontPct - 0.5) * 20);
  if (isFWD)  brakeBal += 4;
  if (isRWD)  brakeBal -= 3;
  if (isWheel) brakeBal += 2;
  brakeBal = Math.max(40, Math.min(65, brakeBal));
  // Brake pressure: never drop below 100 per FH6 guide — raise for faster response
  // Only drift goes below 100 for modulation control
  // FM engine brakes are stronger — 100 baseline still correct but drift can go lower
  const brakePressure = isDrift ? 85 : isDrag ? 115 : isRain||isSnow ? 95 : isRally ? 95 : 100;
  const trailRating   = isDrift ? 6 : isDrag ? 3 : isRain ? 7 : isRally ? 6 : isWheel ? 9 : 7;

  // ── DIFF
  // FH6 FM engine: snappier throttle response means diff accel values need care
  // High accel lock = planted exit but snappy — lower than FH5 for same feel
  // Drag: high rear accel for launch, low decel so no engine braking lockup
  // Wheelie tendency (high power RWD): reduce rear accel, raise front ARB slightly
  const pN = pwr2wtNorm;
  const isHighPower = pwr2wt > 600; // high power threshold for wheelie risk
  let fAccel=0,fDecel=0,rAccel=0,rDecel=0,center=0;
  if (isFWD) {
    fAccel = isDrift?80:isDrag?85:isRally?65:55;
    fDecel = isDrift?0:isDrag?10:20;
  } else if (isRWD) {
    // Drag: high accel for launch grip, low decel — wheelie risk flagged in output
    // High power RWD: slightly lower accel to prevent snap oversteer on FM engine
    rAccel = isDrift?82:isDrag?90:isRally?60:Math.round(45 + pN*20);
    rDecel = isDrift?30:isDrag?5:isRally?20:18;
  } else {
    // AWD: center balance controls torque split feel
    fAccel = isDrift?30:isDrag?15:isRally?50:35;
    fDecel = isDrift?0:isDrag?5:isRally?15:15;
    rAccel = isDrift?78:isDrag?90:isRally?65:Math.round(50 + pN*15);
    rDecel = isDrift?28:isDrag?5:isRally?25:18;
    center = isDrift?30:isDrag?15:isRally?50:42;
  }

  // ── GEARING (only if includeGearing + RPM data available)
  const hasRPM = redlineRpm > 0 && peakTorqueRpm > 0 && topspeed > 0;
  let gearingData = null;
  if (includeGearing && hasRPM) {
    // Rear tire rolling circumference — rear drives the gearing calculation
    // Front spec stored for display; if rim diameters differ it's a staggered fitment
    const [tw, ta, tr] = (tireWR||"275/35R19").split(/[\/R]/).map(Number);
    const sidewall_mm   = tw * (ta / 100);
    const wheel_radius_mm = (tr * 25.4 / 2) + sidewall_mm;
    const circumference_m = 2 * Math.PI * wheel_radius_mm / 1000;

    // Final drive: v = (rpm × circ) / (finalDrive × 60 × 1000) in km/h
    // → finalDrive = (redlineRpm × circ × 3.6) / (topKmh × 60)
    const topKmh = units.speed === "mph" ? topspeed * 1.609 : topspeed;
    const finalDrive = +((redlineRpm * circumference_m * 3.6) / (topKmh * 60)).toFixed(3);
    const clampedFD   = +Math.max(2.50, Math.min(5.50, finalDrive)).toFixed(2);

    // Gear ratios: geometric progression from 1st to last
    // 1st gear = finalDrive × (redline / peakTorque) — keeps engine in powerband
    // ForzaTune logarithmic 1st gear limiter — prevents wheelspin on high torque cars
    // Math.exp(-0.5 * (gears - 2)) + 0.9 scales the limiter by number of gears
    const gearLimiter = Math.exp(-0.5 * (gears - 2)) + 0.9;
    const rawRatio1   = redlineRpm / peakTorqueRpm * 0.95;
    // Sigmoid cap: limits how tall 1st gear can be on high-torque cars
    const torqueNorm  = Math.min(1, torqueNm / 800);
    const ratio1Limit = 32 * gearLimiter / (1 + Math.exp(-0.8 * (torqueNorm * 100 - 45) / (8 * gearLimiter))) + 30;
    const ratio1 = +(Math.min(rawRatio1, ratio1Limit / 10)).toFixed(2);
    const ratioN = 1.0; // top gear = 1.0 overdrive baseline
    const step = Math.pow(ratioN / ratio1, 1 / (gears - 1));
    const ratios = Array.from({length: gears}, (_, i) => +(ratio1 * Math.pow(step, i)).toFixed(2));

    gearingData = { finalDrive: clampedFD, ratios };
  }

  // ── FORMAT HELPERS
  const pStr = v => pUnit==="bar" ? `${v} bar` : `${v} psi`;
  const sStr = v => `${v} ${sUnit}`;

  const diffValues = isFWD ? [
    {key:"Front Accel",value:`${fAccel}%`},{key:"Front Decel",value:`${fDecel}%`},
  ] : isRWD ? [
    {key:"Rear Accel",value:`${rAccel}%`},{key:"Rear Decel",value:`${rDecel}%`},
  ] : [
    {key:"Front Accel",value:`${fAccel}%`},{key:"Front Decel",value:`${fDecel}%`},
    {key:"Rear Accel", value:`${rAccel}%`},{key:"Rear Decel", value:`${rDecel}%`},
    {key:"Center Balance",value:`${center}% fwd`},
  ];

  const gearingValues = gearingData ? [
    {key:"Final Drive", value:String(gearingData.finalDrive)},
    ...gearingData.ratios.map((r,i)=>({key:`${i+1}${["st","nd","rd"][i]||"th"} Gear`,value:String(r)})),
  ] : null;

  return {
    Tires: { values:[
      {key:"Front Pressure", value:pStr(fpsi)},
      {key:"Rear Pressure",  value:pStr(rpsi)},
      {key:"Front Width",    value:tireWF.includes("/")?`${tireWF.replace(/mm$/,"")}`:`${tireWF}mm`},
      {key:"Rear Width",     value:tireWR.includes("/")?tireWR:tireWR+" mm"},
      {key:"Compound",       value:compound},
    ], tip: isDrift?"Lower rear pressure breaks traction predictably on throttle.":isRain?"Keep pressure low — cold wet tarmac needs more contact patch.":"Adjust ±0.5 psi front if you feel mid-corner push."},

    Gearing: gearingValues ? {
      values: gearingValues,
      tip: isDrag?"Keep shifts tight in 1–3, longer in 4+ for high speed.":"Space gears to keep engine in powerband through corners.",
    } : null,

    Alignment: { values:[
      {key:"Front Camber", value:`${fCamber.toFixed(1)}°`},
      {key:"Rear Camber",  value:`${rCamber.toFixed(1)}°`},
      {key:"Front Toe",    value:`${fToe.toFixed(1)}°`},
      {key:"Rear Toe",     value:`${rToe.toFixed(1)}°`},
      {key:"Front Caster", value:`${caster.toFixed(1)}°`},
    ], tip:"Adjust camber in 0.2° steps — too much causes uneven tire wear and kills straight-line grip."},

    Suspension: { values:[
      {key:"Front Spring", value:sStr(fSpring)},
      {key:"Rear Spring",  value:sStr(rSpring)},
      {key:"Front Ride Height", value:`${fRide.toFixed(1)} in`},
      {key:"Rear Ride Height",  value:`${rRide.toFixed(1)} in`},
    ], tip: isRally?"Prioritise ground clearance over aero — ride height matters more than spring stiffness on dirt.":"Front equal to or slightly lower than rear for high-speed stability."},

    ARB: { values:[
      {key:"Front ARB", value:fARB.toFixed(1)},
      {key:"Rear ARB",  value:rARB.toFixed(1)},
    ], tip:"If the car snaps on entry: soften rear ARB. If it understeers: soften front ARB."},

    Damping: { values:[
      {key:"Front Rebound", value:fRebound.toFixed(1)},
      {key:"Rear Rebound",  value:rRebound.toFixed(1)},
      {key:"Front Bump",    value:fBump.toFixed(1)},
      {key:"Rear Bump",     value:rBump.toFixed(1)},
    ], tip:"Rebound always higher than bump. Bouncy over bumps: increase bump. Wooden feel: decrease rebound."},

    Braking: { values:[
      {key:"Brake Balance",     value:`${brakeBal}% F`},
      {key:"Brake Pressure",    value:`${brakePressure}%`},
      {key:"Trail Brake Rating",value:`${trailRating}/10`},
    ], tip: isWheel?"Trail brake: gradually release as you turn in — don't release all at once.":"Under ABS: hold threshold pressure and steer — the game manages lockup."},

    Diff: { values: diffValues, tip: isDrift?"High rear accel keeps the slide going. Adjust decel for entry rotation.":isDrag&&isRWD&&isHighPower?"⚠ High power RWD drag: if wheelie tendency, raise front ARB 5 points and lower rear ride height 0.5 cm.":isDrag?"Launch tune: high rear accel for grip, low decel to avoid lockup on shifts.":isFWD?"Low front accel reduces torque steer. High rear diff rotates the car on entry.":"Rear accel controls exit traction. Center balance shifts torque character." },
  };
}



// ─── KEY VALIDATOR ────────────────────────────────────────────────────────────
async function validateKey(providerId, apiKey) {
  try {
    if(providerId==="gemini") {
      // Use models list — no quota consumed, also tells us what models are available
      const url=`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=20`;
      let r;
      try { r = await fetch(url,{method:"GET"}); }
      catch(e) { return {ok:false, msg:"Network error — check internet connection and try again"}; }
      if(r.status===400) return {ok:false, msg:"Invalid key — check you copied it correctly"};
      if(r.status===401) return {ok:false, msg:"Key rejected — regenerate it at aistudio.google.com"};
      if(r.status===403) return {ok:false, msg:"Key not authorised — enable Gemini API in Google AI Studio"};
      if(r.status===429) return {ok:true,  msg:"Key valid ✓ (rate limited right now — quota resets midnight UTC)"};
      if(!r.ok)          return {ok:false, msg:`Error ${r.status} — check key and try again`};
      try {
        const d = await r.json();
        const names = (d.models||[])
          .filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent"))
          .map(m=>m.name.replace("models/",""));
        const has25 = names.some(n=>n.includes("2.5-flash"));
        const has20 = names.some(n=>n.includes("2.0-flash"));
        const has15 = names.some(n=>n.includes("1.5-flash"));
        const bestModel = has25?"gemini-2.5-flash":has20?"gemini-2.0-flash":has15?"gemini-1.5-flash":null;
        if(!bestModel) return {ok:false, msg:"No usable Gemini model found on this key"};
        // Test a tiny generation call to detect $0 spending cap
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${bestModel}:generateContent?key=${apiKey}`;
        const testR = await fetch(testUrl,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents:[{role:"user",parts:[{text:"Hi"}]}],generationConfig:{maxOutputTokens:1}})});
        if(testR.status===429) return {ok:false, msg:"⚠ Spending cap detected — go to aistudio.google.com → Settings → Billing and remove the $0.00 spending cap, then test again"};
        if(testR.status===403) return {ok:false, msg:"Key not authorised — enable Gemini API in Google AI Studio"};
        if(!testR.ok) return {ok:false, msg:`Test call failed (${testR.status}) — check key permissions`};
        return {ok:true, msg:`Key valid ✓ — ${bestModel} ready`};
      } catch { return {ok:true, msg:"Key valid ✓ — ready to enhance tunes"}; }
    }
    if(providerId==="grok") {
      // Use models list endpoint — no generation quota consumed
      const r=await fetch("https://api.x.ai/v1/models",{method:"GET",headers:{"Authorization":"Bearer "+apiKey}});
      if(r.status===401) return {ok:false, msg:"Invalid key — check console.x.ai"};
      if(r.status===429) return {ok:true,  msg:"Key valid ✓ (rate limited right now)"};
      if(!r.ok)          return {ok:false, msg:`Error ${r.status}`};
      return {ok:true, msg:"Key valid ✓ — ready to enhance tunes"};
    }
    if(providerId==="openai") {
      // Use models list endpoint — no tokens consumed
      const r=await fetch("https://api.openai.com/v1/models",{method:"GET",headers:{"Authorization":"Bearer "+apiKey}});
      if(r.status===401) return {ok:false, msg:"Invalid key — check platform.openai.com"};
      if(r.status===429) return {ok:true,  msg:"Key valid ✓ (rate limited or no credits)"};
      if(!r.ok)          return {ok:false, msg:`Error ${r.status}`};
      return {ok:true, msg:"Key valid ✓ — ready to enhance tunes"};
    }
    if(providerId==="claude") {
      // Use models list endpoint — no tokens consumed
      const r=await fetch("https://api.anthropic.com/v1/models",{method:"GET",headers:{"x-api-key":apiKey,"anthropic-version":"2023-06-01"}});
      if(r.status===401) return {ok:false, msg:"Invalid key — check console.anthropic.com"};
      if(r.status===429) return {ok:true,  msg:"Key valid ✓ (rate limited right now)"};
      if(!r.ok)          return {ok:false, msg:`Error ${r.status}`};
      return {ok:true, msg:"Key valid ✓ — ready to enhance tunes"};
    }
    return {ok:false, msg:"Unknown provider"};
  } catch(e) {
    return {ok:false, msg:"Network error — check internet connection"};
  }
}

// ─── AI CALLS ─────────────────────────────────────────────────────────────────
async function callAI(providerId, apiKey, sys, usr) {
  if (providerId === "gemini") {
    // Try models in order — 2.0-flash is fastest, fall back to 1.5-flash if 404
    // gemini-2.0-flash deprecated for new API keys — use 2.5-flash as primary
    const models = [
      "gemini-2.5-flash",        // primary — available to all new keys
      "gemini-2.5-flash-lite",   // lighter fallback
      "gemini-flash-latest",     // alias fallback
      "gemini-2.0-flash",        // legacy — kept for older keys
    ];
    let lastErr = null;
    const _aiStart = Date.now();
    for(const model of models) {
      // Key in header (x-goog-api-key) AND query param — Android WebView sometimes strips query strings
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      let r;
      try { r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents:[{role:"user",parts:[{text:sys+"\n\n"+usr}]}],generationConfig:{temperature:0.4,maxOutputTokens:4096}})}); }
      catch(netErr) { throw new Error("Network error — check internet connection"); }
      if(r.status===404) {
        const body = await r.json().catch(()=>({}));
        console.log(`TuneLab AI: 404 on ${model} — ${JSON.stringify(body).slice(0,200)}`);
        lastErr="model_not_found"; continue;
      }
      if(r.status===429) throw new Error("RATE_LIMIT_EXHAUSTED");
      if(r.status===401||r.status===403) throw new Error("Gemini key invalid or not authorised — check AI settings");
      if(r.status===503) {
        // Google overloaded — retry same model up to 3x with increasing delay
        let succeeded = false;
        for(let attempt=1; attempt<=3; attempt++){
          const wait = attempt * 5000;
          console.log(`TuneLab AI: 503 on ${model} — waiting ${wait/1000}s (attempt ${attempt}/3)`);
          await new Promise(res=>setTimeout(res,wait));
          const r2 = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents:[{role:"user",parts:[{text:sys+"\n\n"+usr}]}],generationConfig:{temperature:0.4,maxOutputTokens:4096}})}).catch(()=>null);
          if(!r2) continue;
          if(r2.ok){ const d2=await r2.json(); console.log(`TuneLab AI: responded via ${model} after ${attempt} retry`); return d2.candidates?.[0]?.content?.parts?.[0]?.text||""; }
          if(r2.status!==503) break;
        }
        console.log(`TuneLab AI: ${model} still 503 after retries — trying next model`);
        continue;
      }
      if(!r.ok) throw new Error(`Gemini ${r.status} — ${(await r.json().catch(()=>({}))).error?.message||"unknown error"}`);
      const d = await r.json();
      const elapsed = Date.now() - _aiStart;
      console.log(`TuneLab AI: responded via ${model} in ${(elapsed/1000).toFixed(1)}s`);
      return d.candidates?.[0]?.content?.parts?.[0]?.text||"";
    }
    throw new Error("No Gemini model available — try a different AI provider or use Manual Copy");
  }
  if (providerId === "grok") {
    const r = await fetch("https://api.x.ai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},body:JSON.stringify({model:"grok-3-mini",messages:[{role:"system",content:sys},{role:"user",content:usr}],temperature:0.4,max_tokens:1200})});
    if(!r.ok) throw new Error("Grok "+r.status);
    const d = await r.json(); return d.choices?.[0]?.message?.content||"";
  }
  if (providerId === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"system",content:sys},{role:"user",content:usr}],temperature:0.4,max_tokens:1200})});
    if(!r.ok) throw new Error("OpenAI "+r.status);
    const d = await r.json(); return d.choices?.[0]?.message?.content||"";
  }
  if (providerId === "claude") {
    const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:1200,system:sys,messages:[{role:"user",content:usr}]})});
    if(!r.ok) throw new Error("Claude "+r.status);
    const d = await r.json(); return d.content?.[0]?.text||"";
  }
  throw new Error("Unknown provider");
}

function buildEnhancePrompt(s, tune) {
  const tm = TUNE_MODES.find(t=>t.id===s.tuneId);
  const allValues = [];
  TUNE_PAGES.forEach(pg=>{
    const d = tune[pg]; if(!d) return;
    (d.values||[]).forEach(r=>allValues.push(`${pg}/${r.key}: ${r.value}`));
  });
  const sections = TUNE_PAGES.filter(pg=>tune[pg]).join(",");
  return {
    sys: `You are a Forza Horizon 6 tuning expert. Return ONLY a raw JSON object. No markdown, no backticks, no text before or after. Start with { and end with }.

Structure:
{
  "notes": { "Section/Key": "note including specific adjustment if needed e.g. try reducing by 2" },
  "tips":  { "Section": "one concrete actionable tip" },
  "summary": "2-3 sentences: what this tune does well, what to adjust first, why"
}

Rules:
- notes keys MUST match Section/Key exactly as provided (e.g. "Gearing/Final Drive" not just "Gearing")
- Each gear in Gearing gets its own specific note — do not repeat the same note for every gear
- Where a value seems wrong for the mode, suggest a specific change (e.g. "reduce by 3", "try 28.5 psi")
- Keep each note under 12 words
- Be specific to the car, drivetrain, and tune mode given`,
    usr: `Car: ${s.make} ${s.model} | ${s.driveType} | ${tm?.id} mode | ${s.surface} | ${s.weightDist}%F weight | ${s.pi}${s.carClass} | ${s.inputDevice}

Tune values:
${allValues.join("\n")}

Sections present: ${sections}`
  };
}

// Map flat notes/tips response back onto tune pages
function mergeEnhancement(tune, enhanced) {
  const merged = { _summary: enhanced.summary || null };
  TUNE_PAGES.forEach(pg=>{
    if(!tune[pg]) return;
    merged[pg] = {
      values: (tune[pg].values||[]).map(r=>({
        ...r,
        // Match "Section/Key" format exactly
        note: enhanced.notes?.[`${pg}/${r.key}`]
           || enhanced.notes?.[pg]   // fallback: section-level note applied to all rows
           || r.note,
      })),
      tip: enhanced.tips?.[pg] || tune[pg].tip,
    };
  });
  return merged;
}

// ─── FORMAT TUNE AS TEXT ──────────────────────────────────────────────────────
function formatTuneText(s, pages) {
  const tm = TUNE_MODES.find(t=>t.id===s.tuneId);
  const out = [
    `TuneLab — ${s.make} ${s.model}`,
    `${tm?.icon} ${tm?.id} | ${s.carClass} ${s.pi}PI | ${s.driveType}`,
    `─────────────────────────────`,
  ];
  TUNE_PAGES.forEach(pg => {
    const d = pages[pg]; if(!d) return;
    out.push(`\n${pg}`);
    // values only — no notes/tooltips in shared output
    (d.values||[]).forEach(r => out.push(`  ${r.key.padEnd(22)} ${r.value}`));
  });
  out.push(`\n─────────────────────────────`);
  out.push(`Tuned with TuneLab — free FH6 tuning calculator`);
  if(PLAY_STORE) out.push(`Get it: ${PLAY_STORE}`);
  out.push(`Support the dev: ${KOFI_URL}`);
  out.push(`\n⚠ This tune was shared from TuneLab. AI features require your own API key — never share your key.`);
  return out.join("\n");
}

// ─── WIZARD OFFLINE FIXES ─────────────────────────────────────────────────────
const OFFLINE_FIXES = {
  understeer:{diagnosis:"Front tires losing grip before rears. Usually front spring too stiff, too little front negative camber, or front ARB too high.",fixes:[{setting:"Front ARB",change:"Reduce by 3–5",why:"Softer front ARB allows more weight transfer to front tires"},{setting:"Front Camber",change:"Add 0.3° more negative",why:"More contact patch under cornering load"},{setting:"Rear ARB",change:"Increase by 2–3",why:"Shifts load forward, encouraging rotation"}],tip:"Trail brake deeper into corners — releasing mid-corner shifts weight forward and helps rotation."},
  oversteer:{diagnosis:"Rear tires breaking traction first. Usually rear spring too stiff, too little rear camber, or diff acceleration too aggressive.",fixes:[{setting:"Rear ARB",change:"Reduce by 3–5",why:"Softer rear ARB improves rear grip"},{setting:"Rear Accel Diff",change:"Reduce by 10–15%",why:"Less locking on acceleration stops rear stepping out"},{setting:"Rear Camber",change:"Add 0.2° more negative",why:"More rear contact patch under load"}],tip:"Smooth progressive throttle — power oversteer is most controllable with a patient right foot."},
  braking:{diagnosis:"Improper brake bias or excessive pressure causing lockup or instability under braking.",fixes:[{setting:"Brake Balance",change:"Add 3–5% rear",why:"Reducing front bias prevents front lockup"},{setting:"Brake Pressure",change:"Reduce by 10–15%",why:"More modulation range, prevents lockup"},{setting:"Front Bump",change:"Increase by 0.5",why:"Reduces nose dive, keeps braking forces stable"}],tip:"Trail brake: hold 20–30% brake pressure as you begin to steer, release as you increase angle."},
  sluggish:{diagnosis:"Car too softly sprung or diff too open, causing slow weight transfer and lazy response.",fixes:[{setting:"Front/Rear ARB",change:"Increase both by 3",why:"Stiffer ARB reduces body roll, faster response"},{setting:"Rear Accel Diff",change:"Increase by 10%",why:"More lock gets power down faster"},{setting:"Front Spring",change:"Increase by 10%",why:"Reduces dive, improves turn-in response"}],tip:"On a controller: try increasing steering sensitivity in game assists — car may be responding but input range is too small."},
  twitchy:{diagnosis:"Excessive stiffness — too much ARB, too stiff springs, or damping transmitting inputs directly.",fixes:[{setting:"Front/Rear ARB",change:"Reduce both by 4–5",why:"Softer ARB smooths out transitions, reduces snap"},{setting:"Bump Damping",change:"Reduce front/rear by 0.5",why:"Lets car absorb surface irregularities"},{setting:"Rear Toe",change:"Add 0.1° toe-in",why:"Mild rear toe-in adds straight-line stability"}],tip:"Check tire pressures first — overinflated tires have a smaller contact patch and much less stability."},
};

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
const S = {
  card:   { background:C.card, border:`1px solid ${C.border}`, borderRadius:8 },
  label:  { fontFamily:C.fMono, fontSize:10, color:C.muted, letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:8, display:"block" },
  mono:   { fontFamily:C.fMono },
  btn:    { cursor:"pointer", border:"none", display:"flex", alignItems:"center", justifyContent:"center" },
  cond:   { fontFamily:C.fCond },
  body:   { fontFamily:C.fBody },
};

function Toast({msg, onDone}) {
  useEffect(()=>{ const t=setTimeout(onDone,2500); return()=>clearTimeout(t); },[]);
  return (
    <div style={{position:"fixed",bottom:110,left:"50%",transform:"translateX(-50%)",zIndex:999,background:"rgba(0,255,133,0.08)",border:"1px solid rgba(0,255,133,0.3)",borderRadius:4,padding:"8px 20px",fontFamily:C.fMono,fontSize:10,color:C.green,letterSpacing:"0.2em",textTransform:"uppercase",pointerEvents:"none",whiteSpace:"nowrap",boxShadow:"0 0 20px rgba(0,255,133,0.1)"}}>
      {msg}
    </div>
  );
}

function Seg({label, opts, val, set, color, onColor}) {
  const ac = color || C.accent;
  const tc = onColor || "#fff";
  return (
    <div style={{marginBottom:12}}>
      {label && <span style={S.label}>{label}</span>}
      <div style={{display:"flex",gap:0}}>
        {opts.map((o,i) => (
          <button key={o} onClick={()=>set(o)} style={{...S.btn,flex:1,padding:"9px 4px",
            borderTop:`1px solid ${val===o?ac:C.border}`,
            borderBottom:`1px solid ${val===o?ac:C.border}`,
            borderLeft:`1px solid ${val===o?ac:C.border}`,
            borderRight:i===opts.length-1?`1px solid ${val===o?ac:C.border}`:"none",
            borderRadius:i===0?"4px 0 0 4px":i===opts.length-1?"0 4px 4px 0":"0",
            background:val===o?ac:"transparent",
            color:val===o?tc:C.muted,
            fontFamily:C.fCond,fontSize:13,fontWeight:val===o?700:500,
            letterSpacing:"0.1em",textTransform:"uppercase",transition:"all 0.12s"}}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumIn({label, value, onChange, unit="", min, max, step=1, hint}) {
  const [f,setF] = useState(false);
  return (
    <div style={{marginBottom:10}}>
      <span style={S.label}>{label}{unit?<span style={{color:C.dim,marginLeft:6}}>{unit}</span>:null}</span>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v))onChange(v);}}
          onFocus={()=>setF(true)} onBlur={()=>setF(false)}
          style={{flex:1,fontFamily:C.fMono,background:f?C.card:C.surface,
            border:`1px solid ${f?"rgba(0,255,133,0.4)":C.border}`,
            borderLeft:f?"3px solid rgba(0,255,133,0.6)":`3px solid ${C.border}`,
            borderRadius:4,padding:"9px 11px",color:C.text,fontSize:14,outline:"none"}}
        />
      </div>
      {hint && <span style={{fontFamily:C.fBody,fontSize:10,color:C.dim,marginTop:3,display:"block",lineHeight:1.4}}>{hint}</span>}
    </div>
  );
}

function ModeGrid({value, onChange}) {
  return (
    <div style={{marginBottom:12}}>
      <span style={S.label}>Tune Mode</span>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {TUNE_MODES.map(m => {
          const active = value===m.id;
          return (
            <button key={m.id} onClick={()=>onChange(m.id)}
              style={{cursor:"pointer",
                border:`1px solid ${active?m.color+"66":C.border}`,
                borderRadius:8,padding:"12px 14px",
                background:active?m.color+"12":C.surface,
                textAlign:"left",position:"relative",overflow:"hidden",transition:"all 0.15s",
                outline:"none"}}>
              {active&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${m.color},transparent)`,opacity:0.8}}/>}
              <div style={{fontFamily:C.fMono,fontSize:9,color:active?m.color:C.muted,letterSpacing:"0.15em",marginBottom:4}}>{m.code}</div>
              <div style={{fontFamily:C.fCond,fontSize:16,fontWeight:700,letterSpacing:"0.04em",color:active?C.text:C.ice2,lineHeight:1.1}}>{m.label}</div>
              <div style={{fontFamily:C.fBody,fontSize:11,fontWeight:300,color:active?m.color+"aa":C.muted,marginTop:3}}>{m.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Slider({label, value, onChange, min=0, max=100, leftLabel, rightLabel, color=C.accent, labelColor}) {
  const pct = ((value-min)/(max-min))*100;
  const lc = labelColor || C.dim;
  return (
    <div style={{marginBottom:10}}>
      {label && <span style={S.label}>{label}</span>}
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(+e.target.value)}
        style={{width:"100%",accentColor:color,height:3,cursor:"pointer"}}
      />
      {(leftLabel||rightLabel) && (
        <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
          <span style={{fontFamily:C.fBody,fontSize:12,color:lc}}>{leftLabel}</span>
          <span style={{fontFamily:C.fBody,fontSize:12,color:lc}}>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

function WeightDistSlider({value, onChange, color}) {
  const ac = color || C.accent;
  return (
    <div style={{...S.card,padding:"10px 12px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <span style={{...S.label,marginBottom:0}}>Weight distribution</span>
        <span style={{...S.mono,fontSize:12,color:ac}}>{value}F / {100-value}R</span>
      </div>
      <input type="range" min={30} max={70} value={value} step={1}
        onChange={e=>onChange(+e.target.value)}
        style={{width:"100%",accentColor:ac,cursor:"pointer"}}
      />
      <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
        <span style={{fontFamily:C.fBody,fontSize:12,color:C.dim}}>Front-heavy</span>
        <span style={{fontFamily:C.fBody,fontSize:12,color:C.dim}}>Rear-heavy</span>
      </div>
    </div>
  );
}

// ─── SCREENS ──────────────────────────────────────────────────────────────────

function UnitsScreen({onDone}) {
  const [w,setW]   = useState("lbs");
  const [sp,setSp] = useState("lbs/in");
  const [p,setP]   = useState("psi");
  const [spd,setSpd]=useState("mph");
  const [dev,setDev]=useState("controller");

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,maxWidth:480,margin:"0 auto",fontFamily:C.fBody,padding:"0 0 40px"}}>
      <style>{FONTS + THEME_STYLE + `*{box-sizing:border-box}`}</style>
      <div style={{padding:"calc(env(safe-area-inset-top, 0px) + 32px) 20px 20px"}}>
        <div style={{fontFamily:C.fCond,fontSize:36,fontWeight:700,color:C.green,letterSpacing:"0.12em",marginBottom:8}}>TuneLab</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:32}}>Let's set up your units and input device</div>

        <div style={{...S.card,padding:"16px 16px",marginBottom:12}}>
          <Seg label="Weight" opts={["lbs","kg"]} val={w} set={setW}/>
          <Seg label="Springs" opts={["lbs/in","n/mm","kgf/mm"]} val={sp} set={setSp}/>
          <Seg label="Tire pressure" opts={["psi","bar"]} val={p} set={setP}/>
          <Seg label="Speed" opts={["mph","km/h"]} val={spd} set={setSpd}/>
        </div>

        <div style={{...S.card,padding:"16px 16px",marginBottom:24}}>
          <span style={S.label}>Input device</span>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {INPUT_DEVICES.map(d => (
              <button key={d.id} onClick={()=>setDev(d.id)} style={{...S.btn,justifyContent:"flex-start",padding:"10px 12px",borderRadius:9,border:`1px solid ${dev===d.id?C.accent:C.border}`,background:dev===d.id?C.accentLo:C.surface,color:dev===d.id?C.accent:C.muted,fontFamily:C.fBody,fontSize:13,fontWeight:dev===d.id?600:400}}>
                {d.label}
                {dev===d.id && <span style={{marginLeft:"auto",fontSize:11,color:C.accent}}>✓ active</span>}
              </button>
            ))}
          </div>
        </div>

        <button onClick={()=>onDone({weight:w,springs:sp,pressure:p,speed:spd},dev)}
          style={{...S.btn,width:"100%",padding:"15px",background:C.accent,borderRadius:12,color:"#fff",fontFamily:C.fBody,fontSize:14,fontWeight:600,letterSpacing:"0.04em"}}>
          Let's go →
        </button>
      </div>
    </div>
  );
}

function AIScreen({onClose}) {
  const [provider,  setProvider]  = useState(()=>LS.get(PROVIDER_KEY,"none"));
  const [keys,      setKeys]      = useState(()=>LS.get(KEYS_KEY,{}));
  const [show,      setShow]      = useState({});
  const [saved,     setSaved]     = useState(false);

  const [validating,setValidating]= useState(false);
  const [valResult, setValResult] = useState({});  // {[providerId]: {ok, msg}}

  const prov = AI_PROVIDERS.find(p=>p.id===provider)||AI_PROVIDERS[0];

  const save = () => { LS.set(PROVIDER_KEY,provider); LS.set(KEYS_KEY,keys); setSaved(true); setTimeout(()=>setSaved(false),2000); };

  const testKey = async() => {
    if(!keys[prov.id]) return;
    setValidating(true);
    const result = await validateKey(prov.id, keys[prov.id]);
    setValResult(r=>({...r,[prov.id]:result}));
    if(result.ok){ LS.set(PROVIDER_KEY,provider); LS.set(KEYS_KEY,keys); setSaved(true); setTimeout(()=>setSaved(false),2000); }
    setValidating(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:400,maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column",fontFamily:C.fBody,overflowY:"auto"}}>
      <style>{FONTS+THEME_STYLE}</style>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"calc(env(safe-area-inset-top, 0px) + 14px) 16px 14px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onClose} style={{...S.btn,background:"transparent",color:C.text,fontSize:22}}>←</button>
        <span style={{fontSize:13,fontWeight:600,color:C.text,letterSpacing:"0.06em"}}>AI PROVIDER</span>
        <button onClick={save} style={{...S.btn,marginLeft:"auto",background:saved?C.green+"22":C.accentLo,border:`1px solid ${saved?C.green:C.accent}55`,borderRadius:8,padding:"6px 14px",fontSize:11,color:saved?C.green:C.accent,fontWeight:600}}>
          {saved?"✓ Saved":"Save"}
        </button>
      </div>
      <div style={{padding:"16px 16px 40px"}}>
        <div style={{background:"#39ff8a14",border:"1px solid #39ff8a33",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:600,color:"#39ff8a",marginBottom:4}}>Your key. Your quota. Always free.</div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>Each provider gives you a <strong style={{color:C.text}}>free personal API key</strong>. TuneLab uses YOUR key — your quota is separate from everyone else. Gemini gives 1,500 free uses/day. Takes 2 minutes.</div>
        </div>
        <p style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:8}}>
          TuneLab works fully <strong style={{color:C.text}}>offline</strong> without AI. Connect a provider to unlock expert notes and smarter diagnoses.
        </p>
        <div style={{background:C.gold+"14",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"9px 11px",marginBottom:12,fontFamily:C.fBody,fontSize:11,color:C.gold,lineHeight:1.6}}>
          💡 <strong>Setup tip:</strong> After creating your Gemini key, check that your Google project has no <strong>$0.00 spending cap</strong> — this silently blocks all requests. Remove it or set it to $1–2. At ~$0.0001 per tune you won't be charged noticeably.
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
          {AI_PROVIDERS.map(p=>(
            <button key={p.id} onClick={()=>!p.soon&&setProvider(p.id)}
              style={{...S.btn,justifyContent:"flex-start",padding:"12px 14px",borderRadius:10,border:`1px solid ${provider===p.id?p.color:C.border}`,background:provider===p.id?p.color+"18":C.card,textAlign:"left",flexDirection:"column",alignItems:"flex-start",gap:4,width:"100%",opacity:p.soon?0.45:1,cursor:p.soon?"default":"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
                <span style={{fontSize:14,color:provider===p.id?p.color:C.muted}}>{p.icon}</span>
                <span style={{fontFamily:C.fBody,fontSize:15,color:provider===p.id?p.color:C.text,fontWeight:600}}>{p.label}</span>
                {p.free&&!p.soon&&<span style={{marginLeft:4,background:C.green+"22",border:`1px solid ${C.green}44`,borderRadius:8,padding:"1px 6px",fontSize:9,color:C.green}}>FREE</span>}
                {p.soon&&<span style={{marginLeft:4,background:C.gold+"22",border:`1px solid ${C.gold}44`,borderRadius:8,padding:"1px 6px",fontSize:9,color:C.gold}}>COMING SOON</span>}
                {provider===p.id&&<span style={{marginLeft:"auto",fontSize:9,color:p.color}}>ACTIVE ✓</span>}
              </div>
              <span style={{fontFamily:C.fBody,fontSize:11,color:C.muted,paddingLeft:22}}>
                {p.id==="none"?"Full tune via formula engine — no internet needed.":p.id==="gemini"?"Free tier: 1,500/day — no credit card needed.":"Coming soon — join Discord to get notified."}
              </span>
            </button>
          ))}
        </div>
        {prov.hint && (
          <div style={{...S.card,padding:"14px 14px",marginBottom:12}}>
            {/* Privacy warning */}
            <div style={{background:"#ff444418",border:"1px solid #ff444444",borderRadius:8,padding:"9px 11px",marginBottom:10,display:"flex",gap:8,alignItems:"flex-start"}}>
              <span style={{fontSize:14,flexShrink:0}}>🔐</span>
              <div style={{fontFamily:C.fBody,fontSize:11,color:"#ffaaaa",lineHeight:1.6}}>
                <strong>Keep this key private.</strong> Never share it or screenshot it. Anyone with your key can use your quota. TuneLab stores it only on this device.
              </div>
            </div>
            {/* How to get the key */}
            <div style={{background:prov.color+"12",border:`1px solid ${prov.color}33`,borderRadius:8,padding:"10px 11px",marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:prov.color,marginBottom:4}}>
                How to get your free key
              </div>
              {prov.id==="gemini"&&<div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
                1. Tap <strong style={{color:C.text}}>Get free key ↗</strong> below<br/>
                2. Sign in with Google<br/>
                3. Tap <strong style={{color:C.text}}>"Create API key"</strong><br/>
                4. Copy and paste it here<br/>
                <span style={{color:C.green}}>Free tier: 1,500 requests/day · No credit card needed</span>
              </div>}
              {prov.id==="grok"&&<div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
                1. Tap <strong style={{color:C.text}}>Get free key ↗</strong> below<br/>
                2. Sign in with your X account<br/>
                3. Create an API key in the console<br/>
                <span style={{color:C.green}}>Free tier available · No credit card needed</span>
              </div>}
              {prov.id==="openai"&&<div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
                1. Tap <strong style={{color:C.text}}>Get key ↗</strong> below<br/>
                2. Create an OpenAI account<br/>
                3. Add a small credit ($5 lasts months)<br/>
                4. Create an API key and paste here<br/>
                <span style={{color:C.gold}}>~$0.0002 per tune · Requires credit card</span>
              </div>}
              {prov.id==="claude"&&<div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
                1. Tap <strong style={{color:C.text}}>Get key ↗</strong> below<br/>
                2. Create an Anthropic account<br/>
                3. Add a small credit ($5 lasts months)<br/>
                4. Create an API key and paste here<br/>
                <span style={{color:C.gold}}>~$0.0003 per tune · Requires credit card</span>
              </div>}
              {prov.docs&&<a href={prov.docs} target="_blank" rel="noreferrer"
                style={{display:"inline-block",marginTop:8,padding:"6px 12px",background:prov.color+"22",border:`1px solid ${prov.color}55`,borderRadius:7,fontSize:11,fontWeight:600,color:prov.color,textDecoration:"none"}}>
                Get {prov.id==="gemini"?"free ":""}key ↗
              </a>}
            </div>

            <span style={S.label}>Paste your API key</span>
            <div style={{position:"relative",marginBottom:8}}>
              <input type={show[prov.id]?"text":"password"} value={keys[prov.id]||""} onChange={e=>{setKeys(k=>({...k,[prov.id]:e.target.value}));setValResult(r=>({...r,[prov.id]:null}));}} placeholder={prov.hint}
                style={{width:"100%",...S.mono,background:C.surface,border:`1px solid ${valResult[prov.id]?(valResult[prov.id].ok?C.green:C.red):C.border}`,borderRadius:8,padding:"9px 36px 9px 11px",color:C.text,fontSize:12,outline:"none"}}
              />
              <button onClick={()=>setShow(s=>({...s,[prov.id]:!s[prov.id]}))} style={{...S.btn,position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"transparent",fontSize:14,color:C.muted}}>
                {show[prov.id]?"🙈":"👁"}
              </button>
            </div>

            {valResult[prov.id]&&(
              <div style={{fontSize:11,color:valResult[prov.id].ok?C.green:C.red,marginBottom:8,lineHeight:1.4}}>
                {valResult[prov.id].ok?"✓":"⚠"} {valResult[prov.id].msg}
              </div>
            )}

            <button onClick={testKey} disabled={!keys[prov.id]||validating}
              style={{...S.btn,width:"100%",padding:"11px",background:keys[prov.id]?prov.color+"22":C.surface,border:`1px solid ${keys[prov.id]?prov.color+"55":C.border}`,borderRadius:9,color:keys[prov.id]?prov.color:C.muted,fontFamily:C.fBody,fontSize:12,fontWeight:600}}>
              {validating?"Testing key…":"Test & save key"}
            </button>

          </div>
        )}
      </div>
    </div>
  );
}

function SaveDrawer({appState, tunePages, onLoad, onClose}) {
  const [saves,  setSaves]  = useState(()=>LS.get("tl_v1_saves",[]));
  const [name,   setName]   = useState(`${appState.make} ${appState.model} — ${appState.tuneId}`);
  const [toast,  setToast]  = useState(null);
  const color = TUNE_MODES.find(t=>t.id===appState.tuneId)?.color||C.accent;

  const doSave = () => {
    if(!Object.keys(tunePages).length){setToast("Generate a tune first!");return;}
    const e={id:Date.now(),name,date:new Date().toLocaleDateString(),appState:{...appState},tunePages:{...tunePages}};
    const u=[e,...saves.slice(0,19)];LS.set("tl_v1_saves",u);setSaves(u);setToast("Saved!");
  };
  const doDelete = id => { const u=saves.filter(s=>s.id!==id);LS.set("tl_v1_saves",u);setSaves(u); };
  const doCopy = e => { navigator.clipboard?.writeText(formatTuneText(e.appState,e.tunePages)).then(()=>setToast("Copied!")); };
  const doShare = e => {
    const t=formatTuneText(e.appState,e.tunePages);
    if(navigator.share){navigator.share({title:"TuneLab Tune",text:t}).catch(()=>{});}
    else{navigator.clipboard?.writeText(t).then(()=>setToast("Copied!"));}
  };

  return (
    <div style={{position:"fixed",inset:0,background:"#000a",zIndex:300,display:"flex",flexDirection:"column",justifyContent:"flex-end",maxWidth:480,margin:"0 auto"}}>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
      <div style={{background:C.surface,borderRadius:"16px 16px 0 0",border:`1px solid ${C.border}`,maxHeight:"85vh",display:"flex",flexDirection:"column",fontFamily:C.fBody}}>
        <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <span style={{fontSize:12,fontWeight:600,color:C.text,letterSpacing:"0.08em"}}>SAVE / LOAD</span>
          <button onClick={onClose} style={{...S.btn,background:"transparent",fontSize:18,color:C.muted}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px 24px"}}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tune name…"
            style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontFamily:C.fBody,fontSize:13,outline:"none",marginBottom:8}}
          />
          <button onClick={doSave} style={{...S.btn,width:"100%",padding:"11px",background:color+"22",border:`1px solid ${color}55`,borderRadius:9,color,fontFamily:C.fBody,fontSize:12,fontWeight:600,marginBottom:16}}>
            💾 Save current tune
          </button>
          {saves.length===0 && <div style={{textAlign:"center",padding:"20px",color:C.dim,fontSize:13}}>No saved tunes yet</div>}
          {saves.map(sv=>{
            const sc=TUNE_MODES.find(t=>t.id===sv.appState?.tuneId)?.color||C.accent;
            return (
              <div key={sv.id} style={{...S.card,padding:"11px 13px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:C.text}}>{sv.name}</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:2}}>{sv.appState?.carClass} {sv.appState?.pi}PI · {sv.date}</div>
                  </div>
                  <button onClick={()=>doDelete(sv.id)} style={{...S.btn,background:"transparent",color:C.dim,fontSize:14}}>✕</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
                  {[{l:"Load",fn:()=>{onLoad(sv);onClose();},c:sc},{l:"Share",fn:()=>doShare(sv),c:C.green},{l:"Copy",fn:()=>doCopy(sv),c:C.muted}].map(b=>(
                    <button key={b.l} onClick={b.fn} style={{...S.btn,padding:"7px",background:b.c+"18",border:`1px solid ${b.c}33`,borderRadius:7,color:b.c,fontFamily:C.fBody,fontSize:10,fontWeight:600}}>
                      {b.l}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Wizard({ctx, onClose}) {
  const [step,  setStep]   = useState("problem");
  const [selP,  setSP]     = useState(null);
  const [fix,   setFix]    = useState(null);
  const [loading,setLoading]=useState(false);

  const provider = LS.get(PROVIDER_KEY,"none");
  const keys     = LS.get(KEYS_KEY,{});
  const hasAI    = provider!=="none" && keys[provider];
  const fixColor = hasAI?C.accent:C.gold;

  const getFix = async(problem,sub) => {
    setStep("fixing"); setLoading(true);
    try {
      if(hasAI){
        const sys=`You are a Forza Horizon expert tuner. Return ONLY raw JSON, no markdown.`;
        const usr=`Issue: "${problem.label}" — "${sub.label}"\nCar: ${ctx.make} ${ctx.model} | ${ctx.driveType} | ${ctx.tuneId}\nInput: ${ctx.inputDevice}\nFH6 traction circle physics.\nReturn: {"diagnosis":"1-2 sentences","fixes":[{"setting":"Name","change":"What","why":"Why"},{"setting":"Name","change":"What","why":"Why"},{"setting":"Name","change":"What","why":"Why"}],"tip":"One driving tip"}`;
        const raw=await callAI(provider,keys[provider],sys,usr);
        const m=raw.match(/\{[\s\S]*\}/);
        if(!m)throw new Error("parse");
        setFix(JSON.parse(m[0]));
      } else {
        setFix(OFFLINE_FIXES[problem.id]||OFFLINE_FIXES.understeer);
      }
      setStep("result");
    } catch { setFix(OFFLINE_FIXES[problem.id]||OFFLINE_FIXES.understeer); setStep("result"); }
    setLoading(false);
  };

  const goBack = () => {
    if(step==="sub"){setStep("problem");setSP(null);}
    if(step==="result"||step==="fixing"){setStep("sub");setFix(null);}
  };

  return (
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:200,maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column",fontFamily:C.fBody}}>
      <style>{FONTS+THEME_STYLE}</style>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"calc(env(safe-area-inset-top, 0px) + 14px) 16px 14px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={step==="problem"?onClose:goBack} style={{...S.btn,background:"transparent",color:C.text,fontSize:22}}>←</button>
        <span style={{fontSize:13,fontWeight:600,color:C.text,letterSpacing:"0.06em"}}>TUNING WIZARD</span>
        <span style={{marginLeft:"auto",fontSize:10,color:hasAI?C.green:C.gold}}>{hasAI?"✦ AI active":"⚙ Offline"}</span>
        <button onClick={onClose} style={{...S.btn,background:"transparent",color:C.muted,fontSize:18}}>⌂</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 40px"}}>
        {step==="problem"&&(
          <>
            <p style={{fontSize:13,color:C.muted,lineHeight:1.6,marginBottom:16}}>What's the car doing wrong?</p>
            <div style={{...S.card,overflow:"hidden"}}>
              {PROBLEMS.map((p,i)=>(
                <div key={p.id} onClick={()=>{setSP(p);setStep("sub");}} style={{padding:"13px 14px",borderBottom:i<PROBLEMS.length-1?`1px solid ${C.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
                  <div><div style={{fontSize:16,color:C.text,fontWeight:500}}>{p.icon} {p.label}</div><div style={{fontSize:13,color:C.muted,marginTop:2}}>{p.desc}</div></div>
                  <span style={{color:C.dim,fontSize:18}}>›</span>
                </div>
              ))}
            </div>
          </>
        )}
        {step==="sub"&&selP&&(
          <>
            <p style={{fontSize:15,color:C.text,fontWeight:500,marginBottom:4}}>{selP.icon} {selP.label}</p>
            <p style={{fontSize:13,color:C.muted,marginBottom:16}}>When does it happen?</p>
            <div style={{...S.card,overflow:"hidden"}}>
              {selP.subs.map((s,i)=>(
                <div key={s.id} onClick={()=>getFix(selP,s)} style={{padding:"13px 14px",borderBottom:i<selP.subs.length-1?`1px solid ${C.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
                  <span style={{fontSize:13,color:C.text}}>{s.label}</span>
                  <span style={{color:C.dim,fontSize:18}}>›</span>
                </div>
              ))}
            </div>
          </>
        )}
        {step==="fixing"&&(
          <div style={{textAlign:"center",paddingTop:60}}>
            <div style={{fontSize:13,color:fixColor,letterSpacing:"0.12em",marginBottom:16}}>{hasAI?"Consulting AI…":"Checking knowledge base…"}</div>
            <div style={{display:"flex",justifyContent:"center",gap:5}}>
              {[0,1,2,3,4].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:fixColor,animation:`pulse 1.2s ${i*0.18}s infinite`}}/>)}
            </div>
          </div>
        )}
        {step==="result"&&fix&&(
          <>
            {!hasAI&&<div style={{background:C.gold+"14",border:`1px solid ${C.gold}33`,borderRadius:8,padding:"8px 11px",marginBottom:12,fontSize:11,color:C.gold}}>⚙ Offline analysis — connect AI for car-specific diagnosis</div>}
            <div style={{fontSize:10,color:fixColor,letterSpacing:"0.1em",marginBottom:6}}>DIAGNOSIS</div>
            <div style={{...S.card,padding:"12px 13px",marginBottom:12,fontSize:13,color:C.text,lineHeight:1.65}}>{fix.diagnosis}</div>
            <div style={{fontSize:10,color:fixColor,letterSpacing:"0.1em",marginBottom:6}}>FIXES</div>
            <div style={{...S.card,overflow:"hidden",marginBottom:12}}>
              {(fix.fixes||[]).map((f,i)=>(
                <div key={i} style={{padding:"11px 13px",borderBottom:i<fix.fixes.length-1?`1px solid ${C.border}`:"none",background:i%2===0?C.card:C.surface}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:15,color:C.text,fontWeight:500}}>{f.setting}</span>
                    <span style={{...S.mono,fontSize:11,color:fixColor}}>{f.change}</span>
                  </div>
                  <div style={{fontSize:13,color:C.muted,lineHeight:1.5}}>{f.why}</div>
                </div>
              ))}
            </div>
            {fix.tip&&<div style={{background:fixColor+"0d",border:`1px solid ${fixColor}33`,borderRadius:10,padding:"10px 13px",marginBottom:14}}>
              <div style={{fontSize:10,color:fixColor,letterSpacing:"0.1em",marginBottom:4}}>DRIVING TIP</div>
              <div style={{fontSize:13,color:C.text,lineHeight:1.6}}>💡 {fix.tip}</div>
            </div>}
            <button onClick={()=>{setStep("problem");setSP(null);setFix(null);}} style={{...S.btn,width:"100%",padding:"12px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontFamily:C.fBody,fontSize:12}}>
              ← Diagnose another issue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── OUTPUT SCREEN ────────────────────────────────────────────────────────────

function EnhancingBar({color, icon, label}) {
  const [secs, setSecs] = useState(0);
  useEffect(()=>{
    const t = setInterval(()=>setSecs(s=>s+1), 1000);
    return ()=>clearInterval(t);
  },[]);
  return (
    <div style={{background:color+"18",border:`1px solid ${color}33`,borderRadius:9,padding:"9px 12px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
      <span style={{fontSize:11,color,animation:"pulse 1.5s infinite"}}>{icon} Enhancing with {label}…</span>
      <span style={{fontFamily:C.fMono,fontSize:10,color:color+"99"}}>{secs}s</span>
    </div>
  );
}

class OutputErrorBoundary extends Component {
  constructor(props) { super(props); this.state = {error:null}; }
  static getDerivedStateFromError(e) { return {error:e.message||"Unknown error"}; }
  componentDidCatch(e, info) { console.error("TuneLab OutputScreen error:", e.message, info.componentStack?.slice(0,200)); }
  render() {
    if (this.state.error) return (
      <div style={{minHeight:"100vh",background:"#0a0c0f",color:"#eaf2f7",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,gap:16}}>
        <div style={{fontSize:32}}>⚠</div>
        <div style={{fontFamily:"monospace",fontSize:13,color:"#ff4d4d",textAlign:"center",lineHeight:1.6}}>{this.state.error}</div>
        <button onClick={this.props.onBack} style={{marginTop:8,padding:"10px 24px",background:"transparent",border:"1px solid #00ff85",borderRadius:6,color:"#00ff85",fontFamily:"monospace",fontSize:12,cursor:"pointer"}}>← Back</button>
      </div>
    );
    return this.props.children;
  }
}

function OutputScreen({appState, tunePages, setTunePages, onBack, onNewTune}) {
  const [tunePage,    setTunePage]    = useState("Tires");
  const [toast,       setToast]       = useState(null);
  const [overlay,     setOverlay]     = useState(null);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  // FH6 rewards stable/planted setups — default slightly toward stable per Kireth feedback
  const [feelBalance,  setFeelBalance]  = useState(40);
  const [feelAggress,  setFeelAggress]  = useState(45);
  const [showPaste,    setShowPaste]    = useState(false);
  const [pasteText,    setPasteText]    = useState("");
  const [pasteError,   setPasteError]   = useState("");

  const color       = TUNE_MODES.find(t=>t.id===appState.tuneId)?.color||C.accent;
  const accentColor = color;
  const BRIGHT      = ["Touge","Drag"];
  const onAccent    = BRIGHT.includes(appState.tuneId) ? "#0a0c0f" : "#ffffff";
  const [provId, setProvId] = useState(()=>LS.get(PROVIDER_KEY,"none"));
  const [aiKeys, setAiKeys] = useState(()=>LS.get(KEYS_KEY,{}));
  const prov   = AI_PROVIDERS.find(p=>p.id===provId)||AI_PROVIDERS[0];
  const hasAI  = prov.id!=="none" && !!aiKeys[prov.id];

  // Re-read AI settings whenever overlay closes (so key saved in AIScreen is picked up)
  useEffect(()=>{
    if(!overlay){
      setProvId(LS.get(PROVIDER_KEY,"none"));
      setAiKeys(LS.get(KEYS_KEY,{}));
    }
  },[overlay]);

  // Recalculate tune when feel sliders change — preserve AI notes/tips/summary
  const recalc = useCallback((bal, agg) => {
    const newTune = calcTune({...appState, feelBalance:bal, feelAggression:agg});
    setTunePages(prev => {
      const merged = { _summary: prev._summary || newTune._summary };
      Object.keys(newTune).forEach(pg => {
        if(pg === '_summary') return;
        merged[pg] = {
          ...newTune[pg],
          // Preserve AI notes on each value row
          values: (newTune[pg]?.values||[]).map((row, i) => ({
            ...row,
            note: prev[pg]?.values?.[i]?.note || row.note,
          })),
          // Preserve AI tip if present
          tip: prev[pg]?.tip || newTune[pg]?.tip,
        };
      });
      return merged;
    });
  }, [appState]);

  useEffect(()=>{recalc(feelBalance,feelAggress);},[feelBalance,feelAggress]);

  const handleShare = () => {
    const txt = formatTuneText(appState, tunePages);
    if(navigator.share){navigator.share({title:`TuneLab — ${appState.make} ${appState.model}`,text:txt}).catch(()=>{});}
    else{navigator.clipboard?.writeText(txt).then(()=>setToast("Copied!"));}
  };

  const applyPastedResponse = () => {
    setPasteError("");
    try {
      const raw = pasteText.trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if(!match) throw new Error("No JSON found — make sure you copied the full AI response");
      const enhanced = JSON.parse(match[0]);
      const merged = {};
      TUNE_PAGES.forEach(pg=>{
        if(!tunePages[pg]) return;
        const ai = enhanced[pg];
        if(!ai) return;
        merged[pg] = {
          values: (tunePages[pg]?.values||[]).map((r,i)=>({...r, note: ai?.values?.[i]?.note||r.note})),
          tip: ai?.tip || tunePages[pg]?.tip,
        };
      });
      if(Object.keys(merged).length===0) throw new Error("Couldn't match any tune sections — try again");
      setTunePages(prev=>({...prev,...merged}));
      setToast("✦ AI notes applied from paste!");
      setShowPaste(false);
      setPasteText("");
    } catch(e) {
      setPasteError(e.message);
    }
  };

  const handleManualCopy = () => {
    const {sys,usr} = buildEnhancePrompt(appState,tunePages);
    const fullPrompt = `${sys}\n\n${usr}`;
    if(navigator.clipboard){
      navigator.clipboard.writeText(fullPrompt).then(()=>{
        setToast("📋 Prompt copied! Paste in Gemini, then use Paste Response ←");
        setTimeout(()=>window.open("https://gemini.google.com/","_blank"),800);
      });
    }
  };

  const handleAIEnhance = useCallback(async() => {
    // Physical lock — prevents double-tap and re-render re-triggers
    if(aiEnhancing) return;
    if(!hasAI){setOverlay("ai");return;}
    setAiEnhancing(true);
    try {
      const {sys,usr} = buildEnhancePrompt(appState,tunePages);
      const raw = await callAI(prov.id,aiKeys[prov.id],sys,usr);
      console.log("TuneLab AI raw response:", raw.slice(0,500));
      // Extract JSON — handle markdown fences, leading text, truncation
      // Strategy: find first { and last } in the raw response
      const firstBrace = raw.indexOf('{');
      const lastBrace  = raw.lastIndexOf('}');
      const extracted  = firstBrace !== -1 && lastBrace > firstBrace
        ? raw.slice(firstBrace, lastBrace + 1)
        : raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
      console.log("TuneLab AI cleaned:", extracted.slice(0,300));
      const match = extracted.match(/\{[\s\S]*\}/);
      if(match){
        let enhanced;
        try { enhanced = JSON.parse(match[0]); }
        catch(pe) {
          // Try to repair truncated JSON
          let txt = match[0];
          const nOpen  = (txt.match(/[{]/g)||[]).length;
          const nClose = (txt.match(/[}]/g)||[]).length;
          for(let i=0;i<nOpen-nClose;i++) txt+="}";
          enhanced = JSON.parse(txt);
        }
        console.log("TuneLab AI parsed keys:", Object.keys(enhanced));
        const merged = mergeEnhancement(tunePages, enhanced);
        setTunePages(merged);
        // Increment usage counter
        const usage = LS.get(USAGE_KEY, {total:0, byProvider:{}});
        usage.total = (usage.total||0) + 1;
        usage.byProvider[prov.id] = (usage.byProvider[prov.id]||0) + 1;
        LS.set(USAGE_KEY, usage);
        setToast(`✦ Enhanced by ${prov.label}`);
        console.log('AI enhance success');
      } else {
        console.log("TuneLab AI: no JSON found in response. Full raw:", raw.slice(0,800));
        setToast("AI responded but couldn't parse — try again");
      }
    } catch(e) {
      console.error("AI enhance error:", e);
      if(e.message==="RATE_LIMIT_EXHAUSTED"){
        setToast("Daily quota hit — use Manual Copy below ↓");
      } else {
        setToast(`AI error: ${e.message||"unknown"}`);
      }
    }
    setAiEnhancing(false);
  }, [aiEnhancing, hasAI, prov, aiKeys, appState, tunePages]);

  // Auto-switch to first valid tab if current is null (D mode skips Gearing)
  useEffect(()=>{
    if(!tunePages[tunePage]){
      const first = TUNE_PAGES.find(p=>tunePages[p]);
      if(first) setTunePage(first);
    }
  },[tunePages, tunePage]);

  const data = tunePages[tunePage] || tunePages[TUNE_PAGES.find(p=>tunePages[p])] || {values:[],tip:""};

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,maxWidth:480,margin:"0 auto",fontFamily:C.fBody,display:"flex",flexDirection:"column"}}>
      <style>{FONTS+THEME_STYLE}</style>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
      {overlay==="save"&&<SaveDrawer appState={appState} tunePages={tunePages} onLoad={()=>{}} onClose={()=>setOverlay(null)}/>}
      {overlay==="wizard"&&<Wizard ctx={{...appState}} onClose={()=>setOverlay(null)}/>}
      {overlay==="ai"&&<AIScreen onClose={()=>setOverlay(null)}/>}
      {overlay==="about"&&<AboutScreen onClose={()=>setOverlay(null)}/>}
      {overlay==="settings"&&<SettingsScreen units={{}} device="controller" onSave={()=>setOverlay(null)} onClose={()=>setOverlay(null)}/>}

      {/* Paste-back modal */}
      {showPaste&&(
        <div style={{position:"fixed",inset:0,background:"#000c",zIndex:500,display:"flex",alignItems:"flex-end",maxWidth:480,margin:"0 auto"}}>
          <div style={{width:"100%",background:C.surface,borderRadius:"16px 16px 0 0",border:`1px solid ${C.border}`,padding:"16px 16px 32px",fontFamily:C.fBody}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <span style={{fontSize:13,fontWeight:600,color:C.text,letterSpacing:"0.06em"}}>PASTE AI RESPONSE</span>
              <button onClick={()=>{setShowPaste(false);setPasteText("");setPasteError("");}} style={{...S.btn,background:"transparent",fontSize:18,color:C.muted}}>✕</button>
            </div>
            <div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:10}}>
              1. Tap <strong style={{color:C.text}}>📋 Copy prompt</strong> → opens Gemini in browser<br/>
              2. Paste the prompt → copy Gemini's full response<br/>
              3. Come back here → paste the response below
            </div>
            <textarea
              value={pasteText}
              onChange={e=>setPasteText(e.target.value)}
              placeholder='Paste the full JSON response from Gemini here…'
              rows={6}
              style={{width:"100%",background:C.card,border:`1px solid ${pasteError?C.red:C.border}`,borderRadius:9,padding:"10px 11px",color:C.text,fontFamily:C.fMono,fontSize:11,resize:"none",outline:"none",marginBottom:pasteError?6:10}}
            />
            {pasteError&&<div style={{fontSize:11,color:C.red,marginBottom:8,lineHeight:1.4}}>⚠ {pasteError}</div>}
            <button onClick={applyPastedResponse} disabled={!pasteText.trim()}
              style={{...S.btn,width:"100%",padding:"13px",background:pasteText.trim()?C.accent:C.card,border:`1px solid ${pasteText.trim()?C.accent:C.border}`,borderRadius:10,color:pasteText.trim()?"#fff":C.muted,fontFamily:C.fBody,fontSize:13,fontWeight:600}}>
              Apply AI notes →
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:20,background:C.bg,borderBottom:`1px solid ${C.border}`,padding:"calc(env(safe-area-inset-top, 0px) + 10px) 14px 8px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <button onClick={onBack} style={{...S.btn,background:"transparent",color:accentColor,fontFamily:C.fCond,fontSize:13,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",gap:4}}>
            ← New Config
          </button>
          <div style={{display:"flex",gap:5}}>
            <button onClick={()=>setOverlay("ai")} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:12}}>✦</button>
            <button onClick={()=>setOverlay("about")} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:14}}>ℹ</button>
            <button onClick={handleShare} style={{...S.btn,padding:"6px 11px",background:C.green+"22",border:`1px solid ${C.green}44`,borderRadius:8,color:C.green,fontFamily:C.fBody,fontSize:11,fontWeight:600,gap:4}}>
              ↑ Share
            </button>
            <button onClick={()=>setOverlay("save")} style={{...S.btn,padding:"6px 11px",background:C.accentLo,border:`1px solid ${C.accent}44`,borderRadius:8,color:C.accent,fontFamily:C.fBody,fontSize:11,fontWeight:600,gap:4}}>
              💾 Save
            </button>
          </div>
        </div>
        <div style={{fontSize:14,color:C.muted}}>
          <span style={{color:C.text,fontWeight:500}}>{appState.make} {appState.model}</span>
          {" "}·{" "}{appState.carClass} {appState.pi}PI · {appState.driveType} ·{" "}
          <span style={{color}}>{appState.tuneId}</span>
        </div>
      </div>

      {/* Tab strip */}
      <div style={{display:"flex",overflowX:"auto",padding:"0 16px",scrollbarWidth:"none",flexShrink:0,background:C.surface,borderBottom:`1px solid ${C.border}`}}>
        {TUNE_PAGES.map(p=>{
          const ready=!!tunePages[p];
          const active=tunePage===p;
          return (
            <button key={p} onClick={()=>setTunePage(p)} disabled={!ready}
              style={{...S.btn,flexShrink:0,padding:"10px 14px",
              border:"none",borderBottom:`2px solid ${active?accentColor:"transparent"}`,
              background:"transparent",
              color:active?accentColor:ready?C.muted:C.dim,
              fontFamily:C.fCond,fontSize:10,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",
              opacity:ready?1:0.3,whiteSpace:"nowrap",cursor:ready?"pointer":"default"}}>
              {p}
            </button>
          );
        })}
      </div>

      {/* Tune card */}
      <div style={{flex:1,overflowY:"auto",padding:"10px 14px 120px"}}>
        {aiEnhancing&&(
          <EnhancingBar color={prov.color} icon={prov.icon} label={prov.label}/>
        )}
        {!aiEnhancing&&tunePages._summary&&(
          <div style={{background:"rgba(0,255,133,0.05)",border:"1px solid rgba(0,255,133,0.2)",
            borderLeft:"3px solid rgba(0,255,133,0.6)",borderRadius:"0 8px 8px 0",
            padding:"12px 14px",marginBottom:10}}>
            <div style={{fontFamily:C.fMono,fontSize:8,color:C.green,letterSpacing:"0.25em",marginBottom:8,
              display:"flex",alignItems:"center",gap:8}}>
              ✦ ENGINEER BRIEF · {prov.label.toUpperCase()}
              <div style={{flex:1,height:1,background:"rgba(0,255,133,0.15)"}}/>
            </div>
            <div style={{fontFamily:C.fBody,fontSize:12,fontWeight:300,color:C.ice2,lineHeight:1.7}}>
              {tunePages._summary}
            </div>
          </div>
        )}

        {data ? (
          <>
            <div style={{...S.card,overflow:"hidden",marginBottom:8}}>
              <div style={{padding:"8px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8,background:C.surface}}>
                <div style={{width:4,height:4,background:accentColor,flexShrink:0}}/>
                <span style={{fontFamily:C.fMono,fontSize:9,color:accentColor,letterSpacing:"0.25em",textTransform:"uppercase"}}>{tunePage}</span>
              </div>
              {(data.values||[]).map((row,i)=>(
                <div key={i} style={{padding:"11px 14px",borderBottom:i<(data.values||[]).length-1?`1px solid ${C.border}`:"none",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:C.fBody,fontSize:13,color:C.text,fontWeight:400}}>{row.key}</div>
                    {row.note&&<div style={{fontFamily:C.fBody,fontSize:12,fontWeight:300,color:C.muted,marginTop:4,lineHeight:1.5}}>{row.note}</div>}
                  </div>
                  <div style={{fontFamily:C.fMono,fontSize:14,color:C.green,fontWeight:500,whiteSpace:"nowrap",flexShrink:0}}>{row.value}</div>
                </div>
              ))}
              {data.tip&&(
                <div style={{padding:"9px 14px",background:"rgba(0,255,133,0.04)",borderTop:`1px solid ${C.border}`,borderLeft:"2px solid rgba(0,255,133,0.3)"}}>
                  <span style={{fontFamily:C.fBody,fontSize:12,fontWeight:300,color:C.ice2,lineHeight:1.6}}>{data.tip}</span>
                </div>
              )}
            </div>

            {/* Feel adjuster */}
            <div style={{...S.card,padding:"12px 13px",marginBottom:10,minHeight:148}}>
              <div style={{fontFamily:C.fMono,fontSize:9,color:accentColor,letterSpacing:"0.25em",textTransform:"uppercase",marginBottom:10}}>Feel adjuster</div>
              <Slider value={feelBalance} onChange={v=>{setFeelBalance(v);recalc(v,feelAggress);setTunePage("Suspension");}} leftLabel="Stable (recommended)" rightLabel="Tail-happy" color={color} labelColor={C.text}/>
              <Slider value={feelAggress} onChange={v=>{setFeelAggress(v);recalc(feelBalance,v);setTunePage("ARB");}} leftLabel="Planted" rightLabel="Aggressive" color={color} labelColor={C.text}/>
              <div style={{fontFamily:C.fBody,fontSize:12,fontWeight:300,color:C.ice2,marginTop:6,lineHeight:1.6}}>FH6 rewards stable, planted setups. Adjust from there to suit your style.</div>
            </div>

            {/* Action buttons */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
              <button onClick={()=>setOverlay("wizard")} style={{...S.btn,padding:"11px",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontFamily:C.fBody,fontSize:12,fontWeight:500,gap:5}}>
                🔧 Wizard
              </button>
              <button onClick={handleAIEnhance} disabled={aiEnhancing||!hasAI&&false}
                style={{...S.btn,padding:"12px",
                  background:aiEnhancing?"transparent":hasAI?`${accentColor}12`:C.card,
                  border:`1px solid ${aiEnhancing?C.border:hasAI?`${accentColor}44`:C.border}`,
                  borderRadius:6,
                  color:aiEnhancing?C.dim:hasAI?accentColor:C.muted,
                  fontFamily:C.fCond,fontSize:12,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",
                  gap:5,opacity:aiEnhancing?0.5:1,cursor:aiEnhancing?"not-allowed":"pointer"}}>
                {aiEnhancing?"Enhancing…":hasAI?"✦ Enhance":"✦ Enhance"}
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:7}}>
              <button onClick={handleManualCopy} disabled={aiEnhancing}
                style={{...S.btn,padding:"9px 6px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:aiEnhancing?C.dim:C.muted,fontFamily:C.fBody,fontSize:11,gap:3,flexDirection:"column",lineHeight:1.3,opacity:aiEnhancing?0.4:1}}>
                <span>📋 Copy prompt</span>
                <span style={{fontSize:9,color:C.dim}}>→ paste in browser</span>
              </button>
              <button onClick={()=>{setShowPaste(true);setPasteError("");}} style={{...S.btn,padding:"9px 6px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:C.dim,fontFamily:C.fBody,fontSize:11,gap:3,flexDirection:"column",lineHeight:1.3}}>
                <span>📥 Paste response</span>
                <span style={{fontSize:9,color:C.dim}}>← apply AI notes</span>
              </button>
            </div>
            <button onClick={onNewTune} style={{...S.btn,width:"100%",padding:"11px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontFamily:C.fBody,fontSize:12}}>
              ↺ New tune
            </button>
          </>
        ) : (
          <div style={{textAlign:"center",paddingTop:40,color:C.dim,fontSize:13}}>No data for this page</div>
        )}
      </div>
    </div>
  );
}


// ─── ABOUT / SETTINGS SCREEN ──────────────────────────────────────────────────
function SettingsScreen({units, device, onSave, onClose}) {
  const [w,   setW]   = useState(units?.weight  || "lbs");
  const [sp,  setSp]  = useState(units?.springs || "lbs/in");
  const [p,   setP]   = useState(units?.pressure|| "psi");
  const [spd, setSpd] = useState(units?.speed   || "mph");
  const [dev, setDev] = useState(device || "controller");

  return (
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:400,maxWidth:480,margin:"0 auto",fontFamily:C.fBody,display:"flex",flexDirection:"column",overflowY:"auto"}}>
      <style>{FONTS+THEME_STYLE}</style>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"calc(env(safe-area-inset-top,0px) + 16px) 20px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <button onClick={onClose} style={{...S.btn,background:"transparent",color:C.green,fontFamily:C.fCond,fontSize:13,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",gap:4,padding:0}}>← Back</button>
        <span style={{fontFamily:C.fMono,fontSize:10,color:C.muted,letterSpacing:"0.2em",textTransform:"uppercase"}}>Settings</span>
        <button onClick={()=>onSave({weight:w,springs:sp,pressure:p,speed:spd},dev)}
          style={{...S.btn,padding:"7px 16px",background:C.accentLo,border:`1px solid ${C.accent}44`,borderRadius:6,color:C.accent,fontFamily:C.fCond,fontSize:12,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase"}}>Save</button>
      </div>

      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
        <div style={{fontFamily:C.fMono,fontSize:9,color:C.muted,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:-8}}>Units</div>
        <div style={{...S.card,padding:"16px"}}>
          <Seg label="Weight" opts={["lbs","kg"]} val={w} set={setW} color={C.accent} onColor="#0a0c0f"/>
          <Seg label="Springs" opts={["lbs/in","n/mm","kgf/mm"]} val={sp} set={setSp} color={C.accent} onColor="#0a0c0f"/>
          <Seg label="Tire pressure" opts={["psi","bar"]} val={p} set={setP} color={C.accent} onColor="#0a0c0f"/>
          <Seg label="Speed" opts={["mph","km/h"]} val={spd} set={setSpd} color={C.accent} onColor="#0a0c0f"/>
        </div>

        <div style={{fontFamily:C.fMono,fontSize:9,color:C.muted,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:-8}}>Input Device</div>
        <div style={{...S.card,padding:"12px",display:"flex",flexDirection:"column",gap:6}}>
          {INPUT_DEVICES.map(d=>(
            <button key={d.id} onClick={()=>setDev(d.id)}
              style={{...S.btn,justifyContent:"flex-start",padding:"11px 14px",borderRadius:6,
                border:`1px solid ${dev===d.id?C.accent:C.border}`,
                background:dev===d.id?C.accentLo:C.surface,
                color:dev===d.id?C.accent:C.muted,
                fontFamily:C.fBody,fontSize:14,fontWeight:dev===d.id?600:400}}>
              {d.label}
              {dev===d.id&&<span style={{marginLeft:"auto",fontSize:11,color:C.accent}}>✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutScreen({onClose}) {
  return (
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:400,maxWidth:480,margin:"0 auto",fontFamily:C.fBody,display:"flex",flexDirection:"column",overflowY:"auto"}}>
      <style>{FONTS+THEME_STYLE}</style>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"calc(env(safe-area-inset-top,0px) + 16px) 20px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <button onClick={onClose} style={{...S.btn,background:"transparent",color:C.green,fontFamily:C.fCond,fontSize:14,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",gap:3,padding:0}}>← Back</button>
        <span style={{fontFamily:C.fMono,fontSize:11,color:C.muted,letterSpacing:"0.15em"}}>ABOUT & SETTINGS</span>
        <div style={{width:60}}/>
      </div>
      <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{...S.card,padding:"24px 20px",textAlign:"center"}}>
          <div style={{fontFamily:C.fCond,fontSize:38,fontWeight:700,color:C.green,letterSpacing:"0.12em",marginBottom:8}}>TuneLab</div>
          <div style={{fontFamily:C.fBody,fontSize:16,fontWeight:500,color:C.text,marginBottom:10}}>AI-assisted Forza Horizon 6 tuning</div>
          <div style={{fontSize:13,color:C.muted,lineHeight:1.8}}>v{VERSION} · Free forever · No ads · No paywall</div>
          <div style={{fontSize:13,color:C.muted,lineHeight:1.8,marginTop:2}}>Physics: FH5-baseline · Updated post-FH6 launch</div>
        </div>

        {[
          {icon:"☕",title:"Buy me a coffee",sub:"Ko-fi — free forever, tips appreciated",url:KOFI_URL},
          {icon:"💬",title:"Discord server",sub:"Share tunes, get help, vote on features",url:DISCORD_URL},
          {icon:"🐙",title:"GitHub",sub:"Open source — bugs, features, source code",url:GITHUB_URL},
          {icon:"🔒",title:"Privacy policy",sub:"What data we store and why",url:"https://github.com/super-android/tunelab/blob/main/privacy.md"},
        ].map(item=>(
          <a key={item.title} href={item.url} target="_blank" rel="noopener noreferrer"
            style={{...S.card,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,textDecoration:"none",cursor:"pointer"}}>
            <span style={{fontSize:22,flexShrink:0}}>{item.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:C.fBody,fontSize:15,fontWeight:500,color:C.text,marginBottom:3}}>{item.title}</div>
              <div style={{fontFamily:C.fBody,fontSize:13,color:C.muted}}>{item.sub}</div>
            </div>
            <span style={{color:C.dim,fontSize:14,flexShrink:0}}>↗</span>
          </a>
        ))}

        <div style={{...S.card,padding:"14px 16px"}}>
          <div style={{fontFamily:C.fMono,fontSize:9,color:C.muted,letterSpacing:"0.2em",marginBottom:10}}>SEND FEEDBACK</div>
          <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer"
            style={{...S.btn,width:"100%",padding:"11px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontFamily:C.fBody,fontSize:14,textDecoration:"none",gap:6}}>
            🐛 Report bug / request feature
          </a>
        </div>

        <div style={{...S.card,padding:"14px 16px",borderColor:"rgba(255,77,77,0.2)"}}>
          <div style={{fontFamily:C.fMono,fontSize:9,color:"#ff4d4d",letterSpacing:"0.2em",marginBottom:8}}>DANGER ZONE</div>
          <div style={{fontFamily:C.fBody,fontSize:13,color:C.muted,marginBottom:12,lineHeight:1.6}}>Wipes all saved tunes, AI keys, unit preferences, and resets the app to first launch. Cannot be undone.</div>
          <button onClick={()=>{if(window.confirm("Reset all data? This cannot be undone.")){Object.keys(localStorage).filter(k=>k.startsWith("tl_")).forEach(k=>localStorage.removeItem(k));window.location.reload();}}}
            style={{...S.btn,width:"100%",padding:"11px",background:"transparent",border:"1px solid rgba(255,77,77,0.3)",borderRadius:8,color:"#ff4d4d",fontFamily:C.fBody,fontSize:14,gap:6}}>
            🗑 Reset all data
          </button>
        </div>

        <div style={{textAlign:"center",padding:"8px 0 16px"}}>
          <div style={{fontFamily:C.fBody,fontSize:13,color:C.muted,marginBottom:6}}>With thanks to</div>
          <div style={{fontFamily:C.fCond,fontSize:20,fontWeight:700,color:C.text,letterSpacing:"0.08em"}}>Kireth</div>
          <div style={{fontFamily:C.fBody,fontSize:12,color:C.dim,marginTop:4}}>Early FH6 physics feedback · youtube.com/@Kireth</div>
        </div>

        <div style={{textAlign:"center",padding:"0 0 20px"}}>
          <div style={{fontFamily:C.fBody,fontSize:11,color:C.dim,lineHeight:1.7}}>TuneLab is not affiliated with Xbox, Turn 10, or Playground Games.</div>
          <div style={{fontFamily:C.fBody,fontSize:11,color:C.dim,lineHeight:1.7}}>Forza Horizon® is a registered trademark of Microsoft Corporation.</div>
        </div>
      </div>
    </div>
  );
}


// ─── CAR DATABASE ─────────────────────────────────────────────────────────
// drive: FWD/RWD/AWD | cls: D/C/B/A/S1/S2/X/R | weight: lbs (0=unknown) | ev: true/false
// Generated from official FH6 car list — weight/PI to be filled post-launch

const CAR_DB_FULL = [
  // Seed data — app fetches full list from GitHub on launch
  // See: https://raw.githubusercontent.com/super-android/tunelab/main/cars.json
  {make:"Nissan",model:"GT-R Black Edition (R35)",year:"2012",drive:"AWD",cls:"S1",weight:3900,pi:703,ev:false},
  {make:"Toyota",model:"Sprinter Trueno GT Apex",year:"1985",drive:"RWD",cls:"D",weight:2095,pi:376,ev:false},
  {make:"Subaru",model:"Impreza WRX STI",year:"2004",drive:"AWD",cls:"B",weight:3086,pi:552,ev:false},
  {make:"Porsche",model:"911 Carrera S",year:"2019",drive:"RWD",cls:"S1",weight:3197,pi:714,ev:false},
  {make:"Honda",model:"Civic Type R",year:"2023",drive:"FWD",cls:"A",weight:3042,pi:620,ev:false},
];

// 555 cars total

const MAKES = [
  "AMG Transport Dynamics",
  "Abarth",
  "Acura",
  "Alfa Romeo",
  "Alumicraft",
  "Ariel",
  "Aston Martin",
  "Audi",
  "Autozam",
  "BAC",
  "BMW",
  "Bentley",
  "Buick",
  "Cadillac",
  "Can-Am",
  "Casey Currie",
  "Chevrolet",
  "Datsun",
  "DeBerti",
  "DeLorean",
  "Dodge",
  "Ferrari",
  "Ford",
  "Formula Drift",
  "Funco",
  "GMC",
  "GR",
  "Gordon Murray",
  "HSV",
  "Hennessey",
  "Holden",
  "Honda",
  "Hyundai",
  "Jaguar",
  "Jeep",
  "Jimco",
  "KTM",
  "Koenigsegg",
  "Lamborghini",
  "Lancia",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Lotus",
  "Lucid",
  "MG",
  "MINI",
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes-AMG",
  "Mercedes-Benz",
  "Meyers",
  "Mitsubishi",
  "Nissan",
  "Noble",
  "Opel",
  "Pagani",
  "Peel",
  "Penhall",
  "Peugeot",
  "Plymouth",
  "Polaris",
  "Pontiac",
  "Porsche",
  "RJ Anderson",
  "Radical",
  "Ram",
  "Reliant",
  "Renault",
  "Rivian",
  "SIERRA Cars",
  "Saleen",
  "Schuppan",
  "Shelby",
  "Subaru",
  "TVR",
  "Toyota",
  "Volkswagen",
  "Volvo",
  "Wuling",
  "Zenvo",
];

// Helper: get car details from full DB
function getCarDetails(make, model) {
  const short = model.split(" '")[0];
  return CAR_DB_FULL.find(c => c.make === make && (c.model === model || c.model.startsWith(short))) || null;
}


const CAR_DB = {
  "AMG Transport Dynamics": ["M12S Warthog CST '54"],
  "Abarth": ["595 esseesse '68", "Fiat 131 '80", "695 Biposto '16"],
  "Acura": ["Integra Type-R '01", "RSX Type S '02", "NSX Type S '22", "Integra A-Spec '23"],
  "Alfa Romeo": ["Giulia Sprint GTA Stradale '65", "Giulia TZ2 '65", "33 Stradale '68", "SE 048SP '90", "155 Q4 '92", "4C '14", "Giulia Quadrifoglio '17", "Giulia GTAm '21"],
  "Alumicraft": ["Class 10 Race Car '15", "#122 Class 1 Buggy '21", "#6165 Trick Truck '22"],
  "Ariel": ["Atom 500 V8 '13", "Nomad '16"],
  "Aston Martin": ["DB5 '64", "DB11 '17", "Vulcan AMR Pro '17", "DBS Superleggera '19", "Valhalla Concept Car '19", "Vantage '19", "DBX '21", "Valkyrie AMR Pro '22", "Valkyrie '23"],
  "Audi": ["Sport quattro '83", "#2 Sport quattro S1 '86", "RS 4 Avant '01", "RS 6 '03", "RS 4 '06", "RS 6 '09", "R8 LMS '09", "TT RS Coupé '10", "RS 3 Sportback '11", "RS 5 Coupé '11", "R8 Coupé V10 plus '13", "RS 4 Avant '13", "RS 7 Sportback '13", "RS 6 Avant '15", "S1 '15", "R8 V10 plus '16", "RS 4 Avant '18", "R8 V10 Performance '20", "RS 3 Sedan '20", "RS 6 Avant '21", "RS 7 Sportback '21", "RS e-tron GT '21"],
  "Autozam": ["AZ-1 '93"],
  "BAC": ["Mono '14"],
  "BMW": ["Isetta 300 Export '57", "2002 Turbo '73", "M1 '81", "M3 '88", "M5 '88", "850CSi '95", "M5 '95", "M3 '97", "M5 '03", "M3 '05", "M3 '08", "Z4 M Coupé '08", "M5 '09", "M3 GTS '10", "X5 M '11", "M5 '12", "M4 Coupé '14", "i8 '15", "M4 GTS '16", "Z4 Roadster '19", "M2 Competition Coupé '20", "M8 Competition Coupe '20", "M4 Competition Coupé '21", "M4 Competition Coupé 'Welcome Pack' '21", "M5 CS '22", "iX xDrive50 '22", "M2 '23", "M2 Forza Edition '23", "X6 M Competition '24"],
  "Bentley": ["Bentayga '16", "Continental GT Convertible '21"],
  "Buick": ["Regal GNX '87"],
  "Cadillac": ["ATS-V '16", "CTS-V Sedan '16", "CT4-V Blackwing '22", "CT5-V Blackwing '22"],
  "Can-Am": ["Maverick X RS Turbo R '18"],
  "Casey Currie": ["#4402 Ultra 4 'Trophy Jeep' '19"],
  "Chevrolet": ["Corvette '53", "150 Utility Sedan '55", "Bel Air '57", "Corvette '60", "Impala Super Sport 409 '64", "Corvette Stingray 427 '67", "Camaro Super Sport Coupe '69", "Nova Super Sport 396 '69", "Chevelle Super Sport 454 '70", "El Camino Super Sport 454 '70", "K10 Custom '72", "Camaro Z28 '79", "Monte Carlo Super Sport '88", "Corvette ZR-1 '95", "Impala Super Sport '96", "Corvette Z06 '02", "Corvette ZR1 '09", "Camaro Z/28 '15", "Corvette Z06 '15", "Camaro ZL1 '17", "Camaro ZL1 1LE '18", "Corvette ZR1 '19", "Corvette Stingray Coupé '20", "Silverado LT Trail Boss '20", "Corvette Z06 '23", "Corvette E-Ray '24"],
  "Datsun": ["510 '70"],
  "DeBerti": ["Wrangler Unlimited '13", "Chevrolet Silverado 1500 Drift Truck '18", "Ford Super Duty F-250 Lariat 'Transformer' '19", "Toyota Tacoma TRD 'The Performance Truck' '19"],
  "DeLorean": ["DMC-12 '82"],
  "Dodge": ["Dart HEMI Super Stock '68", "Charger Daytona HEMI '69", "Charger R/T '69", "Challenger R/T '70", "Coronet Super Bee '70", "Viper GTS ACR '99", "Viper GTS ACR Forza Edition '99", "Viper SRT10 ACR '08", "SRT Viper GTS '13", "Challenger SRT Hellcat '15", "Charger SRT Hellcat '15", "Viper ACR '16", "Challenger SRT Demon '18", "Durango SRT Hellcat '21", "Challenger SRT Super Stock '22"],
  "Ferrari": ["250 GT Berlinetta Lusso '62", "275 GTB4 Spider '67", "Dino 246 GT '69", "288 GTO '84", "F40 '87", "F40 Competizione '89", "512 TR '92", "F355 Berlinetta '94", "F50 '95", "F50 GT '96", "FXX '05", "430 Scuderia '07", "458 Italia '09", "599XX '10", "458 Speciale '13", "LaFerrari '13", "J50 '17", "FXX-K Evo '18", "FXX-K Evo 'Welcome Pack' '18", "Portofino '18", "488 Pista '19", "Monza SP2 '19", "296 GTB '22", "F80 '25"],
  "Ford": ["De Luxe Five-Window Coupe '32", "Mustang GT Coupe '65", "#2 GT40 Mk II Le Mans '66", "Mustang 2+2 Fastback '68", "Mustang 2+2 Fastback Forza Edition '68", "Mustang Boss 302 '69", "Capri RS3100 '73", "XB Falcon GT '73", "#5 Escort RS1800 MK II '77", "RS200 Evolution '85", "F-150 XLT Lariat '86", "F-150 XLT Lariat Forza Edition '86", "Sierra Cosworth RS500 '87", "Escort RS Cosworth '92", "SVT Cobra R '93", "Supervan 3 '94", "Racing Puma '99", "F-150 SVT Lightning '03", "Focus RS '03", "GT '05", "Focus RS '09", "Crown Victoria Police Interceptor '10", "Transit SuperSportVan '11", "Mustang Shelby GT500 '13", "#11 Rockstar F-150 Trophy Truck '14", "Ranger T6 Rally Raid '14", "Mustang Shelby GT350R '16", "#14 Rahal GRC Fiesta '17", "#25 'Brocky' Ultra4 Bronco RTR '17", "Focus RS '17", "GT '17", "Mustang RTR Spec 5 '18", "#2069 Ford Performance Bronco R '20", "Mustang Shelby GT500 '20", "Super Duty F-450 DRW Platinum '20", "Bronco Raptor '22", "F-150 Lightning Platinum '22", "Focus ST '22", "F-150 Raptor R '23", "F-150 Raptor R 'Welcome Pack' '23", "Fiesta ST '23", "Mustang Dark Horse '24", "Mustang GT '24"],
  "Formula Drift": ["#98 BMW 325i '89", "#34 Toyota Supra MkIV '95", "#777 Nissan 240SX '97", "#43 Dodge Viper SRT10 '06", "#117 599 GTB Fiorano '07", "#99 Mazda RX-8 '09", "#777 Chevrolet Corvette '13", "#13 Ford Mustang '15", "#530 HSV Maloo Gen-F '16", "#411 Toyota Corolla Hatchback '19", "#91 BMW M2 '20", "#151 Toyota GR Supra '20", "#64 Forsberg Racing Nissan Z '23"],
  "Funco": ["Motorsports F9 '18"],
  "GMC": ["Jimmy '70", "Syclone '91", "Typhoon '92", "HUMMER EV Pickup '22"],
  "GR": ["GT Prototype '25"],
  "Gordon Murray": ["T.50 '22"],
  "HSV": ["GEN-F GTS '14"],
  "Hennessey": ["Venom GT '12", "Venom F5 '21"],
  "Holden": ["Torana A9X '77"],
  "Honda": ["S800 '70", "Civic RS '74", "City E II '84", "Civic CRX Mugen '84", "Civic Si '86", "#19 CRX WTAC '90", "Beat '91", "CR-X SiR '91", "#21 Hardrace Civic WTAC '92", "NSX-R '92", "Acty '94", "Acty 'Rakuraku Express' '94", "Prelude Si '94", "Civic Type R '97", "#33 Integra WTAC '01", "S2000 '03", "S2000 Touge Edition '03", "#52 Evasive S2000 WTAC '04", "Civic Type R '04", "NSX-R '05", "NSX-R GT '05", "Civic Type-R '07", "Civic Type R '15", "Ridgeline Baja Trophy Truck '15", "Civic Type R '18", "e '22", "Civic Type R '23"],
  "Hyundai": ["Veloster N '19", "i30 N '20", "i20 N '21", "N Vision 74 '22", "IONIQ 5 N '23"],
  "Jaguar": ["D-Type '56", "E-Type '61", "Lightweight E-Type '64", "XJ220 '93", "XJ220 TWR '93", "C-X75 '10"],
  "Jeep": ["Wrangler Rubicon '12", "Trailcat '16", "Grand Cherokee Trackhawk '18", "Gladiator Rubicon (JT) '20"],
  "Jimco": ["#240 Fastball Racing Spec Trophy Truck '19", "#179 Hammerhead Class 1 '20"],
  "KTM": ["X-Bow GT4 '18"],
  "Koenigsegg": ["CCGT '08", "Agera '11", "One:1 '15", "Regera '16", "Jesko '20"],
  "Lamborghini": ["Miura P400 '67", "Countach LP5000 QV '88", "Diablo SV '97", "Diablo GTR '99", "Murciélago LP 670-4 SV '10", "Aventador LP 700-4 '12", "Gallardo LP 570-4 Spyder Performante '12", "Veneno '13", "Huracán LP 610-4 '14", "Centenario LP 770-4 '16", "Aventador SVJ '18", "Urus '19", "Essenza SCV12 '20", "Huracán STO '20", "Countach LPI 800-4 '21", "Huracán Sterrato '22", "Huracán Tecnica '22", "Revuelto '24"],
  "Lancia": ["Stratos HF Stradale '74", "Delta S4 '86", "Delta HF Integrale Evo '92"],
  "Land Rover": ["Range Rover Sport SVR '15", "Defender 110 X '20"],
  "Lexus": ["LFA '10", "LFA Forza Edition '10", "RC F '15", "LC 500 '21"],
  "Lincoln": ["Continental '62"],
  "Lotus": ["Elise GT1 '97", "Elise Series 1 Sport 190 '99", "Exige Cup 430 '18", "Scura Motorsport Exige WTAC '18", "Evija '20", "Evija Forza Edition '20", "Emira '23"],
  "Lucid": ["Air Sapphire '24"],
  "MG": ["Metro 6R4 '86"],
  "MINI": ["Cooper S '65", "John Cooper Works GP '12", "X-Raid John Cooper Works Buggy '18", "John Cooper Works GP '21"],
  "Maserati": ["Ghibli Cup '97", "MC20 '22"],
  "Mazda": ["Cosmo 110S Series II '72", "RX-3 '73", "RX-3 Forza Edition '73", "RX-7 GSL-SE '85", "Savanna RX-7 '90", "MX-5 Miata '90", "#55 Mazda 787B '91", "RX-7 Type R '92", "MX-5 Miata '94", "MX-5 Miata Forza Edition '94", "Mazdaspeed MX-5 '05", "Furai '08", "Mazdaspeed 3 '10", "RX-8 R3 '11", "MX-5 '13", "MX-5 '16", "MX-5 Cup '17", "MX-5 Miata RF '22"],
  "McLaren": ["F1 '93", "F1 GT '97", "12C Coupé '11", "P1 '13", "570S Coupé '15", "600LT Coupé '18", "Speedtail '19", "620R '21", "765LT '21", "Sabre '21", "Artura '23"],
  "Mercedes-AMG": ["C 63 S Coupé '16", "E 63 S '18", "GT 4-Door Coupé '18", "GT Black Series '21", "GT Black Series 'Welcome Pack' '21", "SL 63 '21"],
  "Mercedes-Benz": ["300 SL Coupé '54", "AMG Hammer Coupe '87", "190E 2.5-16 Evolution II '90", "190E 2.5-16 Evolution II Forza Edition '90", "SL 65 AMG Black Series '09", "C 63 AMG Coupé Black Series '12", "A 45 AMG '13", "G 65 AMG '13", "G 65 AMG 6x6 '14", "Unimog U5023 '14", "X-Class '18", "SLC 43 Final Edition '20"],
  "Meyers": ["Manx '71", "Manx 2.0 EV '23"],
  "Mitsubishi": ["#269 Minicab Time Attack '90", "Galant VR-4 '92", "Eclipse GSX '95", "Lancer Evolution III GSR '95", "Montero Exceed 2800 TD '95", "GTO '97", "Montero Evolution '97", "Lancer Evolution VI GSR TM Edition '01", "Lancer Evolution VIII MR '04", "Lancer Evolution VIII MR 'Welcome Pack' '04", "#1 Sierra Lancer Evolution Time Attack '05", "Lancer Evolution IX MR '06", "Lancer Evolution X GSR '08"],
  "Nissan": ["Fairlady Z 432 '69", "Skyline 2000GT-R '71", "Skyline H/T 2000GT-R '73", "#11 Tomica Skyline Turbo Super Silhouette '83", "Safari Turbo '85", "Be-1 '87", "Skyline GTS-R (HR31) '87", "PAO '89", "S-Cargo '89", "S-Cargo Forza Edition '89", "Silvia K's '89", "Pulsar GTI-R '90", "Figaro '91", "Skyline GT-R '92", "#32 Skyline WTAC 'Xtreme GTR' '93", "240SX '93", "Skyline GT-R V-Spec '93", "Fairlady Z Version S Twin Turbo '94", "Silvia K's '94", "Gloria Gran Turismo '95", "Nismo GT-R LM '95", "Skyline GT-R V-Spec '97", "Stagea RS Four V '97", "#23 Pennzoil Nismo Skyline GT-R '98", "Silvia K's Aero '98", "#36 Silvia WTAC '00", "Skyline GT-R V-Spec II '00", "Silvia Spec-R '02", "Fairlady Z '03", "370Z '10", "GT-R Black Edition (R35) '12", "GT-R Black Edition (R35) Forza Edition '12", "GT-R Black Edition (R35) Touge Edition '12", "GT-R (R35) '17", "370Z NISMO '19", "GT-R NISMO (R35) '20", "GT-R NISMO '24", "Z NISMO '24"],
  "Noble": ["M600 '10"],
  "Opel": ["Manta 400 '84"],
  "Pagani": ["Zonda Cinque Roadster '09", "Huayra BC Coupe '16", "Huayra R '21"],
  "Peel": ["P50 '62", "P50 Trolli Edition '62"],
  "Penhall": ["The Cholla '11"],
  "Peugeot": ["205 Turbo 16 '84", "205 Rallye '91", "207 Super 2000 '07"],
  "Plymouth": ["Fury '58", "Barracuda Formula-S '68", "Cuda 426 Hemi '71"],
  "Polaris": ["RZR Pro XP Ultimate '21", "RZR Pro XP Factory Racing Limited Edition '21"],
  "Pontiac": ["Firebird Trans Am '77", "Firebird Trans Am GTA '87"],
  "Porsche": ["#3 917 LH '70", "911 Carrera RS '73", "911 Turbo 3.3 '82", "#185 959 Prodrive Rally Raid '86", "928 GTS '93", "968 Turbo S '93", "911 GT2 '95", "911 GT1 Strassenversion '97", "Carrera GT '03", "911 GT3 '04", "911 GT3 RS 4.0 '12", "918 Spyder '14", "718 Cayman GTS '18", "Macan LPR Rally Raid '18", "#70 Porsche Motorsport 935 '19", "911 Carrera S '19", "911 GT3 RS '19", "911 GT3 '21", "Mission R '21", "718 Cayman GT4 RS '22", "911 GT3 RS '23", "911 Rallye '23", "911 Turbo S '23"],
  "RJ Anderson": ["#37 Polaris RZR-Rockstar Pro 2 Truck '16", "#37 Polaris RZR Pro 4 Truck '21"],
  "Radical": ["RXC Turbo '15"],
  "Ram": ["1500 TRX '24"],
  "Reliant": ["Supervan III '72"],
  "Renault": ["8 Gordini '67", "5 Turbo '80", "Clio Williams '93", "Megane R26.R '08", "Megane RS 250 '10", "Mégane R.S. '18"],
  "Rivian": ["R1T '22"],
  "SIERRA Cars": ["#23 Yokohama Alpha '20", "700R '21", "RX3 '21"],
  "Saleen": ["S7 LM '17"],
  "Schuppan": ["962CR '93"],
  "Shelby": ["Cobra 427 S/C '65", "Cobra Daytona Coupé '65"],
  "Subaru": ["BRAT GL '80", "Legacy RS '90", "Vivio RX-R '94", "Vivio RX-R Forza Edition '94", "SVX '96", "Impreza 22B-STi Version '98", "Impreza WRX STi '04", "Impreza WRX STi '05", "Legacy B4 2.0 GT '05", "Impreza WRX STI '08", "WRX STI '11", "BRZ '13", "WRX STI '15", "WRX STI ARX Supercar '18", "STI S209 '19", "BRZ '22", "BRZ Forza Edition '22", "WRX '22"],
  "TVR": ["Sagaris '05", "Griffith '18"],
  "Toyota": ["Sports 800 '65", "Sports 800 Fanta Edition '65", "2000GT '69", "Corolla SR5 '74", "FJ40 '79", "Sprinter Trueno GT Apex '85", "Sprinter Trueno GT Apex Forza Edition '85", "Sprinter Trueno GT Apex Touge Edition '85", "MR2 SC '89", "Chaser GT Twin Turbo '91", "Sera '91", "Celica GT-Four RC ST185 '92", "Supra 2.0 GT '92", "#1 Baja T100 Truck '93", "Celica GT-Four ST205 '94", "J&J Motorsport Supra WTAC '95", "MR2 GT '95", "Chaser 2.5 Tourer V '97", "Soarer 2.5 GT-T '97", "Supra RZ '98", "Celica Sport Specialty II '03", "Crown Super Deluxe Taxi '05", "86 '13", "86 'Stories' '13", "Land Cruiser Arctic Trucks AT37 '16", "JPN Taxi '17", "4Runner TRD Pro '19", "Tacoma TRD Pro '19", "Tacoma TRD Pro Forza Edition '19", "GR Supra '20", "GR Yaris '21", "GR86 '22", "Camry TRD '23", "Land Cruiser '25"],
  "Volkswagen": ["Beetle '63", "Type 2 De Luxe '63", "Class 5/1600 Baja Bug '69", "Pickup LX '82", "Golf GTI '83", "Golf GTI 16V Mk2 '92", "Corrado VR6 '95", "Golf R '10", "Scirocco R '11", "Golf R '14", "#34 Volkswagen Andretti Rallycross Beetle '17", "Golf R '21", "Golf R '22"],
  "Volvo": ["242 Turbo Evolution '83"],
  "Wuling": ["Sunshine S '13", "Sunshine S Forza Edition '13", "Hongguang Mini EV Macaron '22"],
  "Zenvo": ["TSR-S '19"],
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function ForzaTuner() {
  const [screen,      setScreen]      = useState(()=>{ const done = LS.get("tl_v1_done_units",false); return (done===true||done==="true")?"main":"units"; });
  const [units,       setUnits]       = useState(()=>LS.get("tl_v1_units",{weight:"lbs",springs:"lbs/in",pressure:"psi",speed:"mph"}));
  const [inputDevice, setInputDevice] = useState(()=>LS.get("tl_v1_device","controller"));
  const [mode,        setMode]        = useState(()=>LS.get("tl_v1_mode","D"));
  const [overlay,     setOverlay]     = useState(null);
  const [toast,       setToast]       = useState(null);

  const [make,        setMake]        = useState("Nissan");
  const [model,       setModel]       = useState("GT-R Black Edition (R35)");
  const [carSearch,   setCarSearch]   = useState("");
  const [showSearch,  setShowSearch]  = useState(false);

  const [weight,      setWeight]      = useState(3900);
  const [weightDist,  setWeightDist]  = useState(53);
  const [pi,          setPi]          = useState(850);
  const [carClass,    setCarClass]    = useState("S1");
  const handleCarClass = (cls) => {
    setCarClass(cls);
    setPi(CLASS_PI[cls]?.default ?? 500);
  };
  const [driveType,   setDriveType]   = useState("AWD");
  const [tuneId,      setTuneId]      = useState("Race");
  const [surface,     setSurface]     = useState("Tarmac");
  const [compound,    setCompound]    = useState("Race Semi-Slick");

  const [redlineRpm,     setRedlineRpm]     = useState(7000);
  const [peakTorqueRpm,  setPeakTorqueRpm]  = useState(4500);
  const [maxTorque,      setMaxTorque]      = useState(500);
  const [topspeed,       setTopspeed]       = useState(180);
  const [gears,          setGears]          = useState(6);
  const [includeGearing, setIncludeGearing] = useState(true);
  const [tireWF,   setTireWF]   = useState(245);
  const [tireWR,   setTireWR]   = useState(275);
  const [tireARF,  setTireARF]  = useState(35);
  const [tireAR,   setTireAR]   = useState(35);
  const [tireRimF, setTireRimF] = useState(19);
  const [tireRim,  setTireRim]  = useState(19);
  const [carHeight,setCarHeight]= useState(1400);
  const [rpmScale, setRpmScale] = useState(0);
  const [generated,setGenerated]= useState(false);

  const [hasAero,  setHasAero]  = useState(false);
  const [aeroF,    setAeroF]    = useState(0);
  const [aeroR,    setAeroR]    = useState(0);
  const [dragCd,   setDragCd]   = useState(0.32);

  const [feelAggression, setFeelAggression] = useState(50);
  const [feelBalance,    setFeelBalance]    = useState(50);

  const [tunePages,    setTunePages]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [aiSummary,    setAiSummary]    = useState(null);
  const [showPaste,    setShowPaste]    = useState(false);
  const [pasteError,   setPasteError]   = useState("");

  // Remote car DB — fetches latest cars.json from GitHub on launch
  // Falls back to hardcoded CAR_DB_FULL if offline or fetch fails
  const [remoteCarDB, setRemoteCarDB] = useState(null);
  const carDB = remoteCarDB || CAR_DB_FULL;

  useEffect(()=>{
    const CAR_DB_URL = "https://raw.githubusercontent.com/super-android/tunelab/main/cars.json";
    const CACHE_KEY  = "tl_v1_cardb_cache";
    const VER_KEY    = "tl_v1_cardb_version";

    // Use cached version immediately while fetching
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if(cached) setRemoteCarDB(JSON.parse(cached));
    } catch(e) {}

    // Fetch latest in background
    fetch(CAR_DB_URL)
      .then(r=>r.ok?r.json():null)
      .then(data=>{
        if(!data?.cars?.length) return;
        const cachedVer = parseInt(localStorage.getItem(VER_KEY)||"0");
        if(data.version > cachedVer) {
          setRemoteCarDB(data.cars);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data.cars));
            localStorage.setItem(VER_KEY, String(data.version));
          } catch(e) {}
        }
      })
      .catch(()=>{}); // silent fail — use hardcoded DB
  },[]);

  const getState = () => ({
    make,model,driveType,tuneId,weight,weightDist,pi,carClass,surface,compound,
    redlineRpm: mode==="S"?redlineRpm:0,
    peakTorqueRpm: mode==="S"?peakTorqueRpm:0,
    maxTorque: mode==="S"?maxTorque:500,
    topspeed: mode==="S"?topspeed:180,
    gears: mode==="S"?gears:6,
    tireWF:`${tireWF}/${tireARF}R${tireRimF}`, tireWR:`${tireWR}/${tireAR}R${tireRim}`,
    carHeight: carHeight||null,
    hasAero,aeroF,aeroR,dragCd,
    inputDevice,
    includeGearing: mode==="S"&&includeGearing,
    feelBalance:50, feelAggression:50,
    units,
  });

  const handleGenerate = async() => {
    setLoading(true);
    try {
      const st = getState();
      const tune = calcTune(st);
      setTunePages(tune);
      setGenerated(true);
      setScreen("output");
    } catch(e) {
      console.log("Generate error:", e.message);
      setToast("Error: " + e.message);
    }
    setLoading(false);
  };

  const loadTune = entry => {
    const s = entry.appState;
    setMake(s.make||"Nissan"); setModel(s.model||"GT-R Premium '17");
    setDriveType(s.driveType||"AWD"); setTuneId(s.tuneId||"Race");
    setWeight(s.weight||3836); setWeightDist(s.weightDist||48);
    setPi(s.pi||850); setCarClass(s.carClass||"S1");
    setTunePages(entry.tunePages||{}); setGenerated(true); setScreen("output");
    setToast("Tune loaded!");
  };

  // Set viewport + apply theme class on mount + listen for changes
  useEffect(()=>{
    const vp = document.querySelector('meta[name="viewport"]');
    if(vp) vp.content = "width=device-width, initial-scale=1.0, viewport-fit=cover";
    let cs = document.querySelector('meta[name="color-scheme"]');
    if(!cs){ cs=document.createElement('meta'); cs.name="color-scheme"; document.head.appendChild(cs); }
    cs.content = "light dark";
    // Apply class-based theme so Capacitor WebView picks it up reliably
    const applyTheme = (e) => {
      const isLight = e ? e.matches : window.matchMedia("(prefers-color-scheme: light)").matches;
      document.documentElement.classList.toggle("light-mode", isLight);
      document.documentElement.classList.toggle("dark-mode", !isLight);
    };
    applyTheme();
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", applyTheme);
    return () => mq.removeEventListener("change", applyTheme);
  },[]);

  // Persist mode preference
  useEffect(()=>{ LS.set("tl_v1_mode",mode); },[mode]);

  // Car search filter
  const searchResults = carSearch.length > 0
    ? (CAR_DB[make]||[]).filter(m=>m.toLowerCase().includes(carSearch.toLowerCase())).map(m=>({make,model:m}))
    : (CAR_DB[make]||[]).slice(0,8).map(m=>({make,model:m}));

  if (screen==="units") return (
    <UnitsScreen onDone={(u,dev)=>{
      setUnits(u); setInputDevice(dev);
      LS.set("tl_v1_units",u); LS.set("tl_v1_device",dev); LS.set("tl_v1_done_units",true);
      setScreen("main");
    }}/>
  );

  if (screen==="output" && Object.keys(tunePages).filter(k=>k!=='_summary'&&tunePages[k]).length === 0) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <style>{FONTS+THEME_STYLE}</style>
      <div style={{fontFamily:C.fMono,fontSize:11,color:C.muted,letterSpacing:"0.2em"}}>CALCULATING…</div>
      <button onClick={()=>setScreen("main")} style={{fontFamily:C.fCond,fontSize:12,color:C.muted,background:"transparent",border:`1px solid ${C.border}`,borderRadius:4,padding:"8px 16px",cursor:"pointer"}}>← Back</button>
    </div>
  );

  if (screen==="output") return (
    <OutputErrorBoundary onBack={()=>setScreen("main")}>
      <OutputScreen
        appState={getState()}
        tunePages={tunePages}
        setTunePages={setTunePages}
        onBack={()=>setScreen("main")}
        onNewTune={()=>setScreen("main")}
      />
    </OutputErrorBoundary>
  );

  // ── MAIN INPUT SCREEN ──────────────────────────────────────────────────────
  const color       = TUNE_MODES.find(t=>t.id===tuneId)?.color||C.accent;
  const accentColor = color;
  const BRIGHT      = ["Touge","Drag"];
  const onAccent    = BRIGHT.includes(tuneId) ? "#0a0c0f" : "#ffffff";
  const isAdvanced  = mode==="S";

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,maxWidth:480,margin:"0 auto",fontFamily:C.fBody,display:"flex",flexDirection:"column"}}>
      <style>{FONTS+THEME_STYLE+`input[type=number]::-webkit-inner-spin-button{opacity:1}`}</style>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
      {overlay==="save"&&<SaveDrawer appState={getState()} tunePages={tunePages} onLoad={loadTune} onClose={()=>setOverlay(null)}/>}
      {overlay==="ai"&&<AIScreen onClose={()=>setOverlay(null)}/>}
      {overlay==="about"&&<AboutScreen onClose={()=>setOverlay(null)}/>}
      {overlay==="settings"&&<SettingsScreen units={units} device={inputDevice} onSave={(u,dev)=>{LS.set("tl_v1_units",u);LS.set("tl_v1_device",dev);setUnits(u);setInputDevice(dev);setOverlay(null);}} onClose={()=>setOverlay(null)}/>}

      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:20,background:C.bg,borderBottom:`1px solid ${C.border}`,padding:"calc(env(safe-area-inset-top, 0px) + 10px) 14px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{lineHeight:1,position:"relative"}}>
          <div style={{position:"absolute",bottom:-8,left:0,right:0,height:1,background:"linear-gradient(90deg,rgba(0,255,133,0.2),transparent)"}}/>
          <div style={{fontFamily:C.fCond,fontSize:26,fontWeight:700,color:C.text,letterSpacing:"0.12em"}}><span style={{color:accentColor}}>Tune</span>Lab</div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`,animation:"pulse 2s infinite"}}/>
            <div style={{fontFamily:C.fMono,fontSize:9,color:C.muted,letterSpacing:"0.08em"}}>FH6 · <span style={{color:C.green}}>v{VERSION}</span></div>
          </div>
        </div>
        {/* D/S toggle */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
          <div style={{display:"flex",background:C.surface,borderRadius:9,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            {[{id:"D",label:"D — Quick"},{id:"S",label:"S — Advanced"}].map(m=>(
              <button key={m.id} onClick={()=>setMode(m.id)} style={{...S.btn,padding:"5px 14px",background:mode===m.id?accentColor:"transparent",color:mode===m.id?onAccent:C.muted,fontFamily:C.fBody,fontSize:12,fontWeight:mode===m.id?600:400,transition:"all 0.15s"}}>
                {m.id}
              </button>
            ))}
          </div>
          <span style={{fontSize:12,color:C.muted,fontFamily:C.fBody,letterSpacing:"0.02em"}}>
            {mode==="D"?"D — instant":"S — full math"}
          </span>
        </div>
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>setOverlay("ai")} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:12}}>✦</button>
          <button onClick={()=>setOverlay("save")} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:14}}>💾</button>
          <button onClick={()=>setOverlay("about")} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:14}}>ℹ</button>
          <button onClick={()=>setOverlay("settings")} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:12}}>⚙</button>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"10px 14px 130px"}}>

        {/* Car search */}
        <div style={{marginBottom:10,position:"relative"}}>
          {/* Manufacturer dropdown + search — two-step like ForzaDroid */}
          <div style={{display:"flex",gap:6,marginBottom:6}}>
            <select value={make} onChange={e=>{
              const newMake = e.target.value;
              const firstModel = CAR_DB[newMake]?.[0]||"";
              setMake(newMake);setModel(firstModel);setCarSearch("");
              const details = carDB.find(car=>car.make===newMake&&(car.model===firstModel||car.model.startsWith(firstModel.split(" '")[0]))) || getCarDetails(newMake, firstModel);
              if(details?.drive) setDriveType(details.drive);
              if(details?.cls) setCarClass(details.cls);
            }}
              style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:6,
                padding:"9px 10px",color:C.text,fontFamily:C.fMono,fontSize:11,letterSpacing:"0.06em",
                outline:"none",cursor:"pointer",appearance:"none",
                backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23566878'/%3E%3C/svg%3E")`,
                backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center",paddingRight:28}}>
              {MAKES.map(mk=><option key={mk} value={mk}>{mk}</option>)}
            </select>
          </div>
          <div onClick={()=>setShowSearch(true)}
            style={{display:"flex",alignItems:"center",gap:8,background:C.card,
              border:`1px solid ${showSearch?accentColor:C.border}`,
              borderLeft:`3px solid ${showSearch?accentColor:C.border}`,
              borderRadius:4,padding:"10px 12px",cursor:"text",transition:"border-color 0.15s"}}>
            <span style={{fontSize:12,color:C.muted}}>⊕</span>
            {showSearch ? (
              <input autoFocus value={carSearch} onChange={e=>setCarSearch(e.target.value)}
                placeholder={`Search ${make}…`}
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:C.text,fontFamily:C.fBody,fontSize:14}}
                onBlur={()=>setTimeout(()=>setShowSearch(false),200)}
              />
            ) : (
              <span style={{flex:1,fontFamily:C.fCond,fontSize:16,fontWeight:700,letterSpacing:"0.04em",color:C.text,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{make} {model}</span>
            )}
            <span style={{fontFamily:C.fMono,fontSize:10,color:accentColor,letterSpacing:"0.1em",flexShrink:0}}>{driveType}</span>
          </div>
          {showSearch && searchResults.length>0 && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:100,
              background:C.card,border:`1px solid ${C.border}`,borderRadius:4,
              marginTop:4,maxHeight:220,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
              {searchResults.map((r,i)=>(
                <div key={i} onMouseDown={()=>{
                  setMake(r.make);setModel(r.model);setCarSearch("");setShowSearch(false);
                  const details = carDB.find(car=>car.make===r.make&&(car.model===r.model||car.model.startsWith(r.model.split(" '")[0]))) || getCarDetails(r.make, r.model);
                  if(details?.drive) setDriveType(details.drive);
                  if(details?.cls) setCarClass(details.cls);
                  if(details?.weight && details.weight > 0) setWeight(details.weight);
                  if(details?.pi && details.pi > 0) setPi(details.pi);
                }}
                  style={{padding:"10px 14px",borderBottom:i<searchResults.length-1?`1px solid ${C.border}`:"none",
                    cursor:"pointer",fontFamily:C.fBody,fontSize:13,color:C.text,
                    display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>{r.make} <span style={{color:C.muted,fontWeight:300}}>{r.model}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drive type */}
        <Seg label="Drive type" opts={DRIVE_TYPES} val={driveType} set={setDriveType} color={accentColor} onColor={onAccent}/>

        {/* Tune mode */}
        <ModeGrid value={tuneId} onChange={id=>{
          setTuneId(id);
          // Auto-set sensible compound default per mode
          const compoundDefaults = {
            Race:"Race Slick", Touge:"Race Semi-Slick", Wangan:"Race Semi-Slick",
            Drift:"Race Semi-Slick", Drag:"Drag", Rally:"Rally",
            Rain:"Street", General:"Sport",
          };
          if(compoundDefaults[id]) setCompound(compoundDefaults[id]);
          // Auto-set surface per mode
          const surfaceDefaults = {
            Race:"Road", Touge:"Road", Wangan:"Road",
            Drift:"Road", Drag:"Road", Rally:"Mixed",
            Rain:"Road", General:"Road",
          };
          setSurface(surfaceDefaults[id] || "Road");
        }}/>

        {/* Weight + PI */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <NumIn label={`Weight (${units.weight})`} value={weight} onChange={setWeight} unit={units.weight} min={units.weight==="lbs"?1100:500} max={units.weight==="lbs"?7000:3200} step={10}/>
          <div>
            <span style={S.label}>Class & PI</span>
            <div style={{display:"flex",gap:4,marginBottom:5}}>
              {CLASSES.map(c=>(
                <button key={c.id} onClick={()=>handleCarClass(c.id)} style={{...S.btn,flex:1,padding:"4px 0",borderRadius:6,border:`1px solid ${carClass===c.id?accentColor:C.border}`,background:carClass===c.id?C.accentLo:"transparent",color:carClass===c.id?accentColor:C.muted,fontFamily:C.fBody,fontSize:9,fontWeight:carClass===c.id?600:400}}>
                  {c.id}
                </button>
              ))}
            </div>
            <input type="number" value={pi} onChange={e=>setPi(+e.target.value)} min={100} max={999}
              style={{width:"100%",...S.mono,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontSize:13,outline:"none"}}
            />
          </div>
        </div>

        {/* Weight distribution */}
        <WeightDistSlider value={weightDist} onChange={setWeightDist} color={accentColor}/>

        {/* Surface + Compound (D mode collapsed, S mode always shown) */}
        {isAdvanced && (
          <>
            <Seg label="Surface" opts={SURFACES} val={surface} set={setSurface} color={accentColor} onColor={onAccent}/>
            <div style={{marginBottom:10}}>
              <span style={S.label}>Tire compound</span>
              <select value={compound} onChange={e=>setCompound(e.target.value)}
                style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,fontFamily:C.fBody,fontSize:13,outline:"none"}}>
                {COMPOUNDS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Advanced mode extra inputs */}
        {isAdvanced && (
          <>
            {/* RPM scale picker */}
            <div style={{marginBottom:10}}>
              <span style={S.label}>RPM scale (from in-game graph)</span>
              <div style={{display:"flex",gap:4}}>
                {RPM_SCALES.map((s,i)=>(
                  <button key={i} onClick={()=>setRpmScale(i)} style={{...S.btn,flex:1,padding:"6px 2px",borderRadius:7,border:`1px solid ${rpmScale===i?accentColor:C.border}`,background:rpmScale===i?C.accentLo:"transparent",color:rpmScale===i?accentColor:C.muted,fontFamily:C.fBody,fontSize:10,fontWeight:rpmScale===i?600:400}}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <NumIn label="Redline RPM" value={redlineRpm} onChange={setRedlineRpm} unit="rpm" min={2000} max={RPM_SCALES[rpmScale]?.max||15000} step={100}/>
              <NumIn label="Peak torque RPM" value={peakTorqueRpm} onChange={setPeakTorqueRpm} unit="rpm" min={1000} max={redlineRpm} step={100}/>
              <NumIn label={`Max torque (${units.weight==="lbs"?"lb-ft":"Nm"})`} value={maxTorque} onChange={setMaxTorque} unit={units.weight==="lbs"?"lb-ft":"Nm"} min={50} max={2000} step={5}/>
              <NumIn label={`Top speed (${units.speed})`} value={topspeed} onChange={setTopspeed} unit={units.speed} min={50} max={320} step={5}/>
              <NumIn label="Number of gears" value={gears} onChange={setGears} min={4} max={10} step={1}/>
              <NumIn label="Car height (mm)" value={carHeight} onChange={setCarHeight} unit="mm" min={900} max={2200} step={10} hint="From car specs — affects ARB roll moment calc"/>
            </div>
            {/* Tire sizes — front and rear, supports staggered rim diameters */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={S.label}>Tire sizes</span>
                {tireRimF!==tireRim&&<span style={{fontSize:9,color:accentColor,fontFamily:C.fBody,letterSpacing:"0.06em"}}>STAGGERED</span>}
              </div>
              {/* Front */}
              <div style={{marginBottom:8}}>
                <span style={{fontSize:10,color:C.muted,fontFamily:C.fBody,letterSpacing:"0.08em",textTransform:"uppercase",display:"block",marginBottom:4}}>Front</span>
                <div style={{display:"grid",gridTemplateColumns:"2fr auto 1fr auto 1fr",gap:5,alignItems:"center"}}>
                  <input type="number" value={tireWF} onChange={e=>setTireWF(e.target.value)}
                    style={{...S.mono,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 6px",color:C.text,fontSize:13,outline:"none",textAlign:"center",minWidth:0}}/>
                  <span style={{color:C.dim,fontSize:13,textAlign:"center"}}>/</span>
                  <input type="number" value={tireARF} onChange={e=>setTireARF(e.target.value)}
                    style={{...S.mono,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 6px",color:C.text,fontSize:13,outline:"none",textAlign:"center",minWidth:0}}/>
                  <span style={{color:C.dim,fontSize:13,textAlign:"center"}}>R</span>
                  <input type="number" value={tireRimF} onChange={e=>setTireRimF(e.target.value)}
                    style={{...S.mono,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 6px",color:tireRimF!==tireRim?accentColor:C.text,fontSize:13,outline:"none",textAlign:"center",minWidth:0,fontWeight:tireRimF!==tireRim?"600":"400"}}/>
                </div>
              </div>
              {/* Rear */}
              <div>
                <span style={{fontSize:10,color:C.muted,fontFamily:C.fBody,letterSpacing:"0.08em",textTransform:"uppercase",display:"block",marginBottom:4}}>Rear — used for gearing calc</span>
                <div style={{display:"grid",gridTemplateColumns:"2fr auto 1fr auto 1fr",gap:5,alignItems:"center"}}>
                  <input type="number" value={tireWR} onChange={e=>setTireWR(e.target.value)}
                    style={{...S.mono,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 6px",color:C.text,fontSize:13,outline:"none",textAlign:"center",minWidth:0}}/>
                  <span style={{color:C.dim,fontSize:13,textAlign:"center"}}>/</span>
                  <input type="number" value={tireAR} onChange={e=>setTireAR(e.target.value)}
                    style={{...S.mono,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 6px",color:C.text,fontSize:13,outline:"none",textAlign:"center",minWidth:0}}/>
                  <span style={{color:C.dim,fontSize:13,textAlign:"center"}}>R</span>
                  <input type="number" value={tireRim} onChange={e=>setTireRim(e.target.value)}
                    style={{...S.mono,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 6px",color:tireRimF!==tireRim?accentColor:C.text,fontSize:13,outline:"none",textAlign:"center",minWidth:0,fontWeight:tireRimF!==tireRim?"600":"400"}}/>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-around",marginTop:4}}>
                <span style={{fontSize:9,color:C.dim}}>width mm</span>
                <span style={{fontSize:9,color:C.dim}}></span>
                <span style={{fontSize:9,color:C.dim}}>aspect %</span>
                <span style={{fontSize:9,color:C.dim}}></span>
                <span style={{fontSize:9,color:C.dim}}>rim in</span>
              </div>
            </div>

            {/* Aero toggle */}
            <div style={{...S.card,padding:"10px 12px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:hasAero?10:0}}>
                <span style={{fontFamily:C.fBody,fontSize:13,color:C.text}}>Aero package</span>
                <div style={{display:"flex",gap:4}}>
                  {["Yes","No"].map(v=>(
                    <button key={v} onClick={()=>setHasAero(v==="Yes")} style={{...S.btn,padding:"4px 10px",borderRadius:6,border:`1px solid ${(hasAero&&v==="Yes")||(!hasAero&&v==="No")?accentColor:C.border}`,background:(hasAero&&v==="Yes")||(!hasAero&&v==="No")?C.accentLo:"transparent",color:(hasAero&&v==="Yes")||(!hasAero&&v==="No")?accentColor:C.muted,fontFamily:C.fBody,fontSize:11}}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {hasAero&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <NumIn label="Front downforce (kg)" value={aeroF} onChange={setAeroF} unit="kg" min={0} max={500} step={5}/>
                  <NumIn label="Rear downforce (kg)" value={aeroR} onChange={setAeroR} unit="kg" min={0} max={500} step={5}/>
                </div>
              )}
            </div>

            {/* Gearing toggle */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",...S.card,padding:"10px 12px",marginBottom:10}}>
              <div>
                <div style={{fontFamily:C.fBody,fontSize:13,color:C.text}}>Include gearing tune</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>Requires RPM + top speed data</div>
              </div>
              <div style={{display:"flex",gap:4}}>
                {["Yes","No"].map(v=>(
                  <button key={v} onClick={()=>setIncludeGearing(v==="Yes")} style={{...S.btn,padding:"4px 10px",borderRadius:6,border:`1px solid ${(includeGearing&&v==="Yes")||(!includeGearing&&v==="No")?accentColor:C.border}`,background:(includeGearing&&v==="Yes")||(!includeGearing&&v==="No")?C.accentLo:"transparent",color:(includeGearing&&v==="Yes")||(!includeGearing&&v==="No")?accentColor:C.muted,fontFamily:C.fBody,fontSize:11}}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Generate button — fixed at bottom */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,padding:"10px 14px 20px",background:`linear-gradient(0deg,${C.bg} 60%,transparent)`,pointerEvents:"none"}}>
        <button onClick={handleGenerate} disabled={loading}
          style={{...S.btn,width:"100%",padding:"15px",pointerEvents:"auto",background:`${accentColor}14`,border:`1px solid ${accentColor}44`,borderRadius:6,color:accentColor,fontFamily:C.fCond,fontSize:16,fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",boxShadow:"none"}}>
          {loading?"Calculating…":"Deploy Setup"}
        </button>
        {!isAdvanced && <div style={{textAlign:"center",marginTop:5,fontSize:10,color:C.dim,pointerEvents:"auto"}}>Switch to S mode for gearing + RPM-based math</div>}
      </div>
    </div>
  );
}
