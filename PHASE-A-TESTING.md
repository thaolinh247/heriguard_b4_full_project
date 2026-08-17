# Phase A Testing Guide

## Objective
Verify that:
1. ✅ Images are saved to correct folder: `patrols/{patrolId}/node_{nodeX2}/shot_{kind}_{frameId}.jpg`
2. ✅ patrol.json manifest is created and persisted
3. ✅ Data survives app restart (loaded via `loadPersistedPatrols`)
4. ✅ Comparison logic works: findPrevious, computeDelta

---

## Manual Test Steps

### Test 1: Single Patrol with Mock BLE

1. **Launch app**
   ```
   cd c:\heri\heriguard-app
   npx expo run:android
   ```

2. **Enable Mock BLE**
   - Go to Settings tab
   - Toggle "Mock BLE" ON
   - Should see: "HERI-GUARD-01" connected

3. **Start Patrol (1st patrol)**
   - Go to dashboard
   - Press "Start Patrol" button
   - Should see mock robot transitioning through states: `patrol_move` → `inspect_wide` → ...
   - Wait for completion (~20 seconds)
   - Should see: 6 nodes with map markers

4. **Verify folder structure**
   - Open Android file manager (or ADB):
   ```
   adb shell
   cd /data/data/com.anonymous.heriguardapp/files/Documents/heriguard/patrols
   ls -la
   ```
   - Should see: `patrol-{timestamp}/`
   - Inside:
   ```
   patrol-{timestamp}/
   ├─ node_0/
   │  └─ shot_0_0000.jpg
   ├─ node_1/
   │  └─ shot_0_0100.jpg
   ├─ node_2/
   │  └─ shot_0_0200.jpg
   ... (up to 6 nodes)
   └─ patrol.json
   ```

5. **Verify patrol.json content**
   ```
   adb pull /data/data/com.anonymous.heriguardapp/files/Documents/heriguard/patrols/patrol-{timestamp}/patrol.json
   cat patrol.json
   ```
   Should contain:
   ```json
   {
     "id": "patrol-{timestamp}",
     "startTime": "2026-08-14T...",
     "endTime": "2026-08-14T...",
     "images": [
       {
         "uri": "file://...",
         "frameId": 0,
         "nodeX2": 0,
         "shotKind": 0,
         "pan": 90,
         "tilt": 90,
         "timestamp": "2026-08-14T...",
         "temperature": 28.5,
         "humidity": 62.3,
         "detection": null,
         "analysis": null
       },
       ...
     ],
     "mapMarkers": [...],
     "detections": [],
     "sensorLogs": [...]
   }
   ```

---

### Test 2: App Restart Persistence

1. **Close app completely**
   - Swipe from recent apps or press back multiple times

2. **Reopen app**
   - App should load and automatically call `loadPersistedPatrols()`
   - Watch console: should see `[PatrolStore] Loaded X persisted patrols`

3. **Go to History tab**
   - Should see the patrol from Test 1 in the list
   - Tap it to view patrol details
   - Should see all 6 nodes with images

4. **Verify data is not lost**
   - Images still on disk in same location
   - patrol.json still readable

---

### Test 3: Second Patrol (Comparison Demo)

1. **Start 2nd Patrol**
   - Press "Start Patrol" again
   - Wait for completion (~20 seconds)
   - Should create: `patrol-{timestamp2}/` (different timestamp)

2. **Verify folder structure for patrol 2**
   ```
   patrol-{timestamp2}/
   ├─ node_0/
   │  └─ shot_0_0000.jpg  ← SAME image URI as patrol 1 (mock is consistent per node)
   ├─ node_1/
   │  └─ shot_0_0100.jpg  ← SAME image URI as patrol 1
   ... (same images repeated)
   └─ patrol.json
   ```

3. **Note: bbox should grow**
   In patrol.json for patrol 2:
   ```json
   "images": [
     {
       "detection": {
         "label": "crack_small",
         "confidence": 0.65,  ← Higher than patrol 1
         "bbox": {
           "x": 45,
           "y": 33,
           "width": 38,
           "height": 25    ← Larger than patrol 1
         }
       },
       "analysis": {
         "severity": "medium",
         "crackArea": 4.2,  ← Larger than patrol 1
         "findings": "Phát hiện: crack_small (65%) | Diện tích ~4.2%"
       }
     }
   ]
   ```

---

### Test 4: Comparison Logic

1. **Import compare module**
   ```typescript
   import { compareNodeImages, getNodeTimeline, findPreviousImage } from "@/lib/compare";
   ```

2. **Test `findPreviousImage`**
   ```typescript
   const patrol1 = patrols[0];
   const patrol2 = patrols[1];
   const latestImage = patrol2.images[0]; // node_0 from patrol 2
   
   const prevImage = findPreviousImage(latestImage, patrol1);
   console.log(prevImage.frameId); // Should be 0 (same node)
   ```

3. **Test `computeNodeDelta`**
   ```typescript
   const delta = computeNodeDelta(latestImage, prevImage);
   console.log(delta.deltaAreaPercent); // Should be +1.5 or more
   console.log(delta.trend); // Should be "increasing"
   ```

4. **Test `getNodeTimeline`**
   ```typescript
   const timeline = getNodeTimeline([patrol1, patrol2], 3, 0);
   // Should show: [
   //   { patrolId: "patrol-...", area: 2.0, severity: "low" },
   //   { patrolId: "patrol-...", area: 3.5, severity: "medium" }
   // ]
   ```

---

## Expected Console Logs

When all working correctly:

```
[PatrolStore] Loaded 2 persisted patrols
[MockBLE] Starting mock patrol 1
[MockBLE] Generated node 0 image
[MockBLE] Generated node 1 image
...
[MockBLE] Patrol 1 completed
[PatrolStore] Patrol patrol-{timestamp} persisted to disk
[MockBLE] Starting mock patrol 2
[MockBLE] Generated node 0 image
...
[MockBLE] Patrol 2 completed
```

---

## Troubleshooting

### Images not found in folder
- Check adb path is correct
- Verify app has write permission to Documents
- Check expo-file-system is working

### patrol.json not created
- Check `updatePatrolJson` is being called in `patrolStore.endPatrol()`
- Check file write error in console

### Data lost after restart
- Check `loadPersistedPatrols` is called in `_layout.tsx`
- Verify `readPatrolJson` can find patrol.json file
- Check JSON.parse doesn't throw error

### Comparison returns no delta
- Verify both patrols have images with `analysis` object
- Check `detection` object is populated (should be for node ≥3 in mock)
- Verify `crackArea` is set in analysis

---

## Phase A Success Criteria

- [x] Folder structure: `patrols/{patrolId}/node_{nodeX2}/shot_{kind}_{frameId}.jpg`
- [x] patrol.json manifest created with full NodeImage metadata
- [x] Persistence: app restart loads all patrols from disk
- [x] Mock BLE generates consistent image per node (for comparison)
- [x] Mock BLE increases detection area over time (demo trend)
- [x] Comparison logic finds previous image and computes delta
- [x] No errors or warnings in console

Once all ✅, Phase A is complete and ready for Phase B (firmware changes).
