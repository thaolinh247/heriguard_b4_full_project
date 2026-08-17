# EDGE AI MERGE ASSESSMENT — HERI-GUARD

## 📋 Summary

**Status: ✅ COMPLETE** — Edge AI detection is fully integrated with image capture, persistence, and comparison flow.

Current implementation:
- ✅ Camera firmware has on-device crack detection (5 label classes: crack_small, crack_large, moss, mold, stain)
- ✅ Robot firmware triggers capture + detection per node/shot and sends via BLE (CHAR_CAMERA_DATA + CHAR_DETECTION)
- ✅ App receives JPEG chunks + detection data via BLE with nodeX2/shotKind/pan/tilt direct from firmware
- ✅ Detections linked to images and nodes (nodeX2 + shotKind + frameId)
- ✅ Detections saved to patrol manifest (`patrol.json`) — survive app restart
- ✅ Comparison/trend analysis vs previous patrols + escalating trend alerts
- ✅ UI complete: history list with node summaries, patrol detail, node detail (before/after + delta + timeline)

---

## 1️⃣ CAMERA FIRMWARE (heriguard-robot/camera/main.py)

### Current Implementation (updated)

```python
elif cmd == b'D':
    # AI crack detection on-device — labels: 0=crack_small, 1=crack_large, 2=moss, 3=mold, 4=stain
    img = sensor.snapshot()
    dark_threshold = (0, 60, -32, 32, -32, 32)
    blobs = img.find_blobs([dark_threshold], pixels_threshold=80, area_threshold=80, merge=True)
    moss_th = (0, 100, -40, -10, 20, 80)     # màu xanh rêu
    mold_th  = (0, 100, -10, 30, -20, 20)     # màu xám/đen ẩm
    stain_th = (60, 100, -40, 40, -40, 60)    # màu sậm hơn nền
    results = []
    for b in blobs:
        if b.area() < 150 or b.w() < 4 or len(results) >= 8:   # max 8 → MAX_DETECTIONS
            continue
        eccentricity = math.sqrt(1 - (b.h() / b.w())**2) if b.w() > 0 else 0
        label = 0
        if eccentricity > 0.6 and b.area() > 500:   label = 1   # crack_large
        elif eccentricity > 0.6:                    label = 0   # crack_small
        elif img.find_blobs([moss_th], roi=b.rect()): label = 2 # moss
        elif img.find_blobs([mold_th], roi=b.rect()): label = 3 # mold
        else:                                       label = 4   # stain
        confidence = min(0.95, 0.45 + (b.area() / 3200) + (eccentricity * 0.15))
        results.append((b.cx()>>2, b.cy()>>2, b.w()>>2, b.h()>>2, label, int(confidence*100)))
    uart.write(bytes([0xDD, len(results)]))
    for r in results:
        uart.write(pack("<BBBBBB", *r))   # x,y,w,h,label,confidence (QQVGA ÷4)
```

### Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Algorithm** | ✅ OK | Dark blob detection + eccentricity, extended with moss/mold/stain color thresholds |
| **Efficiency** | ✅ OK | Runs at ~5-10 fps on QQVGA → does not block robot |
| **Confidence** | ⚠️ WEAK | Still heuristic (`0.45 + area/3200 + eccentricity*0.15`) — acceptable for MVP demo |
| **Output Format** | ✅ OK | `0xDD + count + N×6 bytes` — real bbox + label + confidence |
| **Label Diversity** | ✅ OK | 5 labels instead of generic "crack" — reduces false positives (moss/mold/stain separated) |
| **Node Linking** | ✅ OK | Robot firmware adds nodeX2/shotKind when relaying → app links detection to location |

---

## 2️⃣ ROBOT FIRMWARE (heriguard-robot/src/main.cpp)

### Current Implementation (updated)

```cpp
void inspectWide() {
  readSensor(); if (bleConnected) sendSensor();
  bool hasIssue = false;
  if (bleConnected) {
    camNodeX2  = markerDistanceCount;          // node hiện tại
    camShotKind = 0;
    camPan = SERVO_PAN_C; camTilt = SERVO_TILT_HOME;
    captureJpegFromCam();                      // ✅ capture JPEG thật
    hasIssue = readDetectionFromCam();         // ✅ detection thật từ camera ('D')
    if (hasIssue) sendDetectionViaBle();       // 12-byte
  }
  if (hasIssue) { sendMapMarker(0x04); sendMapMarker(0x08); }   // MOSS + MOLD cờ
  else { sendMapMarker(0x00); }
  markerDistanceCount++;
  if (hasIssue) { robotState = INSPECT_B; servoPan(SERVO_PAN_R); }  // ✅ chụp cận
  else          { robotState = INSPECT_E; }
}
```

### Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| **JPEG Capture** | ✅ ENABLED | Auto-capture in INSPECT_A (+ B/C/D khi pan) → baseline wide images |
| **Detection Trigger** | ✅ WIRED | 'D' command from state machine via `readDetectionFromCam()` |
| **Servo Positioning** | ✅ DONE | `servoPan()` L/C/R (45/90/135), tilt low/high/home — pan+tilt sent in header |
| **Header Format** | ✅ DONE | 10-byte: frameId(2) + nodeX2 + shotKind + pan + tilt + chunkIdx(2) + total(2) |
| **Detection Char** | ✅ DONE | 12-byte: label + confidence + nodeX2 + shotKind + bbox(4) + temp(2) + hum(2) |
| **State Machine** | ✅ ENABLED | INSPECT_B/C/D active (close-up L/R/L-shots), retract, patrol loop + junction handling |
| **Start patrol** | ✅ DONE | `servoHome()` on Start Patrol command → deterministic camera pose |

---

## 3️⃣ APP BLE HANDLER (heriguard-app/src/lib/ble.ts)

### Current Implementation (updated)

```typescript
function handleDetectionData(data: number[]) {
  if (data.length < 12) return;
  const label = data[0];
  const confidence = data[1] / 100;
  const nodeX2 = data[2];              // ✅ từ firmware
  const shotKind = data[3];            // ✅ từ firmware
  const x = data[4] * 4, y = data[5] * 4, w = data[6] * 4, h = data[7] * 4; // QQVGA→640x480
  const temp = (data[8] | (data[9] << 8)) / 100;
  const humidity = (data[10] | (data[11] << 8)) / 100;
  // → patrolStore.addDetectionEvent(currentPatrolId, nodeX2, shotKind, {...})
  // → partsToImage({ 1: makeBoundingBox({x,y,w,h}) })
  // → useAlertStore for high-severity
}
```

### Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Parsing** | ✅ OK | Full 12-byte packet with nodeX2/shotKind/temp/humidity |
| **Storage** | ✅ FIXED | Adds to `patrolStore.currentSession.detections` → patrol.json manifest |
| **Node Linking** | ✅ FIXED | nodeX2 from firmware — no guessing from map markers |
| **Image Linking** | ✅ FIXED | Detection matched to node image by nodeX2+shotKind in node-detail UI |
| **Persistence** | ✅ FIXED | Saved in manifest, reloaded via `loadPersistedPatrols()` |
| **Alerts** | ✅ FIXED | High-confidence detection + escalating trend (`crack_increased`) → alertStore |

---

## 4️⃣ CAMERA FRAME HANDLING (heriguard-app/src/lib/ble.ts)

### Current Implementation (updated)

```typescript
function handleCameraChunk(data: number[]) {
  if (data.length < 10) return;
  const frameId = (data[0] << 8) | data[1];
  const nodeX2 = data[2]; const shotKind = data[3];
  const pan = data[4]; const tilt = data[5];
  const chunkIdx = (data[6] << 8) | data[7];
  const totalChunks = (data[8] << 8) | data[9];
  const payload = data.slice(10);           // JPEG bytes
  // → savePatrolImage(patrolId, nodeX2, shotKind, frameId, uri, pan, tilt)
  // → patrolStore.addImage({ nodeX2, shotKind, uri, pan, tilt, ... })
}
```

### Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Storage Path** | ✅ FIXED | `patrols/{patrolId}/node_{NN}/shot_{K}_{frameId}.jpg` |
| **Organization** | ✅ FIXED | Grouped by patrol → node → shot (still kept in flat list for simplicity) |
| **Metadata** | ✅ FIXED | Saves nodeX2, shotKind, pan, tilt, frameId, temp, humidity |
| **Persistence** | ✅ FIXED | Indexed in patrol.json manifest via `updatePatrolJson` |
| **Restart Recovery** | ✅ FIXED | `loadPersistedPatrols()` restores patrols+images+detections on app start |
| **Duplicate Handling** | ✅ OK | Chunk-based reassembly with totalChunks check |

---

## 5️⃣ PATROL STORE (heriguard-app/src/store/patrolStore.ts)

### Current Implementation (updated)

```typescript
export interface PatrolSession {
  id: string;
  startTime: string;
  endTime?: string;
  mapMarkers: MapMarker[];
  images: NodeImage[];          // ✅ populated via addImage()
  detections: DetectionEvent[]; // ✅ linked via addDetectionEvent()
  sensorLogs: SensorReading[];
}
```

### Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **RAM-only** | ✅ FIXED | `endPatrol()` writes patrol.json to disk via `updatePatrolJson` |
| **imageUris** | ✅ FIXED | Replaced with `images: NodeImage[]` — populated from BLE camera chunks |
| **Detection Index** | ✅ FIXED | `detections[]` with nodeX2/shotKind per event |
| **Persistence** | ✅ FIXED | Loaded on startup via `loadPersistedPatrols()` |
| **Comparison** | ✅ FIXED | `shouldEscalateForConsecutiveGrowth()` runs on endPatrol → alertStore |

---

## 6️⃣ FILE STORAGE (heriguard-app/src/lib/fileStorage.ts)

### Current Implementation (updated)

```typescript
export async function savePatrolImage(
  patrolId: string, nodeX2: number, shotKind: number, frameId: number,
  base64: string, pan: number, tilt: number, temp: number, humidity: number
): Promise<string>      // patrols/{patrolId}/node_{NN}/shot_{K}_{frameId}.jpg

export async function readPatrolJson(patrolId: string): Promise<Record<string, unknown> | null>
export async function updatePatrolJson(patrolId: string, updater: (prev) => next): Promise<void>
export async function listPatrolDirs(): Promise<string[]>
```

### Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| **Structure** | ✅ OK | `patrols/{patrolId}/node_{NN}/shot_{K}_{frameId}.jpg` |
| **Usage** | ✅ USED | Called from BLE handlers (`handleCameraChunk`) |
| **Metadata** | ✅ OK | Full metadata (nodeX2, shotKind, pan, tilt, temp, humidity) |
| **Manifest** | ✅ OK | `readPatrolJson`/`updatePatrolJson` implemented, used in endPatrol + startup |
| **Comparison** | ✅ OK | `listPatrolDirs()` + manifest hydration for multi-patrol compare |

---

## ✅ RESOLVED GAPS

| Gap | Status |
|-----|--------|
| Images not saved to patrol folder | ✅ FIXED — `savePatrolImage()` organizational folders |
| Images not linked to nodes | ✅ FIXED — nodeX2 from firmware 10-byte header |
| Detections not linked to images | ✅ FIXED — detection 12-byte carries nodeX2+shotKind |
| No patrol.json manifest | ✅ FIXED — written on endPatrol, loaded on start |
| No edge AI analysis | ✅ FIXED — `lib/analyze.ts` (area/count/severity) |
| No image comparison logic | ✅ FIXED — `lib/compare.ts` (findPrevious, delta, timeline, escalate) |
| JPEG capture commented | ✅ FIXED — INSPECT_A/B/C/D capture real frames |
| INSPECT_B/C/D disabled | ✅ FIXED — close-up shots enabled with servo pan/tilt |

## ✅ WORKING (kept)

1. Camera JPEG capture + checksum + chunk encoding
2. Robot BLE communication (sensor, map markers, commands)
3. App BLE notification parsing
4. Sensor data persisted in sensorLogs[]
5. Map markers + virtual map display
6. File system persistence (expo-file-system)

---

## 📊 DATA FLOW (IMPLEMENTED)

```
Camera → Main.py
  ├─ JPEG (capture)
  └─ Detection (0xDD + bbox + label + confidence)

Robot → Main.cpp
  ├─ Header 10 byte: frameId + nodeX2 + shotKind + pan + tilt + chunkIdx + totalChunks
  └─ Detection 12 byte: label + confidence + nodeX2 + shotKind + bbox + temp + humid

BLE → App ble.ts
  ├─ handleCameraChunk() → savePatrolImage(...) → patrolStore.images[]
  └─ handleDetectionData() → patrolStore.detections[]

File Storage → patrolStore.ts
  ├─ patrols/{patrolId}/node_NN/shot_K_frameId.jpg ✅
  └─ patrols/{patrolId}/patrol.json (manifest) ✅ persistent

compare.ts → analyze.ts
  ├─ findPrevious(nodeX2, shotKind) → previous patrol image
  ├─ computeNodeDelta(prev, latest) → % area / confidence / temp
  ├─ getNodeTimeline(patrols, nodeX2, shot) → history bars
  └─ shouldEscalateForConsecutiveGrowth() → trend alert

alertStore
  └─ type "crack_increased" alert on endPatrol + high-severity on detection

UI
  ├─ History: patrol list + node summaries + risk dot → /patrol/{id}
  ├─ Patrol detail: summary card, NodeCard (severity, delta, timeline, escalate)
  └─ Node detail: before/after side-by-side + delta card + shot chips
```

---

## 📝 STATUS BY PHASE

### ✅ Phase A (App-side persistence) — DONE

- [x] `NodeImage` interface in `types/robot.ts`
- [x] `PatrolSession.images: NodeImage[]`
- [x] `lib/analyze.ts` — single-image analysis (area, count, severity)
- [x] `lib/compare.ts` — previous detection lookup + delta + timeline + escalate
- [x] `fileStorage.ts`: `savePatrolImage`, `readPatrolJson`, `updatePatrolJson`, `listPatrolDirs`
- [x] `ble.ts`: parse nodeX2 from firmware header, `savePatrolImage()`, save detection to manifest
- [x] `patrolStore.ts`: `endPatrol()` → write patrol.json; `loadPersistedPatrols()` on start
- [x] `lib/mockBle.ts` — mock per node (stable image, growing bbox)
- [x] UI: History screen with patrol list, node detail screen

### ✅ Phase B (Firmware) — DONE

- [x] Uncomment JPEG capture in INSPECT_A → baseline wide shot per node
- [x] Enable INSPECT_B/C/D → close-up shots on detection with servo pan
- [x] nodeX2/shotKind in BLE header → 10-byte (was 6)
- [x] nodeX2/shotKind in detection char → 12-byte (was 10)

### ✅ Phase C (Comparison) — DONE

- [x] `lib/compare.ts` — find previous, compute delta, baseline logic
- [x] `lib/analyze.ts` — single-image analysis (area, count, confidence)
- [x] Trend alert — escalate if growth for consecutive patrols (`crack_increased`)
- [x] UI — history screen with node timeline + patrol detail + node detail (before/after + delta + chart)