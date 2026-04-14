#!/usr/bin/env python3
"""Run from ~/tunelab: python3 tunelab_patch2.py"""
import sys, os

src = "src/App.jsx"
if not os.path.exists(src):
    print("ERROR: run from ~/tunelab"); sys.exit(1)

with open(src,"r") as f: c = f.read()
print(f"Base: {len(c.splitlines())} lines")
changes = 0

# ── 1. Add vib() utility right before ForzaTuner component ──────────────────
VIB = "\n// Haptics — sync call required for Android WebView\nconst vib=(ms=15)=>{try{navigator.vibrate?.(ms);}catch{}};\n\n"
if "const vib=" not in c and "const vib =" not in c:
    c = c.replace("function ForzaTuner(){", VIB + "function ForzaTuner(){")
    changes += 1; print("✓ 1. vib() utility added")

# ── 2. Haptic on generate (sync, before async work) ─────────────────────────
old = "handleGenerate=async()=>{\n    if(!allVisited||loading)return;\n    setLoading(tru"
new = "handleGenerate=async()=>{\n    if(!allVisited||loading)return;\n    vib(40);\n    setLoading(tru"
if old in c and "vib(40)" not in c:
    c = c.replace(old, new); changes += 1; print("✓ 2. Haptic on generate")

# ── 3. Haptic on tab switch ──────────────────────────────────────────────────
old = "goTab    = t=>{setTab(t);setVisited(v=>new Set([...v,t]));};"
new = "goTab    = t=>{vib(8);setTab(t);setVisited(v=>new Set([...v,t]));};"
if old in c and "vib(8)" not in c:
    c = c.replace(old, new); changes += 1; print("✓ 3. Haptic on tab switch")

# ── 4. Haptic on Chip clicks ─────────────────────────────────────────────────
old = "function Chip({label,selected,onClick,color,icon,small}){\n  return <button onClick={onClick}"
new = "function Chip({label,selected,onClick,color,icon,small}){\n  return <button onClick={()=>{vib(8);onClick();}}"
if old in c:
    c = c.replace(old, new); changes += 1; print("✓ 4. Haptic on chip/pill")

# ── 5. Native share sheet (opens Discord, WhatsApp etc) ──────────────────────
old = 'navigator.share?.({title:"TuneLab Tune",text:t}).catch(()=>{})||navigator.clipboard?.writeText(t).then(()=>setToast("Copied!"));'
new = 'if(navigator.share){navigator.share({title:"TuneLab Tune",text:t}).catch(()=>{});}else{navigator.clipboard?.writeText(t).then(()=>setToast("Copied!"));}'
if old in c:
    c = c.replace(old, new); changes += 1; print("✓ 5. Native share sheet")

# Also fix the inline share button on tune tab if present
old2 = 'navigator.share?.({title:"TuneLab Tune",text:txt})||navigator.clipboard?.writeText(txt).then(()=>setToast("Copied!"));'
new2 = 'if(navigator.share){navigator.share({title:"TuneLab Tune",text:txt}).catch(()=>{});}else{navigator.clipboard?.writeText(txt).then(()=>setToast("Copied!"));}'
if old2 in c:
    c = c.replace(old2, new2); changes += 1; print("✓ 5b. Inline share button fixed")

# ── 6. Make tab bar sticky below the header ──────────────────────────────────
old = 'display:"flex",background:MD3.surfaceVar,borderBottom:`1px solid ${MD3.outline}`}}'
new = 'display:"flex",background:MD3.surfaceVar,borderBottom:`1px solid ${MD3.outline}`,position:"sticky",top:0,zIndex:19}'
if old in c and 'position:"sticky",top:0,zIndex:19' not in c:
    c = c.replace(old, new); changes += 1; print("✓ 6. Tab bar sticky")

# ── 7. Icon sizes — header buttons ───────────────────────────────────────────
# The header icon buttons use fontSize:11
old_icon = 'fontSize:11,cursor:"pointer"}}>⬇ Export JSON'
# That's in SaveDrawer, skip. Find the header buttons specifically.
# Header action buttons pattern
old_hbtn = 'borderRadius:20,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,flexShrink:0'
new_hbtn = 'borderRadius:22,width:46,height:46,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:22,flexShrink:0'
if old_hbtn in c:
    c = c.replace(old_hbtn, new_hbtn); changes += 1; print("✓ 7a. Header buttons 46px/22px")

# Chip icon size
old_chip_icon = '{icon&&<span style={{fontSize:small?10:12}}>{icon}</span>}'
new_chip_icon = '{icon&&<span style={{fontSize:small?14:17}}>{icon}</span>}'
if old_chip_icon in c:
    c = c.replace(old_chip_icon, new_chip_icon); changes += 1; print("✓ 7b. Chip icons 14/17px")

# Tab bar label font size
old_tab_sz = 'fontSize:10,fontWeight:tab===t.id?700:500,cursor:"pointer"'
new_tab_sz = 'fontSize:13,fontWeight:tab===t.id?700:500,cursor:"pointer"'
if old_tab_sz in c:
    c = c.replace(old_tab_sz, new_tab_sz); changes += 1; print("✓ 7c. Tab labels 13px")

with open(src,"w") as f: f.write(c)
print(f"\n{'='*50}")
print(f"Applied {changes} changes → {len(c.splitlines())} lines")
print("Run: npm run build && npx cap sync android")
