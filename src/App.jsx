import { useState, useEffect, useCallback, Component } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const VERSION       = "1.4.7";
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
  freqMult: {
    Race:    {f:1.00, r:0.92},
    Touge:   {f:0.98, r:0.90},
    Drift:   {f:0.80, r:0.73},
    Rally:   {f:0.62, r:0.57},
    Drag:    {f:0.90, r:0.68},
    Wangan:  {f:0.94, r:0.88},
    Rain:    {f:0.77, r:0.72},
    General: {f:0.87, r:0.83},
  },
  dampRebound:      0.68,  // fraction of critical damping — rebound
  dampBump:         0.50,  // fraction of critical damping — bump
  horizonDampMult:  1.15,  // FH5/FH6 planted physics correction
  casterBase:       5.0,   // degrees at D-class
  casterPIScale:    900,   // (PI-100)/casterPIScale added to base
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
  {id:"R",  range:[901,998]},
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
  const baseFreq = 6.79e-7 * Math.pow(piNum - 100, 2) + 2.45;

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

  // ── ARB — roll moment method (ForzaTune: 0.381 × height = CG estimate)
  const pwr2wtNorm = Math.min(1, pwr2wt / 800);
  // If car height is provided, use roll-moment math; otherwise fall back to pwr2wt
  const cgHeight   = carHeight ? 0.381 * carHeight : null; // mm
  // Roll moment normalised 0–1: a 1500mm SUV ≈ 1.0, a 1100mm supercar ≈ 0.5
  const rollNorm   = cgHeight ? Math.min(1, cgHeight / 600) : 0.5 + pwr2wtNorm * 0.3;

  // ARB: FH6 community standard — "1/65 is practically a meme" for AWD
  // Soft front = more rotation, stiff rear = stability. Min-front/max-rear for AWD.
  // FWD/RWD: max both. Drift: vary for angle. Rally: moderate both for travel.
  let fARB, rARB;
  if (isDrift) {
    fARB = 15 + rollNorm * 10; rARB = 35 + rollNorm * 15; // moderate for angle control
  } else if (isDrag) {
    fARB = 45; rARB = 45; // balanced for straight line
  } else if (isRally) {
    fARB = 8 + rollNorm * 6; rARB = 20 + rollNorm * 8; // soft for surface compliance
  } else if (isRain || isSnow) {
    fARB = 5; rARB = 15; // very soft for grip
  } else {
    // Race / Touge / Wangan / General
    if (isAWD) { fARB = 1 + rollNorm*4;  rARB = 55 + rollNorm*10; } // 1/65 meta
    else if (isFWD) { fARB = 50; rARB = 60; } // max both for FWD
    else { fARB = 8 + rollNorm*8; rARB = 55 + rollNorm*10; } // RWD: soft front for rotation
  }
  // Feel adjuster — aggression raises rear ARB, lowers front
  const arbFeel = (feelAggression - 50) / 8;
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
  const brakePressure = isDrift ? 90 : isDrag ? 120 : isRain||isSnow ? 100 : isRally ? 100 : 100;
  const trailRating   = isDrift ? 6 : isDrag ? 3 : isRain ? 7 : isRally ? 6 : isWheel ? 9 : 7;

  // ── DIFF
  const pN = pwr2wtNorm;
  let fAccel=0,fDecel=0,rAccel=0,rDecel=0,center=0;
  if (isFWD) {
    fAccel = isDrift?85:isDrag?90:isRally?70:60; fDecel = isDrift?0:isDrag?15:20;
  } else if (isRWD) {
    rAccel = isDrift?85:isDrag?95:isRally?65:Math.round(50+pN*20);
    rDecel = isDrift?35:isDrag?5:isRally?25:20;
  } else {
    fAccel = isDrift?35:isDrag?20:isRally?55:40; fDecel = isDrift?0:isDrag?5:isRally?20:15;
    rAccel = isDrift?80:isDrag?95:isRally?70:Math.round(55+pN*15);
    rDecel = isDrift?30:isDrag?5:isRally?30:20;
    center = isDrift?35:isDrag?20:isRally?55:45;
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
      {key:"Front Width",    value:`${tireWF}mm`},
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

    Diff: { values: diffValues, tip: isDrift?"High rear accel keeps the slide going. Adjust decel for entry rotation.":isFWD?"High front accel causes torque steer — balance traction vs speed.":"Rear accel controls exit traction. Center balance shifts torque character." },
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
  label:  { fontFamily:C.fMono, fontSize:9, color:C.muted, letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:6, display:"block" },
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
              <div style={{fontFamily:C.fCond,fontSize:15,fontWeight:700,letterSpacing:"0.04em",color:active?C.text:C.ice2,lineHeight:1.1}}>{m.label}</div>
              <div style={{fontFamily:C.fBody,fontSize:11,fontWeight:300,color:active?m.color+"aa":C.muted,marginTop:3}}>{m.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Slider({label, value, onChange, min=0, max=100, leftLabel, rightLabel, color=C.accent}) {
  const pct = ((value-min)/(max-min))*100;
  return (
    <div style={{marginBottom:10}}>
      {label && <span style={S.label}>{label}</span>}
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(+e.target.value)}
        style={{width:"100%",accentColor:color,height:3,cursor:"pointer"}}
      />
      {(leftLabel||rightLabel) && (
        <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
          <span style={{fontFamily:C.fBody,fontSize:12,color:C.dim}}>{leftLabel}</span>
          <span style={{fontFamily:C.fBody,fontSize:12,color:C.dim}}>{rightLabel}</span>
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
      <style>{FONTS + `*{box-sizing:border-box}`}</style>
      <div style={{padding:"calc(env(safe-area-inset-top, 0px) + 32px) 20px 20px"}}>
        <div style={{fontSize:28,fontWeight:600,color:C.accent,marginBottom:4}}>TuneLab</div>
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
                    {row.note&&<div style={{fontFamily:C.fBody,fontSize:11,fontWeight:300,color:C.muted,marginTop:3,lineHeight:1.5}}>{row.note}</div>}
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
            <div style={{...S.card,padding:"12px 13px",marginBottom:10}}>
              <div style={{fontSize:12,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Feel adjuster</div>
              <Slider value={feelBalance} onChange={v=>{setFeelBalance(v);recalc(v,feelAggress);}} leftLabel="Stable (recommended)" rightLabel="Tail-happy" color={color}/>
              <Slider value={feelAggress} onChange={v=>{setFeelAggress(v);recalc(feelBalance,v);}} leftLabel="Planted" rightLabel="Aggressive" color={color}/>
              <div style={{fontSize:12,color:C.dim,marginTop:4}}>FH6 rewards stable, planted setups. Adjust from there to suit your style.</div>
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
function AboutScreen({onClose}) {
  const [confirmNuke, setConfirmNuke] = useState(false);
  const [nuked,       setNuked]       = useState(false);
  const [fbStep,      setFbStep]      = useState("idle");
  const [fbType,      setFbType]      = useState("bug");
  const [fbText,      setFbText]      = useState("");

  const doNuke = () => {
    localStorage.clear();
    setNuked(true);
    setTimeout(()=>window.location.reload(), 1200);
  };

  const sendFeedback = () => {
    const sub  = encodeURIComponent(`TuneLab ${VERSION} — ${fbType}`);
    const body = encodeURIComponent(`Type: ${fbType}\n\n${fbText}\n\n---\nSent from TuneLab ${VERSION}`);
    window.open(`mailto:tunelab.dev@gmail.com?subject=${sub}&body=${body}`,"_blank");
    setFbStep("sent");
  };

  const links = [
    ...(PLAY_STORE?[{icon:"📱", label:"Play Store",        desc:"Rate us — helps other tuners find TuneLab", color:C.green,   url:PLAY_STORE}]:[]),
    {icon:"☕", label:"Buy me a coffee",   desc:"Ko-fi — free forever, tips appreciated",   color:"#ffcc44", url:KOFI_URL},
    {icon:"💬", label:"Discord server",    desc:"Share tunes, get help, vote on features",  color:"#5865f2", url:DISCORD_URL},
    {icon:"🐙", label:"GitHub",            desc:"Open source — bugs, features, source code",color:"#e2e4f0", url:GITHUB_URL},
    {icon:"🔒", label:"Privacy policy",    desc:"What data we store and why",               color:"#888899", url:`${GITHUB_URL}/blob/main/privacy.md`},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:400,maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column",fontFamily:C.fBody,overflowY:"auto"}}>
      <style>{FONTS+THEME_STYLE}</style>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"calc(env(safe-area-inset-top, 0px) + 14px) 16px 14px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onClose} style={{background:"transparent",border:"none",color:C.text,fontSize:22,cursor:"pointer",padding:0,lineHeight:1}}>←</button>
        <span style={{fontSize:13,fontWeight:600,color:C.text,letterSpacing:"0.06em"}}>ABOUT & SETTINGS</span>
        <span style={{marginLeft:"auto",fontFamily:C.fMono,fontSize:10,color:C.dim}}>v{VERSION}</span>
      </div>

      <div style={{padding:"16px 16px 60px",display:"flex",flexDirection:"column",gap:12}}>

        {/* App info */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px",textAlign:"center"}}>
          <div style={{fontFamily:C.fMono,fontSize:22,fontWeight:500,color:C.accent,marginBottom:4}}>
            Tune<span style={{color:C.text}}>Lab</span>
          </div>
          <div style={{fontSize:12,color:C.muted,marginBottom:2}}>AI-assisted Forza Horizon 6 tuning</div>
          <div style={{fontSize:10,color:C.dim}}>v{VERSION} · Free forever · No ads · No paywall</div>
          <div style={{fontSize:10,color:C.dim,marginTop:2}}>Physics: FH5-baseline · Updated post-FH6 launch</div>
          {(()=>{const u=LS.get("tl_v1_ai_usage",{total:0});return u.total>0?<div style={{fontSize:11,color:C.green,marginTop:4}}>✦ {u.total} AI enhance{u.total===1?"":"s"} used on this device</div>:null;})()}
        </div>

        {/* Links */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          {links.map((l,i)=>(
            <a key={l.label} href={l.url} target="_blank" rel="noreferrer"
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:i<links.length-1?`1px solid ${C.border}`:"none",textDecoration:"none"}}>
              <span style={{fontSize:18,width:24,textAlign:"center"}}>{l.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:15,color:C.text,fontWeight:500}}>{l.label}</div>
                <div style={{fontSize:13,color:C.muted,marginTop:1}}>{l.desc}</div>
              </div>
              <span style={{fontSize:12,color:C.dim}}>↗</span>
            </a>
          ))}
        </div>

        {/* Feedback */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px"}}>
          <div style={{fontSize:12,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Send feedback</div>
          {fbStep==="idle"&&(
            <button onClick={()=>setFbStep("form")} style={{width:"100%",padding:"11px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,fontFamily:C.fBody,fontSize:12,cursor:"pointer"}}>
              ✉ Report bug / request feature
            </button>
          )}
          {fbStep==="form"&&(
            <>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                {["bug","feature","tune feedback","other"].map(t=>(
                  <button key={t} onClick={()=>setFbType(t)} style={{padding:"4px 10px",borderRadius:7,border:`1px solid ${fbType===t?C.accent:C.border}`,background:fbType===t?C.accentLo:"transparent",color:fbType===t?C.accent:C.muted,fontFamily:C.fBody,fontSize:11,cursor:"pointer",textTransform:"capitalize"}}>
                    {t}
                  </button>
                ))}
              </div>
              <textarea value={fbText} onChange={e=>setFbText(e.target.value)} placeholder="Describe the issue or idea…" rows={3}
                style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 11px",color:C.text,fontFamily:C.fBody,fontSize:12,resize:"vertical",outline:"none",marginBottom:8}}
              />
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                <button onClick={()=>setFbStep("idle")} style={{padding:"10px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontFamily:C.fBody,fontSize:11,cursor:"pointer"}}>Cancel</button>
                <button onClick={sendFeedback} style={{padding:"10px",background:C.accentLo,border:`1px solid ${C.accent}55`,borderRadius:8,color:C.accent,fontFamily:C.fBody,fontSize:11,fontWeight:600,cursor:"pointer"}}>Send ✉</button>
              </div>
            </>
          )}
          {fbStep==="sent"&&(
            <div style={{textAlign:"center",padding:"8px 0"}}>
              <div style={{fontSize:20,marginBottom:6}}>✅</div>
              <div style={{fontSize:12,color:C.green,fontWeight:600}}>Feedback sent — thanks!</div>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div style={{background:C.card,border:`1px solid ${C.red}44`,borderRadius:12,padding:"14px"}}>
          <div style={{fontSize:10,color:C.red,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Danger zone</div>
          {!confirmNuke&&!nuked&&(
            <>
              <div style={{fontSize:12,color:C.muted,lineHeight:1.5,marginBottom:10}}>
                Wipes all saved tunes, AI keys, unit preferences, and resets the app to first launch. Cannot be undone.
              </div>
              <button onClick={()=>setConfirmNuke(true)} style={{width:"100%",padding:"11px",background:"transparent",border:`1px solid ${C.red}55`,borderRadius:9,color:C.red,fontFamily:C.fBody,fontSize:12,cursor:"pointer",fontWeight:500}}>
                🗑 Reset all data
              </button>
            </>
          )}
          {confirmNuke&&!nuked&&(
            <>
              <div style={{fontSize:13,color:C.text,marginBottom:12,lineHeight:1.5}}>Are you sure? This deletes everything including saved tunes and API keys.</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                <button onClick={()=>setConfirmNuke(false)} style={{padding:"11px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:9,color:C.muted,fontFamily:C.fBody,fontSize:12,cursor:"pointer"}}>Cancel</button>
                <button onClick={doNuke} style={{padding:"11px",background:C.red+"22",border:`1px solid ${C.red}`,borderRadius:9,color:C.red,fontFamily:C.fBody,fontSize:12,fontWeight:600,cursor:"pointer"}}>Yes, nuke it</button>
              </div>
            </>
          )}
          {nuked&&(
            <div style={{textAlign:"center",padding:"8px 0",fontSize:12,color:C.muted}}>Wiped. Reloading…</div>
          )}
        </div>

        {/* Legal */}
        <div style={{textAlign:"center",fontSize:10,color:C.dim,lineHeight:1.7,padding:"0 8px"}}>
          <div style={{marginBottom:8,color:C.muted,fontSize:11}}>With thanks to</div>
          <div style={{marginBottom:12,color:C.text,fontSize:12,fontWeight:500}}>Kireth</div>
          <div style={{fontSize:10,color:C.dim,lineHeight:1.6}}>Early FH6 physics feedback · youtube.com/@Kireth</div>
          <div style={{marginTop:12,fontSize:10,color:C.dim,lineHeight:1.7}}>
            TuneLab is not affiliated with Xbox, Turn 10, or Playground Games.<br/>
            Forza Horizon® is a registered trademark of Microsoft Corporation.
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const CAR_DB = {
  "Acura":["Integra Type R '01","NSX '17","RSX-S '02","NSX Type S '22"],
  "Alfa Romeo":["4C '13","Giulia QV '16","GTA '65","Montreal '70"],
  "Aston Martin":["DB11 V12 '16","DB5 '64","DBS Superleggera '18","Vulcan AMR Pro '17","Vantage '19","Valkyrie '23"],
  "Audi":["R8 V10 Plus '16","RS 6 Avant '20","RS3 Sedan '17","S1 '14","TT RS '18","Quattro '83","Sport Quattro '84"],
  "Bentley":["Continental GT Speed '21","Mulsanne Speed '17"],
  "BMW":["M2 Competition '20","M3 E30 '87","M3 E46 '01","M4 GTS '16","M5 CS '22","M8 Competition '20","2002 Turbo '73"],
  "Bugatti":["Chiron '18","Veyron SS '10","Divo '19","Bolide '21"],
  "Cadillac":["ATS-V '16","CT5-V Blackwing '22"],
  "Can-Am":["Maverick X RS Turbo R '18"],
  "Chevrolet":["Camaro SS '69","Camaro ZL1 '18","Corvette C8 '20","Corvette Grand Sport '17","Corvette Stingray '63"],
  "Dodge":["Challenger SRT Demon '18","Viper ACR '16","Charger SRT Hellcat '15"],
  "Ferrari":["488 Pista '19","812 Superfast '17","F40 '92","F50 '95","LaFerrari '13","SF90 Stradale '20","Enzo '02","250 GTO '62","F80 '25"],
  "Ford":["F-150 Raptor R '23","Focus RS '16","GT '17","GT '05","Mustang Shelby GT500 '20","Mustang Boss 302 '13","Sierra Cosworth RS500 '87"],
  "GMA":["T.50 '22"],
  "Honda":["Civic Type R '23","NSX '90","S2000 '09","Beat '91","City E II '84","Acty '94"],
  "Hyundai":["IONIQ 5 N '23"],
  "Koenigsegg":["Agera RS '17","Jesko '20","Regera '16","One:1"],
  "Lamborghini":["Aventador SVJ '19","Countach '88","Huracan STO '21","Huracan Sterrato '22","Murcielago LP 670 SV '09","Urus '18"],
  "Lancia":["037 Stradale '82","Delta HF Integrale '92","Stratos HF '73"],
  "Land Rover":["Defender 90 '15","Range Rover SVR '18"],
  "Lotus":["Elise Series 1 '96","Exige S '06","Evora GT430 '17"],
  "Maserati":["GranTurismo MC '13","MC20 '21"],
  "Mazda":["MX-5 Miata '16","MX-5 NA '90","RX-7 FD '97","RX-7 Spirit R '02"],
  "McLaren":["600LT '19","720S '17","F1 '93","P1 '13","Senna '18"],
  "Mercedes-AMG":["A 45 S '19","C 63 S Coupe '16","E 63 S '18","GT Black Series '21","GT R '17","SLS AMG '11","One '21"],
  "Mitsubishi":["Eclipse GSX '95","Lancer Evo VI '99","Lancer Evo X '07","3000GT VR-4 '92"],
  "Nissan":["370Z '09","GT-R Premium '17","GT-R Black Edition '12","Silvia S15 '02","Skyline GT-R R32 '89","Skyline GT-R R34 '99","Z '23"],
  "Pagani":["Huayra BC '16","Zonda Cinque '09","Utopia '23"],
  "Porsche":["718 Cayman GT4 '20","911 Carrera RS '73","911 GT2 RS '18","911 GT3 RS '22","918 Spyder '14","Cayenne Turbo S '20","Taycan Turbo S '20"],
  "Renault":["Clio V6 Phase 2 '03","Megane RS Trophy '19"],
  "RUF":["CTR3 '07","CTR Anniversary '17","Yellowbird '87"],
  "Shelby":["Cobra 427 S/C '65","Cobra Daytona Coupe '64"],
  "Subaru":["BRZ '21","Impreza 22B '98","WRX STI '04","WRX STI S209 '19"],
  "Toyota":["GR86 '22","GR Supra '20","GR Yaris '20","MR2 GT '95","Supra RZ '98"],
  "TVR":["Cerbera Speed 12","Sagaris '06"],
  "Volkswagen":["Golf R '14","Golf GTI Clubsport S '16","Polo GTI '18"],
  "Volvo":["240 Turbo '84","850 R '96","S60 Polestar '17"],
};
const MAKES = Object.keys(CAR_DB).sort();

export default function ForzaTuner() {
  const [screen,      setScreen]      = useState(()=>LS.get("tl_v1_done_units",false)?"main":"units");
  const [units,       setUnits]       = useState(()=>LS.get("tl_v1_units",{weight:"lbs",springs:"lbs/in",pressure:"psi",speed:"mph"}));
  const [inputDevice, setInputDevice] = useState(()=>LS.get("tl_v1_device","controller"));
  const [mode,        setMode]        = useState(()=>LS.get("tl_v1_mode","D")); // D or S
  const [overlay,     setOverlay]     = useState(null);
  const [toast,       setToast]       = useState(null);

  // Car inputs
  const [make,        setMake]        = useState("Nissan");
  const [model,       setModel]       = useState("GT-R Premium '17");
  const [carSearch,   setCarSearch]   = useState("");
  const [showSearch,  setShowSearch]  = useState(false);

  // Setup
  const [driveType,   setDriveType]   = useState("AWD");
  const [tuneId,      setTuneId]      = useState("Race");
  const [weight,      setWeight]      = useState(3836);
  const [weightDist,  setWeightDist]  = useState(48);
  const [pi,          setPi]          = useState(850);
  const [carClass,    setCarClass]    = useState("S1");
  const [surface,     setSurface]     = useState("Road");
  const [compound,    setCompound]    = useState("Race Slick"); // updated by mode selection

  // Advanced
  const [rpmScale,    setRpmScale]    = useState(0);   // index into RPM_SCALES
  const [redlineRpm,  setRedlineRpm]  = useState(7000);
  const [peakTorqueRpm,setPeakTorqueRpm] = useState(4400);
  const [maxTorque,   setMaxTorque]   = useState(547);
  const [topspeed,    setTopspeed]    = useState(180);
  const [gears,       setGears]       = useState(6);
  const [tireWF,      setTireWF]      = useState("255");
  const [tireWR,      setTireWR]      = useState("275");
  const [tireAR,      setTireAR]      = useState("35");
  const [tireRim,     setTireRim]     = useState("19");
  const [tireARF,     setTireARF]     = useState("35");
  const [tireRimF,    setTireRimF]    = useState("19");
  const [carHeight,   setCarHeight]   = useState(1300); // mm — typical sports car
  const [hasAero,     setHasAero]     = useState(true);
  const [aeroF,       setAeroF]       = useState(150);
  const [aeroR,       setAeroR]       = useState(220);
  const [dragCd,      setDragCd]      = useState(0.32);
  const [includeGearing,setIncludeGearing] = useState(true);

  // Output
  const [tunePages,   setTunePages]   = useState({});
  const [loading,     setLoading]     = useState(false);
  const [generated,   setGenerated]   = useState(false);

  const accentColor = TUNE_MODES.find(t=>t.id===tuneId)?.color||C.accent;
  // For bright mode colors (lime, yellow) use dark text; for dark ones use white
  const BRIGHT_MODES = ["Touge","Drag"]; // lime + electric yellow are bright
  const onAccent = BRIGHT_MODES.includes(tuneId) ? "#0a0c0f" : "#ffffff";

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
  const isAdvanced = mode==="S";

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,maxWidth:480,margin:"0 auto",fontFamily:C.fBody,display:"flex",flexDirection:"column"}}>
      <style>{FONTS+THEME_STYLE+`input[type=number]::-webkit-inner-spin-button{opacity:1}`}</style>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
      {overlay==="save"&&<SaveDrawer appState={getState()} tunePages={tunePages} onLoad={loadTune} onClose={()=>setOverlay(null)}/>}
      {overlay==="ai"&&<AIScreen onClose={()=>setOverlay(null)}/>}
      {overlay==="about"&&<AboutScreen onClose={()=>setOverlay(null)}/>}

      {/* Header */}
      <div style={{position:"sticky",top:0,zIndex:20,background:C.bg,borderBottom:`1px solid ${C.border}`,padding:"calc(env(safe-area-inset-top, 0px) + 10px) 14px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{lineHeight:1,position:"relative"}}>
          <div style={{position:"absolute",bottom:-8,left:0,right:0,height:1,background:"linear-gradient(90deg,rgba(0,255,133,0.2),transparent)"}}/>
          <div style={{fontFamily:C.fCond,fontSize:22,fontWeight:700,color:C.text,letterSpacing:"0.15em"}}><span style={{color:accentColor}}>Tune</span>Lab</div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`,animation:"pulse 2s infinite"}}/>
            <div style={{fontFamily:C.fMono,fontSize:8,color:C.muted,letterSpacing:"0.1em"}}>FH6 · <span style={{color:C.green}}>v{VERSION}</span></div>
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
          <span style={{fontSize:9,color:C.dim,fontFamily:C.fBody}}>
            {mode==="D"?"car + mode → tune, instant":"full RPM + gearing math"}
          </span>
        </div>
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>setOverlay("ai")} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:12}}>✦</button>
          <button onClick={()=>setOverlay("save")} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:14}}>💾</button>
          <button onClick={()=>setOverlay("about")} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:14}}>ℹ</button>
          <button onClick={()=>{LS.set("tl_v1_done_units",false);setScreen("units");}} style={{...S.btn,width:30,height:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,fontSize:12}}>⚙</button>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"10px 14px 130px"}}>

        {/* Car search */}
        <div style={{marginBottom:10,position:"relative"}}>
          {/* Manufacturer dropdown + search — two-step like ForzaDroid */}
          <div style={{display:"flex",gap:6,marginBottom:6}}>
            <select value={make} onChange={e=>{setMake(e.target.value);setModel(CAR_DB[e.target.value]?.[0]||"");setCarSearch("");}}
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
              <span style={{flex:1,fontFamily:C.fCond,fontSize:15,fontWeight:700,letterSpacing:"0.04em",color:C.text,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{make} {model}</span>
            )}
            <span style={{fontFamily:C.fMono,fontSize:10,color:accentColor,letterSpacing:"0.1em",flexShrink:0}}>{driveType}</span>
          </div>
          {showSearch && searchResults.length>0 && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:100,
              background:C.card,border:`1px solid ${C.border}`,borderRadius:4,
              marginTop:4,maxHeight:220,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
              {searchResults.map((r,i)=>(
                <div key={i} onMouseDown={()=>{setMake(r.make);setModel(r.model);setCarSearch("");setShowSearch(false);}}
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
          const surfaceDefaults = { Rally:"Dirt", Rain:"Road", General:"Road" };
          if(surfaceDefaults[id]) setSurface(surfaceDefaults[id]);
        }}/>

        {/* Weight + PI */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <NumIn label={`Weight (${units.weight})`} value={weight} onChange={setWeight} unit={units.weight} min={units.weight==="lbs"?1100:500} max={units.weight==="lbs"?7000:3200} step={10}/>
          <div>
            <span style={S.label}>Class & PI</span>
            <div style={{display:"flex",gap:4,marginBottom:5}}>
              {CLASSES.map(c=>(
                <button key={c.id} onClick={()=>setCarClass(c.id)} style={{...S.btn,flex:1,padding:"4px 0",borderRadius:6,border:`1px solid ${carClass===c.id?accentColor:C.border}`,background:carClass===c.id?C.accentLo:"transparent",color:carClass===c.id?accentColor:C.muted,fontFamily:C.fBody,fontSize:9,fontWeight:carClass===c.id?600:400}}>
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
          style={{...S.btn,width:"100%",padding:"15px",pointerEvents:"auto",background:`${accentColor}14`,border:`1px solid ${accentColor}44`,borderRadius:6,color:accentColor,fontFamily:C.fCond,fontSize:15,fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",boxShadow:"none"}}>
          {loading?"Calculating…":"Deploy Setup"}
        </button>
        {!isAdvanced && <div style={{textAlign:"center",marginTop:5,fontSize:10,color:C.dim,pointerEvents:"auto"}}>Switch to S mode for gearing + RPM-based math</div>}
      </div>
    </div>
  );
}
