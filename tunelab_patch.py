#!/usr/bin/env python3
"""
TuneLab patch - run from ~/tunelab:
  python3 /tmp/tunelab_patch.py
"""
import sys, os

src = "src/App.jsx"
if not os.path.exists(src):
    print("ERROR: run from ~/tunelab directory"); sys.exit(1)

with open(src,"r") as f: c = f.read()
orig_len = len(c.splitlines())
print(f"Base: {orig_len} lines")

changes = 0

# ═══════════════════════════════════════════════════════════════
# FIX 1: HAPTICS — inject vibrate directly into touch handlers
# Android WebView vibrate MUST be called synchronously from a
# touch/click event. Can't be async, can't be delayed.
# ═══════════════════════════════════════════════════════════════

# Add vibrate utility at top of file (after imports)
VIBRATE_UTIL = """
// ── Haptics: called synchronously from touch events ──────────
const vib = (ms=15) => { try{ navigator.vibrate?.(ms); }catch{} };
"""
if "const vib = " not in c:
    # Insert after the first const C = { block
    idx = c.find("const C = {")
    if idx > 0:
        c = c[:idx] + VIBRATE_UTIL + c[idx:]
        changes += 1
        print("✓ 1a. Vibrate utility added")

# Wire vib() into generate button click (synchronous, before async)
old_gen = "const handleGenerate = async () => {\n    if(!allVisited||loading) return;"
new_gen = "const handleGenerate = async () => {\n    if(!allVisited||loading) return;\n    vib(40);"
if old_gen in c and "vib(40)" not in c:
    c = c.replace(old_gen, new_gen); changes += 1
    print("✓ 1b. Haptic on generate")

# Wire vib() into tab switching
old_tab = "const goTab = t => { setTab(t);"
new_tab = "const goTab = t => { vib(8); setTab(t);"
if old_tab in c and "vib(8)" not in c:
    c = c.replace(old_tab, new_tab); changes += 1
    print("✓ 1c. Haptic on tab switch")

# Wire vib() into Pill component click
old_pill = "function Pill({label,selected,onClick,color,icon,small}) {\n  return <button onClick={onClick}"
new_pill = "function Pill({label,selected,onClick,color,icon,small}) {\n  return <button onClick={()=>{vib(8);onClick();}}"
if old_pill in c:
    c = c.replace(old_pill, new_pill); changes += 1
    print("✓ 1d. Haptic on pill/chip")

# ═══════════════════════════════════════════════════════════════
# FIX 2: SCROLL LAYOUT — make header+tabbar not overlap content
# The sticky header overlaps because the page scrolls but the
# header stays fixed. Fix: use padding-top on content div to
# account for the header height so content starts below it.
# ═══════════════════════════════════════════════════════════════

# The main content div currently has padding:"14px 16px 130px"
# We need to add scroll-margin-top to push it below the header
# Simplest fix: make header NOT sticky, just let it scroll normally
# The generate button is already fixed at bottom so that's fine.

old_header_style = 'padding:"12px 16px 8px",background:`linear-gradient(180deg,${color}0c 0%,transparent 100%)`,borderBottom:`1px solid ${C.border}`}}'
new_header_style = 'position:"sticky",top:0,zIndex:20,padding:"12px 16px 8px",background:`linear-gradient(180deg,${color}18 0%,${C.bg}f5 100%)`,borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(8px)"}'
if old_header_style in c:
    c = c.replace(old_header_style, new_header_style); changes += 1
    print("✓ 2a. Header sticky with blur backdrop")

# Make tab bar also sticky, just below header
old_tabbar_style = 'display:"flex",background:C.panel,borderBottom:`1px solid ${C.border}`}}'
new_tabbar_style = 'display:"flex",background:C.panel,borderBottom:`1px solid ${C.border}`,position:"sticky",top:92,zIndex:19}'
if old_tabbar_style in c:
    c = c.replace(old_tabbar_style, new_tabbar_style); changes += 1
    print("✓ 2b. Tab bar sticky below header")

# ═══════════════════════════════════════════════════════════════
# FIX 3: ICON SIZES — increase by ~50% across the app
# ═══════════════════════════════════════════════════════════════

# Header buttons: fontSize:11 -> 18
old_hdr_btn = 'fontFamily:"\'Orbitron\',sans-serif",fontSize:11,cursor:"pointer"}}>{b.label}'
new_hdr_btn = 'fontFamily:"\'Orbitron\',sans-serif",fontSize:18,cursor:"pointer"}}>{b.label}'
if old_hdr_btn in c:
    c = c.replace(old_hdr_btn, new_hdr_btn); changes += 1
    print("✓ 3a. Header button icons 18px")

# Tune mode pill icons: fontSize:10 -> 15
old_icon = '{icon&&<span style={{fontSize:10}}>{icon}</span>}'
new_icon = '{icon&&<span style={{fontSize:15}}>{icon}</span>}'
if old_icon in c:
    c = c.replace(old_icon, new_icon); changes += 1
    print("✓ 3b. Pill icons 15px")

# Tab bar font: fontSize:8 -> 11
old_tab_font = '"fontSize:8,letterSpacing:"0.08em",textTransform:"uppercase"'
new_tab_font = '"fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase"'
c = c.replace(old_tab_font, new_tab_font)

# Try alternate format
old_tab_font2 = 'fontSize:8,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer"'
new_tab_font2 = 'fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer"'
if old_tab_font2 in c:
    c = c.replace(old_tab_font2, new_tab_font2); changes += 1
    print("✓ 3c. Tab bar font 11px")

# ═══════════════════════════════════════════════════════════════
# FIX 4: SHARE — use native Android share sheet
# ═══════════════════════════════════════════════════════════════
old_share = "navigator.share?.({title:\"TuneLab Tune\",text:txt})||navigator.clipboard?.writeText(txt).then(()=>setToast(\"Copied!\"));"
new_share = "if(navigator.share){navigator.share({title:`TuneLab — ${make} ${model}`,text:txt}).catch(()=>{});}else{navigator.clipboard?.writeText(txt).then(()=>setToast(\"Copied!\"));}"
if old_share in c:
    c = c.replace(old_share, new_share); changes += 1
    print("✓ 4. Native share sheet")

# ═══════════════════════════════════════════════════════════════
# FIX 5: DUPLICATE TuneRating — remove second instance
# ═══════════════════════════════════════════════════════════════
RATING_MARKER = "tuneGenerated&&!loading&&<TuneRating"
count = c.count(RATING_MARKER)
if count > 1:
    # Remove the second occurrence by finding it and removing the line
    first = c.find(RATING_MARKER)
    second = c.find(RATING_MARKER, first + 10)
    if second > 0:
        line_start = c.rfind("\n", 0, second)
        line_end = c.find("\n", second)
        c = c[:line_start] + c[line_end:]
        changes += 1
        print("✓ 5. Duplicate TuneRating removed")

# ═══════════════════════════════════════════════════════════════
# FIX 6: Safe area inset for status bar
# ═══════════════════════════════════════════════════════════════
# Already handled above by making header sticky with proper bg

# ═══════════════════════════════════════════════════════════════
# WRITE OUTPUT
# ═══════════════════════════════════════════════════════════════
with open(src,"w") as f: f.write(c)
print(f"\n{'='*50}")
print(f"Applied {changes} changes. Lines: {orig_len} → {len(c.splitlines())}")
print("Now run: npm run build && npx cap sync android")
