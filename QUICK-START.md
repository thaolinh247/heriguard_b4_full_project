# Phase A — Quick Start Test

## 🚀 Run Mock Patrol Right Now

### Step 1: Launch App
```bash
cd c:\heri\heriguard-app
npx expo run:android
```

### Step 2: Enable Mock BLE
- Tap **Settings** tab
- Toggle **"Mock BLE"** ON
- Wait for connection: "HERI-GUARD-01 connected"

### Step 3: Start Patrol
- Tap **Dashboard** tab  
- Press **"Start Patrol"** button
- Watch 6 nodes appear with mock detections
- Wait ~20 seconds for patrol to complete
- Console should show: `[MockBLE] Patrol 1 completed`

### Step 4: Close & Reopen App
- Swipe app from recent apps (kill completely)
- Wait 2 seconds
- Tap app icon to reopen
- Watch console: `[PatrolStore] Loaded X persisted patrols`

### Step 5: Verify Data Persists
- Tap **History** tab (if you have one, or check patrolStore in console)
- Should see patrol from Step 3 with all 6 nodes
- Images still visible ✅

### Step 6: Run 2nd Patrol (Optional)
- Tap **Start Patrol** again
- After completion, close & reopen app
- Now you have 2 patrols
- Console: `[PatrolStore] Loaded 2 persisted patrols`
- Same images per node + growing detections (trend demo)

---

## 📊 Expected Results

### After 1st Patrol
```
Documents/heriguard/patrols/
└── patrol-1724000000/
    ├── node_0/
    │   └── shot_0_0000.jpg
    ├── node_1/
    │   └── shot_0_0100.jpg
    ... (nodes 2-5)
    └── patrol.json  ← Manifest with metadata
```

### patrol.json Content
```json
{
  "id": "patrol-1724000000",
  "startTime": "2026-08-14T10:30:00Z",
  "endTime": "2026-08-14T10:30:20Z",
  "images": [
    {
      "uri": "file://Documents/heriguard/patrols/patrol-1724000000/node_0/shot_0_0000.jpg",
      "frameId": 0,
      "nodeX2": 0,
      "shotKind": 0,
      "timestamp": "2026-08-14T10:30:00Z",
      "temperature": 28.5,
      "humidity": 62.3,
      "detection": null,
      "analysis": null
    },
    {
      "uri": "file://Documents/heriguard/patrols/patrol-1724000000/node_3/shot_0_0300.jpg",
      "frameId": 300,
      "nodeX2": 3,
      "shotKind": 0,
      "timestamp": "2026-08-14T10:30:09Z",
      "temperature": 29.1,
      "humidity": 61.8,
      "detection": {
        "label": "crack_small",
        "confidence": 0.68,
        "bbox": { "x": 40, "y": 30, "width": 30, "height": 20 }
      },
      "analysis": {
        "severity": "low",
        "crackArea": 2.47,
        "confidence": 68,
        "findings": "Phát hiện: crack_small (68%) | Diện tích ~2.5%"
      }
    }
  ],
  "mapMarkers": [...],
  "detections": [...],
  "sensorLogs": [...]
}
```

### After 2nd Patrol + Restart
```
patrolStore.patrols = [
  {
    id: "patrol-1724000000",
    images: [{node_0, node_1, ..., node_3 area: 2.5%}, ...],
    ...
  },
  {
    id: "patrol-1724003600",
    images: [{node_0, node_1, ..., node_3 area: 4.0%}, ...],  ← Larger!
    ...
  }
]
```

Console:
```
[PatrolStore] Loaded 2 persisted patrols
```

---

## 🔍 Verify Manually (ADB)

### Check Folder Structure
```bash
adb shell
cd /data/data/com.anonymous.heriguardapp/files/Documents/heriguard/patrols
ls -la
# Should show: patrol-{timestamp}/
```

### View patrol.json
```bash
adb pull /data/data/com.anonymous.heriguardapp/files/Documents/heriguard/patrols/patrol-{TIMESTAMP}/patrol.json
cat patrol.json
```

---

## 🧪 Test Comparison Logic (Console)

```javascript
// Open Chrome DevTools: chrome://inspect/#devices
// Find app, click "inspect"

// In console, run:
const { usePatrolStore } = require("@/store/patrolStore");
const { getNodeTimeline, compareNodeImages, findPreviousImage } = require("@/lib/compare");

const store = usePatrolStore.getState();
const patrols = store.patrols;
console.log("Total patrols:", patrols.length); // Should be 2

// Patrol 1 node 3
const patrol1 = patrols[0];
const node3_patrol1 = patrol1.images.find(img => img.nodeX2 === 3);
console.log("Patrol 1 node 3 area:", node3_patrol1.analysis?.crackArea);
// → ~2.5%

// Patrol 2 node 3
const patrol2 = patrols[1];
const node3_patrol2 = patrol2.images.find(img => img.nodeX2 === 3);
console.log("Patrol 2 node 3 area:", node3_patrol2.analysis?.crackArea);
// → ~4.0%

// Compare
const comparison = compareNodeImages({
  current: node3_patrol2,
  previous: node3_patrol1,
  previousPatrol: patrol1,
});
console.log("Delta area:", comparison.deltaAreaPercent);
// → +43% 
console.log("Trend:", comparison.trend);
// → "increasing"
console.log("Summary:", comparison.summary);
// → "📈 Tăng 43% — cần chú ý"
```

---

## ✅ Success Checklist

- [ ] App launches without errors
- [ ] Mock BLE connects successfully
- [ ] 1st patrol completes, folder structure created ✅
- [ ] patrol.json contains all metadata ✅
- [ ] App closes completely, then reopens
- [ ] Patrols load from disk (console: "Loaded X patrols") ✅
- [ ] 2nd patrol has SAME node images (mock consistency) ✅
- [ ] 2nd patrol has LARGER detections (trend demo) ✅
- [ ] Comparison shows ~43% growth + "📈" trend ✅

---

## 📝 Console Logs to Expect

```
✅ [PatrolStore] Loaded 0 persisted patrols  (first app start)
✅ [MockBLE] Started
✅ [MockBLE] Starting mock patrol 1
✅ [MockBLE] Generated node 0 image
✅ [MockBLE] Generated node 1 image
✅ [MockBLE] Generated node 2 image
✅ [MockBLE] Generated node 3 image
✅ [MockBLE] Generated node 4 image
✅ [MockBLE] Generated node 5 image
✅ [MockBLE] Patrol 1 completed
✅ [PatrolStore] Loaded 1 persisted patrols  (after restart)
✅ [MockBLE] Starting mock patrol 2
✅ [MockBLE] Generated node 0 image  (SAME URI as patrol 1)
✅ [MockBLE] Generated node 3 image  (LARGER bbox)
✅ [MockBLE] Patrol 2 completed
✅ [PatrolStore] Loaded 2 persisted patrols  (after 2nd restart)
```

---

## 🐛 Troubleshooting

**Problem:** App crashes on patrol start
- Check: no TypeScript errors (should show 0 errors)
- Check: Mock BLE is toggled ON
- Check: Console for error stack trace

**Problem:** Folder not created
- Check: Permission to write to Documents (Expo handles this)
- Check: savePatrolImage() is being called in ble.ts
- Run: `adb logcat | grep -i "file\|error"` for file errors

**Problem:** patrol.json not found
- Check: updatePatrolJson() is called in patrolStore.endPatrol()
- Check: File write didn't fail silently
- Run: `adb shell ls -la /data/data/com.anonymous.heriguardapp/files/Documents/heriguard/patrols/`

**Problem:** Data lost after restart
- Check: _layout.tsx has useEffect with loadPersistedHistory()
- Check: Console shows "Loaded X persisted patrols" on app start
- Check: patrol.json is still on disk (use `adb pull`)

---

## 🎯 What This Demo Proves

✅ **Persistence** — Data survives app restart (solves Edge AI challenge)  
✅ **Organization** — Images stored by node (enables queries)  
✅ **Linkage** — Detections linked to images (context preserved)  
✅ **Comparison** — Can compare same node across patrols (trend detection)  
✅ **Mock Demo** — Consistent images + growing detection (early UI testing)  

→ Phase A MVP Complete. Ready for Phase B (firmware) and Phase C (real robot).

---

## Next Steps After Testing

If all checks pass ✅:
1. Document any findings in [PHASE-A-TESTING.md](./PHASE-A-TESTING.md)
2. Move to Phase B: Firmware BLE header upgrades (heriguard-robot/src/main.cpp)
3. Implement Phase C: UI History screen with comparison chart

If issues found ❌:
1. Check console errors
2. Verify file paths with ADB
3. Run compilation: `npx expo start` (should show 0 errors)
