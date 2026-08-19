# CHANGELOG HERI-GUARD

Lịch sử thay đổi toàn bộ dự án (heriguard-app + heriguard-robot).

**Quy tắc:** Mỗi lần có thay đổi code/config/docs phải thêm mục mới vào đầu phần "Unreleased" (hoặc mục ngày tương ứng), ghi rõ: thay đổi gì, file nào, lý do.

## Unreleased

### 2026-08-19 — Fix: Phân tích xu hướng dùng real Gemini API + chi tiết hơn; thêm dữ liệu biểu đồ mẫu

**Lý do**: (1) Phân tích xu hướng tại 2 điểm chụp đang ưu tiên mock cố định (auto-run luôn mock) — user yêu cầu PHẢI gọi real Gemini API; (2) bản phân tích cần chi tiết hơn (từng ngày, số liệu cụ thể); (3) biểu đồ Nhiệt độ/Độ ẩm rỗng khi chưa kết nối robot — cần dữ liệu mẫu cố định như phần Điểm chụp.

**heriguard-app**
- `src/lib/gemini.ts`: `buildTrendPrompt` viết lại chi tiết — thêm tham số `context` (tên điểm chụp), đưa bảng số liệu từng ngày + tóm tắt chỉ số, yêu cầu JSON gồm `summary` 3-4 câu, `tempTrend`/`humidityTrend`/`detectionTrend` dài hơn kèm số liệu, `dayDetails[]` (từng ngày: temp/humidity/số phát hiện/severity/note), `insights` và `recommendations` 4 mục mỗi loại. `analyzeTrendsWithGemini(apiKey, context, points)` parse `dayDetails`.
- `src/components/dashboard/DayTrendCard.tsx`: CHỈ dùng real Gemini API — bỏ hoàn toàn mock fallback ở phân tích xu hướng (`doAnalyze` luôn gọi `analyzeTrendsWithGemini`, không còn `mockTrendAnalyze`). Auto-run chạy khi có đủ data (≥2 ngày) + có API key; không có key → hướng dẫn cấu hình trong Cài đặt; API lỗi → hiện lỗi rõ ràng + cho thử lại. Thêm prop `context`. Thêm section "Từng ngày" hiển thị `dayDetails` (day, date, °C, %, số phát hiện, severity, note).
- `src/app/capture-point/[id].tsx`: Truyền `context="${point.label} (${point.distanceLabel})"` vào DayTrendCard.
- `src/types/gemini.ts`: Thêm `TrendDayDetail` + `dayDetails` vào `TrendAnalysis`.
- `src/lib/mockGemini.ts`: `mockTrendAnalyze` trả `dayDetails` (NGÀY 3→1 mới→cũ, gắn số liệu + note) — dùng khi fallback.
- `src/lib/sim/demoChart.ts` (MỚI): 24 điểm dữ liệu biểu đồ cố định theo chu kỳ ngày (nhiệt độ 25–30°C, độ ẩm 60–74%), deterministic, khớp dải demoView.
- `src/app/(tabs)/charts.tsx`: Nếu chưa có dữ liệu thật → dùng `getDemoChartPoints()` + ghi chú "Đang hiển thị dữ liệu mẫu cố định".

**Kết quả**: Cả 2 điểm chụp khi mở folder tự phân tích xu hướng bằng Gemini thật (nếu có key), kết quả chi tiết theo từng ngày; biểu đồ Nhiệt độ & Độ ẩm luôn có nội dung.

### 2026-08-19 — Fix: Tình trạng 2 điểm chụp khác nhau + ngày 3 = mới nhất + dữ liệu khớp severity

**Lý do**: Cả 2 điểm chụp đang hiển thị cùng chuỗi tình trạng Thấp→Trung bình→Cao. User yêu cầu: (1) tình trạng 2 điểm phải KHÁC nhau; (2) đổi tag: trung bình→thấp, thấp→trung bình; (3) NGÀY 3 = mới nhất (1 ngày trước), NGÀY 1 = cũ nhất (14 ngày trước); (4) nhiệt độ/độ ẩm phải phù hợp với tình trạng ảnh (severity càng cao → môi trường càng bất lợi).

**heriguard-app**
- `src/lib/sim/demoView.ts`: `DAY_SEVERITY` chung → `POINT_SEVERITY` theo điểm: Điểm 1 = [Trung bình, Thấp, Trung bình], Điểm 2 = [Thấp, Trung bình, Cao] (theo ngày 3→1). `DAYS_AGO` đảo: [1, 7, 14] (ngày 3 mới nhất). `POINT_TEMPS/POINT_HUMS` → `SEV_TEMP/SEV_HUM` cố định theo severity (low 26.2°C/61.8%, medium 27.9°C/67.8%, high 29.6°C/73.8%).
- `src/lib/sim/seedDemoData.ts`: Đồng bộ — `SEVERITY_MAP` theo điểm, patrol ngày 3 = 1 ngày trước, temp/humidity theo severity, bbox/confidence theo `SEV_CONF/SEV_BBOX` (giống demoView).

**Kết quả**: Tab Điểm chụp — Điểm 1 badge "Cần chú ý", Điểm 2 badge "Cảnh báo"; ngày trong folder đúng thứ tự NGÀY 3 mới nhất; số liệu môi trường tăng theo mức độ hư hại.

### 2026-08-19 — Fix: Dữ liệu mẫu CỐ ĐỊNH thuần view (bỏ purge/seed lại)

**Lý do**: User không muốn cơ chế "xóa dữ liệu cũ → seed lại" (có thể vô tình xóa dữ liệu). Yêu cầu: ảnh + dữ liệu phải CỐ ĐỊNH — mỗi điểm chụp 3 ngày, mỗi ngày đúng 2 ảnh (1 wide chung cho mọi ngày + 1 zoom khác nhau mỗi ngày), số ngày/ảnh ngoài folder khớp bên trong (3 ngày/6 ảnh).

**heriguard-app**
- `src/lib/sim/demoView.ts` (MỚI): Dữ liệu mẫu deterministic thuần view — `buildDemoDays(nodeX2)` / `buildDemoDayBlocks(nodeX2)` / `useDemoBlocks(nodeX2, enabled)` / `hasDemoPatrols(patrols)`. 3 ngày cố định: ảnh wide theo `resolveWideUriForNode`, zoom theo `resolveZoomUri(dayIndex)`, nhiệt độ/độ ẩm/severity (low→medium→high) là hằng số; cache theo nodeX2. KHÔNG đọc store, KHÔNG lưu đĩa, không đổi qua mọi phiên chạy.
- `src/app/(tabs)/points.tsx`: Khi app có patrol demo → hiển thị folder từ dữ liệu demo cố định (luôn 3 ngày/6 ảnh, badge/trạng thái ổn định) qua `PointFolderCard` + `useDemoBlocks`. Bỏ nút "Cập nhật dữ liệu mẫu" (đã thêm hôm trước).
- `src/app/capture-point/[id].tsx`: Khi có patrol demo → `useDemoBlocks` thay cho `buildDayBlocks`: luôn 3 ngày × 2 ảnh đúng cấu trúc (wide + zoom, khác URI), có trạng thái loading. Bỏ phụ thuộc vào cấu trúc dữ liệu cũ.
- `src/lib/sim/seedDemoData.ts`: Xóa `ensureDemoData()`, `purgeAllDemoPatrols()`, marker version AsyncStorage. Thay bằng `ensureDemoSeedFresh()` — chỉ seed khi store hoàn toàn trống (lần cài mới); `seedDemoData()` bỏ luôn việc dọn demo cũ (guard: có patrol nào rồi thì không seed). KHÔNG BAO GIỜ xóa dữ liệu.
- `src/app/_layout.tsx`: Gọi `ensureDemoSeedFresh()`.

**Kết quả**: Mọi patrol demo cũ (bất kể 6 ngày/6 ảnh) giờ được hiển thị theo cấu trúc cố định 3 ngày × 2 ảnh; không còn xóa/thay thế dữ liệu.

### 2026-08-18 — Fix: Đảm bảo seed demo chạy được + nút cập nhật trên tab

**Lý do**: App vẫn hiển thị dữ liệu demo CŨ (6 ngày/6 ảnh ngoài folder, 3 ngày/3 ảnh bên trong — mỗi ngày 1 ảnh) — seed mới chưa từng chạy vì user chưa reload hoàn toàn và không có cách kích hoạt từ UI.

**heriguard-app**
- `src/lib/sim/seedDemoData.ts`: `ensureDemoData()` viết lại — dùng marker version trong AsyncStorage (`heriguard_demo_seed_version`); nếu khác `v4` → **xóa MỌI demo mọi prefix** (`demo-*`) khỏi store + đĩa, seed `demo-v4`, ghi marker, load lại. Idempotent, lặp lại được.
- `src/app/(tabs)/points.tsx`: Hiển thị **nút "Cập nhật dữ liệu mẫu (3 ngày × 2 ảnh/ngày)"** + ActivityIndicator + message kết quả. Tự chạy `ensureDemoData()` khi mở tab.

### 2026-08-18 — Fix: Tự dọn demo cũ khi mở tab Điểm chụp

**Lý do**: Seed/cleanup chỉ chạy lúc app khởi động → Fast Refresh không kích hoạt → user không thấy thay đổi trên tab Điểm chụp.

**heriguard-app**
- `src/lib/sim/seedDemoData.ts`: Thêm `ensureDemoData()` — load persisted, dọn demo cũ (non v4) khỏi store + đĩa, seed demo-v4 nếu thiếu, load lại. Idempotent.
- `src/app/(tabs)/points.tsx`: Gọi `ensureDemoData()` trong `useEffect` khi mở tab → tab tự cập nhật (dọn 6 ngày cũ → 3 ngày, wide cố định + zoom khác nhau mỗi ngày).
- `src/app/_layout.tsx`: Đơn giản hóa startup → dùng `ensureDemoData()`.

### 2026-08-18 — Fix: Cấu trúc ảnh seed đúng yêu cầu (wide cố định + zoom khác nhau)

**Lý do**: (1) Mỗi ngày phải có đủ 2 ảnh: 1 wide + 1 zoom; (2) Mỗi điểm chụp dùng CHUNG 1 ảnh wide cho tất cả các ngày; (3) Ảnh zoom khác nhau mỗi ngày; (4) Số ngày/ảnh ngoài folder phải khớp thực tế bên trong (3 ngày, 2 ảnh/ngày).

**heriguard-app**
- `src/lib/sim/simMedia.ts`: Thêm `resolveWideUriForNode(nodeX2)` — 1 ảnh wide CỐ ĐỊNH cho mỗi điểm chụp (node 1 → ảnh A, node 2 → ảnh B). `resolveZoomUri(dayIndex)` — dayIndex 0,1,2 → crack-low/medium/high (mỗi ngày khác nhau). Bỏ `ZOOM_MODULES` theo severity cũ.
- `src/lib/sim/seedDemoData.ts`: Sáng → `resolveWideUriForNode(nodeX2)` (wide chung), chiều → `resolveZoomUri(dayIndex)`. Seed dọn sạch mọi demo cũ (demo-*, v2, v3) khỏi store + đĩa trước khi tạo `demo-v4-*`.
- `src/app/capture-point/[id].tsx`: `DayOverviewCard` sort shotKind (wide trước), chọn wide + zoom khác URI — đảm bảo không hiện 2 ảnh giống nhau.
- `src/app/_layout.tsx`: Cleanup demo cũ giữ lại `demo-v4-*`.

### 2026-08-18 — Fix: Ảnh trùng lặp + TypeScript error displayImages

**Lý do**: (1) `resolveWideUri()` dùng `Math.random()` → cả 2 patrol cùng ngày có thể chọn cùng 1 ảnh wide; (2) `resolveZoomUri(severity)` trả cùng 1 ảnh cho cùng severity → zoom trông giống hệt nhau; (3) `displayImages` filter `Boolean` không type-safe → runtime error.

**heriguard-app**
- `src/lib/sim/simMedia.ts`: `resolveWideUri()` chuyển sang **round-robin** (không còn random). `ZOOM_MODULES` mở rộng thành mảng 2-3 ảnh mỗi severity (thêm ảnh heritage-site làm zoom variety). `resolveZoomUri(severity, patrolIndex)` dùng patrolIndex để chọn ảnh khác nhau.
- `src/lib/sim/seedDemoData.ts`: Truyền `patrolIndex` vào `resolveZoomUri()`. Đổi prefix `demo-v3-` để force re-seed.
- `src/app/capture-point/[id].tsx`: Fix TypeScript — `displayImages` khai báo rõ类型, spread operator thay vì `filter(Boolean)`.
- `src/app/_layout.tsx`: Cleanup old demo data (`demo-*` không phải `demo-v3-*`).

**heriguard-robot (firmware)**
- `src/main.cpp`: Thêm `patrolWithRightTurns(timeoutMs)` — bám line phải, khi phát hiện ngã rẽ phải (junctionType==2) → dừng + xoay phải 90° bằng `turnByAngle` (IMU Roll), tiếp tục bám line đến khi mất line hoặc timeout. `loop()` gọi hàm này khi `gMosaicRequested` (BTN_DOWN).

### 2026-08-18 — Fix: Ảnh đúng thư mục + ControlPanel 3 nút + AI summary chi tiết

**Lý do**: (1) Ảnh seed data dùng sai đường dẫn Unicode (`assets/vết nứt/`, `assets/di tích nứt/`) → copy sang `assets/images/heritage-site/` + `assets/images/crack-detail/` (ASCII) để Metro bundler load đúng; (2) ControlPanel chỉ có1 nút dừng; (3) AI trend analysis quá ngắn; (4) Ngày mới nhất cần số lớn nhất; (5) Summary rule-based cần thay bằng AI thật có nút riêng.

**heriguard-app**
- `assets/images/heritage-site/`: Copy 7 ảnh từ `assets/di tích nứt/` (ASCII paths).
- `assets/images/crack-detail/`: Copy 3 ảnh từ `assets/vết nứt/` (ASCII paths).
- `src/lib/sim/simMedia.ts`: Đường dẫn ảnh dùng `heritage-site/` + `crack-detail/` (ASCII).
- `src/lib/sim/seedDemoData.ts`: Thêm logging `[SeedDemo]` để debug ảnh wide/zoom.
- `src/app/capture-point/[id].tsx`: **NGÀY số lớn nhất = mới nhất** (`displayBlocks.length - i`). **Nút "Tóm tắt bằng AI"** riêng cho mỗi ngày — gọi `analyzeDaySummaryWithGemini` (Gemini thật, có gửi ảnh đầu tiên). Bỏ summary rule-based sẵn có.
- `src/lib/gemini.ts`: Thêm **`analyzeDaySummaryWithGemini`** — prompt chi tiết 5-8 câu (tổng quan, severity, môi trường, so sánh, khuyến nghị). Gửi ảnh JPEG đầu tiên để Gemini phân tích visual.
- `src/lib/mockGemini.ts`: **`mockTrendAnalyze` chi tiết hơn** — summary 3-5 câu với số liệu cụ thể, insights 3-4 mục, recommendations 3-4 mục (có mức độ khẩn cấp).

### 2026-08-18 — Fix: Gemini 429 quota + ShotKind labels tiếng Việt

**Lý do**: (1) Gemini API free tier quota 20 req/ngày → auto-run trên DayTrendCard liên tục gọi API → 429 → fallback mock nhưng lãng phí quota + hiện warning; (2) ShotKind labels hiển thị tiếng Anh ("Wide (A)", "Close High (D)") — cần tiếng Việt cho ban quản lý di tích.

**heriguard-app**
- `src/store/settingsStore.ts`: `geminiMockMode` default `true` → luôn dùng mock除非 user toggle "Dùng API thật" trong settings. Tránh lãng phí quota khi dev.
- `src/types/robot.ts`: `SHOT_KIND_LABELS` chuyển sang tiếng Việt — `0: "Ảnh rộng"`, `1: "Ảnh cận thấp"`, `2: "Ảnh cận cao"`, `3: "Tùy chỉnh"`.

**Lưu ý seed data**: Mỗi ngày tạo 2 ảnh/capture point: sáng → wide (`heritage-cracks/crack-1.jpg`), chiều → zoom (`wall-crack-{1,2,3}.jpg` theo severity). `buildDayBlocks` + `DayOverviewCard` render cả 2 ảnh.

### 2026-08-18 — Fix: Emergency stop chỉ dừng robot, không chặn camera

**Lý do**: Nút "DỪNG KHẨN CẤP" (`X`) trên firmware hiện tại set `patrolActive = false` → state machine dừng → `N` (chụp) vẫn chạy nhưng patrol bị kill hoàn toàn. Cần phân biệt: `X` = tạm dừng (robot dừng, camera vẫn chụp, patrol vẫn active) vs EMERGENCY (chướng ngại vật/mất line > 3s = dừng cứng).

**heriguard-robot**
- `src/main.cpp`:
  - **`X` command**: Bỏ `patrolActive = false`. Giữ `patrolActive = true` + `robotState = IDLE` → state machine chạy nhưng IDLE = rỗng (motor dừng, camera hoạt động bình thường).
  - **`P` command**: Bỏ guard `if (!patrolActive)` → luôn reinitialize (reset encoder, PID, runtime). Cần thiết vì `X` giữ `patrolActive = true`, nếu không bỏ guard thì `P` không hoạt động.

**Flow sau fix**:
- `X` → motor dừng, `robotState=IDLE`, `patrolActive=true` → camera `N` hoạt động
- `P` → resume patrol (reset encoder, PID, `robotState=PATROL_MOVE`)
- EMERGENCY (obstacle/line loss) → `patrolActive=false` → state machine dừng hoàn toàn (hard stop)

### 2026-08-18 — Fix: VirtualMap hiện ảnh chụp + bỏ mô phỏng + AI phân tích điểm chụp

**Lý do**: (1) Bấm "Chụp + Nhận diện" không thấy ảnh trong bản đồ mô phỏng; (2) Cần bỏ chế độ mô phỏng BLE realtime, chỉ giữ real BLE + robot thật; (3) Điểm chụp cần có nút phân tích AI + dữ liệu mẫu sẵn.

**heriguard-app**
- `src/components/dashboard/VirtualMap.tsx`: Khi không có tuần tra đang chạy, hiển thị **marker từ lần tuần tra gần nhất** (thay vì chỉ `currentMapMarkers` rỗng). Thêm **ảnh chụp mới nhất** từ patrol gần nhất lên góc trái bản đồ (thumbnail 80×60 + label node + detection). Luôn hiển thị cả marker từ `currentMapMarkers` và `patrols[0].mapMarkers`.
- `src/lib/mockBle.ts`: Sau lệnh 'N' (Chụp + Nhận diện), thêm **map marker** vào `currentMapMarkers` — VirtualMap thấy marker ngay cả khi không trong patrol.
- `src/app/(tabs)/settings.tsx`: **Xoá toggle "Bật mô phỏng dữ liệu"** + xoá import `startMockBle`/`stopMockBle`. Chỉ giữ: BLE connection, Gemini AI, About.
- `src/app/(tabs)/index.tsx`: **Xoá auto-start mock BLE** — chỉ `tryReconnectLastDevice()` khi mở app. Bỏ import `startMockBle`/`stopMockBle`.
- `src/components/dashboard/ControlPanel.tsx`: **Chỉ dùng `sendCommand` (real BLE)** — bỏ `mockSendCommand`, bỏ `mockMode` check. `canControl = isConnected` (không còn `|| mockMode`).
- `src/store/settingsStore.ts`: `mockMode` default `false`.
- `src/app/capture-point/[id].tsx`: **Di chuyển `DayTrendCard` lên đầu trang dữ liệu** (trước "3 ngày theo dõi") — AI phân tích theo ngày là nội dung chính. Thêm text hướng dẫn dữ liệu mẫu trong empty state.
- `src/app/(tabs)/points.tsx`: Bỏ reference "bật mô phỏng" trong footer.

**Seed data**: Giữ nguyên — 6 patrols mẫu (3 ngày × sáng/chiều) tạo dữ liệu nền cho 2 điểm chụp. `buildDayBlocks()` tự group theo ngày → AI phân tích luôn có data.

**Kiểm tra**: `npx tsc --noEmit` 0 lỗi.

### 2026-08-18 — Fix: AI phân tích tự động + ảnh fallback cho điểm chụp

**Lý do**: (1) AI phân tích xu hướng chỉ chạy khi bấm nút — cần auto-run khi mở trang để cảm giác "có sẵn dữ liệu"; (2) Ảnh từ seed data có thể không load nếu file URI lỗi — cần fallback placeholder.

**heriguard-app**
- `src/components/dashboard/DayTrendCard.tsx`: **Auto-run AI phân tích** khi mount (dùng `useEffect` + `useRef` prevent duplicate). Luôn dùng mock khi không có Gemini API key. Fallback mock nếu API lỗi.
- `src/app/capture-point/[id].tsx`: **Thêm `onError` fallback** cho ảnh trong DayOverviewCard — nếu URI không load, hiển thị placeholder thay vì blank. Thêm `useState` cho hero/second image error tracking.

**Kiểm tra**: `npx tsc --noEmit` 0 lỗi.

### 2026-08-18 — Fix: Manifest race condition — patrol data không lưu được

**Lý do**: `savePatrolImageFromFile` tạo manifest half-written → `updatePatrolJson` gọi sau không tìm thấy (URI path issue) → "demo-X not found" → `loadPersistedPatrols` trả 0 patrols → capture points hiện rỗng.

**heriguard-app**
- `src/lib/fileStorage.ts`: Thêm **`writePatrolManifest()`** — ghi PatrolSession hoàn chỉnh trực tiếp lên disk, không cần read trước (tránh race condition). Thêm logging cho `listPatrolDirs`, `loadPersistedPatrols`, `writePatrolManifest`.
- `src/lib/sim/seedDemoData.ts`: **Bỏ `updatePatrolJson`**, dùng `writePatrolManifest` — ghi manifest hoàn chỉnh (images + mapMarkers + detections + sensorLogs) sau khi tạo xong patrol. Overwrite bản half-written từ `savePatrolImageFromFile`.

**Kiểm tra**: `npx tsc --noEmit` 0 lỗi.

### 2026-08-18 — Seed data: ảnh wide giống nhau + zoom theo severity

**Lý do**: Mỗi ngày cần 2 ảnh: wide (cùng 1 ảnh di tích) + zoom (ảnh vết nứt theo mức độ An toàn/Cần chú ý/Cảnh báo). Điểm chụp 1 chỉ dùng 2 mức thấp, điểm chụp 2 dùng cả 3.

**heriguard-app**
- `src/lib/sim/simMedia.ts`: **Viết lại hoàn toàn** — thêm `resolveWideUri()` (cùng 1 ảnh di tích cho tất cả ngày) + `resolveZoomUri(severity)` (ảnh wall-crack theo severity). Giữ backward-compat exports cho mockBle.
- `src/lib/sim/seedDemoData.ts`: **Mỗi patrol tạo 1 ảnh/capture point** (không còn 2): sáng → wide, chiều → zoom. Severity mapping: ĐC1 = low,medium,low | ĐC2 = low,medium,high. Confidence thay đổi theo severity (low=82%, medium=89%, high=94%).

**Kiểm tra**: `npx tsc --noEmit` 0 lỗi.

**Lý do**: (1) Bản đồ mô phỏng chỉ nên có 2 marker điểm chụp cố định; (2) Points screen chỉ hiện 2 mục, AI phân tích chỉ trong trang điểm chụp; (3) Mỗi ngày cần 2 ảnh wide+close + AI phân tích theo ngày (nút bấm); (4) Bỏ so sánh 3 ngày.

**heriguard-app**
- `src/components/dashboard/VirtualMap.tsx`: **Bỏ robot stop markers + latest image thumbnail** — chỉ hiển thị 2 capture point markers. Legend đơn giản: "Điểm chụp — điểm dừng cố định".
- `src/app/(tabs)/points.tsx`: **Bỏ DayTrendCard** đầu trang — chỉ hiện 2 folder cards. Footer: "Robot tự chụp ảnh khi dừng".
- `src/lib/sim/seedDemoData.ts`: **Mỗi patrol tạo 2 ảnh/capture point** (shotKind 0 = Wide, shotKind 2 = Close High). Wide: bbox nhỏ, confidence thấp hơn. Close: bbox lớn, confidence cao hơn. Nhiệt độ/độ ẩm khác nhau cho mỗi shot. Bbox tăng dần theo patrolIndex → demo trend.
- `src/app/capture-point/[id].tsx`: **Ngày hiển thị "NGÀY N"** (không phải "3 ngày trước"). Mỗi ngày hiện 2 ảnh (wide + close) với shot kind label. **Bỏ ComparisonRow / so sánh 3 ngày**. AI phân tích xu hướng vẫn ở đầu trang (DayTrendCard).

**Kiểm tra**: `npx tsc --noEmit` 0 lỗi.

**Lý do**: `writePatrolManifest` fail với `FileNotFoundException` — `patrolDir()` dùng `new Directory(parent, "patrols", patrolId)` nhưng thư mục `patrols/` chưa tồn tại → Expo `Directory` constructor không tự tạo parent dirs → file write fail → 0 patrols loaded.

**heriguard-app**
- `src/lib/fileStorage.ts`: **Fix `patrolDir()`** — tạo `heriguard/patrols/` trước bằng `ensureDir`, rồi mới tạo `{patrolId}/`. Thêm **`ensureDirAsync()`** — dùng `makeDirectoryAsync({ intermediates: true })` để đảm bảo toàn bộ chuỗi thư mục tồn tại. `writePatrolManifest` gọi `ensureDirAsync` trước khi ghi.

**Kiểm tra**: `npx tsc --noEmit` 0 lỗi.

**heriguard-app**
- `src/constants/capturePoints.ts`: **Đổi capture points** từ node 2+5 → **node 1 (0.5m) + node 2 (1.0m)**. M-Vision chỉ chụp tại 2 điểm dừng này.
- `src/lib/sim/simMedia.ts`: **Cập nhật `isCrackNode`** → trả `true` cho node 1,2 (capture points), thay vì `nodeX2 >= 2`.
- `src/lib/sim/seedDemoData.ts`: **Chỉ tạo ảnh M-Vision cho capture point nodes** (1, 2) — sensor data vẫn tạo cho node 0-6. Thêm **fallback URI** khi `copyAsync` fail: dùng asset URI gốc thay vì crash. Import `CAPTURE_POINTS`.

**Kiểm tra**: `npx tsc --noEmit` 0 lỗi.

### 2026-08-17 — Fix: real BLE capture pipeline robustness (firmware + app)

**Lý do**: Real BLE capture ("Chụp + Nhận diện") chỉ hoạt động 1 lần rồi dừng, dữ liệu không lưu vào folder điểm chụp, AI không chạy trên ảnh thật. Root causes: (1) firmware không có cooldown giữa 2 lần chụp → camera buffer bịoverwrite; (2) app save pipeline thiếu error handling → ML fail silently, data mất; (3) `saveStaticCaptureFromUri` abort hoàn toàn khi ML fail thay vì lưu baseline.

**heriguard-robot** (`src/main.cpp`):
- Thêm `lastCaptureMs` cooldown 300ms giữa 2 lần `captureJpegFromCam()` — camera cần thời gian reset frame buffer.
- `'N'` command: log rõ sensor data (temp/humidity/node) trước khi capture, thêm error message khi capture fail.

**heriguard-app**:
- `src/types/robot.ts`: `PatrolCommand` thêm `"N"` (chụp tĩnh).
- `src/lib/ble.ts` (`saveJpegBytes`): validate JPEG magic bytes (0xFF 0xD8), reject data rỗng — prevents corrupted file writes.
- `src/lib/ble.ts` (`handleCameraChunk`): chuyển từ `.then().catch()` sang async IIFE + try-catch toàn pipeline — log rõ từng bước (JPEG saved → ML done → patrol saved), fallback base64 display khi file save fail.
- `src/lib/staticCapture.ts` (`saveStaticCaptureFromUri`): ML fail → vẫn lưu ảnh baseline (không detection); `savePatrolImageFromFile` fail → fallback sourceUri; mỗi bước có try-catch riêng, không abort toàn bộ pipeline.

**Kiểm tra**: `npx tsc --noEmit` 0 lỗi.

### 2026-08-17 — Fix: chụp nhận diện chỉ được 1 lần + dữ liệu nền điểm chụp

**Lý do**: (1) Bấm "Chụp + Nhận diện" lần 2 không hoạt động — chunk buffer (`cameraChunks`) không được reset trong nhánh static capture → lần 2 bị trigger reassemble sớm với data cũ, JPEG bị corrupt. (2) Mỗi điểm chụp cần có sẵn nền data 3 ngày + AI phân tích trong folder.

**heriguard-app**
- `src/lib/ble.ts` (`handleCameraChunk`): **thêm `cameraChunks = []; cameraExpectedChunks = 0;`** trong nhánh `!currentPatrol` (static capture) — match với nhánh patrol. Đây là root cause: khi không reset buffer, frameId trùng → reassemble trigger ngay chunk đầu với data cũ → JPEG corrupt → AI fail silently.
- **Nền data điểm chụp**: đã có sẵn từ seed demo — 6 patrols (3 ngày × sáng/chiều), mỗi patrol có ảnh + detection + `analyzeNodeImage()` cho node 2-6. `buildDayBlocks()` group theo ngày → mỗi ngày 2 cụm ảnh (sáng/chiều) + AI tổng hợp. Folder điểm chụp tự có dữ liệu khi mở trang.
- **Flow chụp nhận diện**: capture → `saveJpegBytes()` → `analyzeCrackOnDevice()` (ML model on-device) → nếu crack → `saveStaticCaptureFromUri()` lưu vào `patrols/{capture-timestamp}/node_{nodeX2}/` + thêm vào `patrolStore` + `detectionStore` + `alertStore`. Nếu sạch → không lưu (chỉ hiện trên carousel).

**Kiểm tra**: `npx tsc --noEmit` 0 lỗi.

### 2026-08-17 — Điểm chụp: 2 thư mục có lịch sử theo ngày + AI xu hướng + luồng chụp mới

**Lý do**: user yêu cầu tái thiết kế giao diện: (1) trên bản đồ guard.png đánh dấu sẵn 2 điểm chụp cố định (1.0m và 2.5m); (2) gom 2 tab AI + Lịch sử thành 1 tab "Điểm chụp" — mỗi điểm 1 thư mục chứa AI phân tích + nhiều cụm ảnh, ít nhất 3 ngày, mỗi ngày 2 cụm ảnh (sáng/chiều), cuối ngày có AI tổng hợp, phía trên có 1 AI phân tích thay đổi theo ngày; (3) ở chế độ thật, M-Vision chụp khi nhận tín hiệu → hiện ảnh lên "Ghi hình hiện trường" → ảnh được quét nhận diện trên app → chỉ ảnh có vết nứt lưu vào thư mục điểm dừng.

**heriguard-app**
- `src/constants/capturePoints.ts` (mới): **2 điểm chụp cố định** — ĐC1 = 1.0m (node 2), ĐC2 = 2.5m (node 5), kèm mô tả khu vực + hàm tra cứu.
- `src/components/dashboard/VirtualMap.tsx`: bản đồ guard.png **luôn hiển thị 2 điểm chụp** (chấm vàng + tag "ĐC1/ĐC2"), chạm để mở thư mục điểm chụp; marker robot trong tuần tra giữ nguyên nhưng tránh trùng vị trí điểm chụp; legend cập nhật 2 màu.
- `src/lib/daySummary.ts` (mới): gộp ảnh theo **ngày** tại 1 node — mỗi ngày 2 cụm (sáng <12h / chiều ≥12h, tự tách đôi nếu chưa đủ), `summarizeDay()` viết **AI tổng hợp ngày** (rule-based tiếng Việt: số phát hiện, diện tích nứt trung bình, Δ so hôm trước, nhiệt độ/độ ẩm) + `blocksToTrendPoints()` xuất 1 điểm/ngày cho AI xu hướng.
- `src/components/dashboard/DayTrendCard.tsx` (mới): thẻ **AI phân tích thay đổi theo ngày** dùng chung cho tab + từng folder — Gemini nếu có API key, ngược lại mock (giống pattern cũ của màn AI).
- `src/app/(tabs)/points.tsx` (mới, thay tab "AI" + "Lịch sử"): AI xu hướng theo ngày phía trên + **2 thư mục điểm chụp** (số ngày/ảnh/phát hiện, Δ diện tích so ngày trước, badge mức độ, tóm tắt ngày mới nhất).
- `src/app/capture-point/[id].tsx` (mới): trang **thư mục điểm chụp** — AI theo ngày của điểm, các ngày tách riêng, mỗi ngày 2 cụm ảnh kèm dữ liệu nhiệt độ/độ ẩm/độ tin cậy, cuối ngày 1 thẻ "AI tổng hợp ngày", dưới cùng là lịch sử chi tiết tại điểm.
- `src/app/(tabs)/_layout.tsx`: thay 2 tab `ai` + `history` bằng 1 tab `points` ("Điểm chụp"); xoá file `(tabs)/ai.tsx`, `history.tsx`.
- `src/lib/sim/seedDemoData.ts`: demo giờ tạo **6 lần tuần tra** (3 ngày × sáng 8h/chiều 15h) — mỗi điểm chụp có đủ 3 ngày × 2 cụm ảnh, diện tích nứt tăng dần theo từng lần → AI xu hướng theo ngày luôn có dữ liệu.
- `src/lib/sim/simMedia.ts` + `src/lib/mockBle.ts`: `isCrackNode` từ node ≥3 → **node ≥2** (Điểm chụp 1 tại 1.0m giờ cũng có dữ liệu phát hiện để demo 2 folder đều đầy đủ).
- `src/lib/ble.ts` (luồng thật): khi đang tuần tra, ảnh robot gửi đến → **lưu file → quét AI on-device** → hiện lên "Ghi hình hiện trường" (CameraCard/carousel) → có vết nứt thì lưu vào point dừng (patrol node + detectionStore + alert). Không còn chỉ lưu ảnh trống không phân tích như trước (robot không tự detect — app quyết định).
- `src/components/dashboard/TrendSummary.tsx`: nút "Xem phân tích chi tiết" trỏ sang tab Điểm chụp thay vì tab AI đã xoá.

**Chế độ thật (real BLE)**: giữ nguyên firmware (robot chỉ chụp khi nhận lệnh — INSPECT đang tắt). Ảnh lệnh 'N' → `staticCapture` chạy model trên app; ảnh tuần tra → `ble.ts` quét AI on-device. Chỉ ảnh đạt ngưỡng vết nứt mới lưu vào thư mục điểm dừng (`nodeX2` khớp điểm chụp).

**Kiểm tra**: `tsc --noEmit` 0 lỗi; `expo lint` 0 lỗi.

### 2026-08-17 — Servo remap + D-pad điều khiển + disable INSPECT

**Lý do**: Remap 4 servo theo wiring thật (RC4=ngang, RC3=gập cam, RC2=nâng cam, RC1=xoay trục), thêm nút D-pad trên app để điều khiển servo thủ công, và disable toàn bộ chuỗi INSPECT_A/B/C/D/E (chưa dùng).

**heriguard-robot `src/main.cpp`**
- **Servo remap**: RC4=ngang (setHWDir=true, home=90), RC3=gập cam (setHWDir=true, home=90), RC2=nâng cam (setHWDir=false, home=0), RC1=xoay trục (setHWDir=true, home=90).
- **`initServosToHome()`**: gọi `setHWDir()` cho từng servo + sync angle tracking globals.
- **Servo angle tracking**: thêm `servoPanAngle`, `servoFoldAngle`, `servoTiltAngle`, `servoTwistAngle` + `clampServo()` cho D-pad relative moves.
- **BLE servo commands** (`handleCommand`): `F`+step → RC4 pan, `G`+step → RC3 fold, `T`+step → RC2 tilt, `W`+step → RC1 twist. Step là int8 (±15° mỗi lần bấm).
- **Disable INSPECT**: comment hết `inspectWide`, `inspectRetract`, `inspectCloseApproach`, `inspectScanLow`, `inspectScanHigh` + enum states INSPECT_A–E + forward declarations. `patrolMove()` dừng lại sau 0.5m mà không chuyển sang INSPECT.

**heriguard-app**
- `src/components/dashboard/ControlPanel.tsx`: thêm **D-pad camera** — 4 mũi tên (↑↓ pan RC4, ←→ tilt RC2) + 2 hàng nút cho RC3 gập/mở + RC1 xoay trục trái/phải. Mỗi nút gửi command servo ±15° qua BLE.
- `src/types/robot.ts`: thêm `F`, `G`, `T`, `W` vào `PatrolCommand`.
- `src/lib/mockBle.ts`: mock servo commands (log, không có hardware).

**Kiểm tra**: `pio run` SUCCESS (firmware).

### 2026-08-17 — Fix: AI nhận diện chạy trên máy thật + demo luôn có sẵn dữ liệu node

**Lý do**: user test trên điện thoại thật: (1) chạy ảnh mẫu trong màn "Nhận diện vết nứt" không hiện kết quả phân tích (error "Bản thử nghiệm model cần chạy trên web") — bản port native trước đó ghi changelog nhưng code thật chưa được sửa (`ml/crack.ts` vẫn chỉ có đường web canvas); (2) tab Lịch sử không thấy phần so sánh/lưu trữ theo node vì seed demo không chạy khi thiết bị đã có patrol cũ (điều kiện `patrols.length === 0` quá chặt).

**heriguard-app**
- `src/ml/crack.ts`: thêm đường **native** cho `loadGrayImage()` — dùng `expo-image-manipulator` (resize 320×320 = lưới 5×5 ô 64×64) → đọc base64 qua `expo-file-system/legacy` → `jpeg-js` decode → grayscale; giữ nguyên đường web (canvas). Ảnh mẫu/chụp camera/thư viện/ảnh robot giờ chạy đúng model 97.28% ngay trên máy thật, hiện bbox + % tin cậy + thời gian như trên git branch.
- `src/app/_layout.tsx`: seed demo data chạy khi **chưa có patrol `demo-*` nào** (trong store lẫn trên đĩa) — không còn bị chặn bởi patrol cũ không ảnh → mở app là thấy ngay 7 node × 3 lần tuần tra cũ trong "Lưu trữ theo node"; data mới từ mock/robot lưu vào node folder riêng và hiện Δ so sánh.

**Kiểm tra**: `tsc --noEmit` 0 lỗi; `expo lint` 0 lỗi.

### 2026-08-16 — Hoàn thiện port B3: junction rẽ 90° + xử lý mất line

**heriguard-robot `src/main.cpp`** (tiếp theo port B3)
- `updateJunctionCounters()` giờ trả về type junction vừa latch (1=trái, 2=phải).
- **Mới `handleJunction()`**: khi PATROL_MOVE gặp junction xác nhận (2 frame liên tiếp) → dừng, `turnToAngle()` rẽ vuông góc 90° theo IMU (B3 turnByAngle) → reset encoder + PID + runtime → tiếp tục đo 0.5m. Gọi từ `followRightEdgeStep()`.
- **Xử lý mất line**: `isLineLostBySensorRule()` (active < 2 sensor, ngưỡng LINE_THRESHOLD=30); 3 frame liên tiếp → dừng + log; mất > 3s → `EMERGENCY` + BLE status. Reset state trong `resetFollowRuntime()`.
- (Không port `pt_can_vuong_goc` — bàn 6m thẳng không có line cắt ngang; robot tự thẳng hàng với line.)

**Kiểm tra**: `pio run` SUCCESS.

### 2026-08-17 — AI chạy được trên máy thật + logic 'N' (robot chỉ chụp, app nhận diện) + mục "Lưu trữ theo node"

**Lý do**: user báo (1) AI không chạy trên máy thật (camera báo lỗi, ảnh mẫu không nhận diện — model chỉ chạy web), (2) muốn đổi logic "Chụp & Nhận diện": robot chỉ chụp, app nhận diện, nếu đạt ngưỡng thì lưu ảnh + nhiệt độ/độ ẩm tại node rồi phân tích như tuần tra, (3) cần thấy rõ phần lưu trữ theo node + so sánh giữa các lần tuần tra.

**heriguard-app**
- `src/ml/crack.ts`: port `loadGrayImage()` sang native — dùng `expo-image-manipulator` (resize 320×320 = lưới 5×5 ô 64×64) + `jpeg-js` (decode JPEG → grayscale) + `buffer`; giữ đường web (canvas). Hết lỗi "Bản thử nghiệm model cần chạy trên web" → camera/ảnh mẫu/gallery nhận diện được ngay trên máy thật.
- `src/lib/staticCapture.ts` (mới): luồng lệnh 'N' mới — nhận ảnh robot gửi → chạy `analyzeCrackOnDevice` → không đạt ngưỡng: chỉ hiện trên carousel (không lưu); đạt ngưỡng: lưu ảnh vào `patrols/{id}/node_{x}/` + nhiệt độ/độ ẩm tại điểm + phân tích như tuần tra bình thường + đồng bộ patrolStore/detectionStore/alertStore.
- `src/store/patrolStore.ts`: thêm `addCompletedPatrol()` — tạo phiên 1 ảnh từ lệnh 'N', đưa vào lịch sử.
- `src/lib/mockBle.ts`: lệnh 'N' giờ chụp ảnh asset thật của node và chạy **đúng model** (thay detection giả 0.72 cố định); kết quả nhận diện hiện trên carousel.
- `src/lib/ble.ts`: ảnh nhận khi **không có tuần tra** (lệnh 'N' thật) → `saveStaticCaptureFromUri()` thay vì chỉ bỏ vào imageHistory.
- `src/app/(tabs)/history.tsx`: thêm mục **"Lưu trữ theo node"** ở đầu tab — mỗi node 1 thẻ: ảnh từng lần tuần tra ngang hàng (thumbnail kèm ngày + mức severity), Δ diện tích vết nứt so lần trước, chạm vào mở `node-detail` so sánh chi tiết.
- `src/store/dashboardStore.ts`: `updateSensor()` chặn giá trị 0/NaN (DHT lỗi gửi 0 → không đè dữ liệu cũ).
- Cài thư viện (đã xin phép user): `expo-image-manipulator`, `jpeg-js`, `buffer`.

**heriguard-robot `src/main.cpp`**
- Lệnh `'N'` đổi thành **capture-only**: robot chỉ chụp JPEG + gửi nhiệt độ/độ ẩm + gửi ảnh qua BLE, KHÔNG còn detect trên robot (bỏ `readDetectionFromCam`, detection 12 byte, map marker) — model nhận diện chạy trên app.
- `readSensor()`: nếu DHT đọc lỗi hoặc giá trị ngoài phạm vi → **giữ giá trị hợp lệ gần nhất** (`lastGoodTemp`/`lastGoodHum`) thay vì trả 0 → app không "mất dữ liệu" nhiệt/ẩm.

**Kiểm tra**: `tsc --noEmit` 0 lỗi; `expo lint` 0 lỗi; `pio run` SUCCESS (RAM 69.4%, Flash 47.5%).

### 2026-08-16 — Port tầng di chuyển + khởi động robot từ WRO 2026 B3

**heriguard-robot**
- **Mới `include/utils.h` + `src/utils.cpp`**: copy nguyên bộ `RobotUtils` từ B3 (không phụ thuộc hardware) — clamp, limitStep, deadband, exponentialFilter, servo step control (non-blocking, detect kẹt), `turnByAngle()` (xoay theo IMU với decel zone + timeout).
- **`src/main.cpp` — di chuyển thay bằng B3**:
  - Motor: `setTankRaw()`/`setTankSmoothed()` (mượt, giới hạn ±30/lần), `stopRobot()`, polarity `INVERT_LEFT=false` (M3), `INVERT_RIGHT=true` (M4).
  - PID chuẩn B3: KP=18, KI=0.002, KD=2, integral limit 8, filter alpha 0.45, deadband 0.05, base 46/min 24, max correction 72 — thay PID cũ (kp=1.5, integral không giới hạn).
  - Line sensor chuyển sang **I2C0** (`MXLineTracer.getAllSensors`) đúng robot thật (trước dùng I2C2), threshold 30; `computeZoneFollowError` bám cạnh phải (kênh 1-6, target 3.5).
  - Junction detection two-gate (width≥8 + kênh 9&10 cho cạnh phải) + `updateJunctionCounters` latch/debounce + còi — trong `patrolMove()` mỗi loop 1 bước `followRightEdgeStep()`.
  - `driveForwardCm()` (encoder M3, bánh 6.5cm), `followLineUntilLaserBelow()` (bám line tới khi laser < 200mm — dùng trong INSPECT_B thay while-loop cũ), `turnToAngle()` qua IMU Roll (board gắn đứng).
  - Khoảng cách 0.5m vẫn dùng trung bình encoder M3+M4; thêm fail-safe 15s/đoạn.
- **Khởi động**: `initRobot()` theo B3 — `MiniR4.begin()`, `PWR.setBattCell(2)`, LineTracer I2C0 + setThreshold(30), Laser I2C1, `Motion.begin()`, `initServosToHome()` (camera home: pan 90/fold 0/tilt 90/twist 90) + delay 400ms, `resetPid()`.
- `checkObstacle()` chỉ trigger khi `PATROL_MOVE` (trước trigger cả lúc INSPECT_B tiến tới tường ở 200mm → kẹt EMERGENCY); `handleJunction()` cũ bỏ (thay bằng junction counters).
- Giữ nguyên: BLE 1 service 6 chars, protocol 10-byte JPEG header / 12-byte detection, camera `'C'`/`'D'`, lệnh `P/X/C/N/S`, map marker 9 byte.

**Kiểm tra**: `pio run` SUCCESS (RAM 69.4%, Flash 47.5%).

### 2026-08-16 — Kịch bản demo app (DEMO-SCRIPT.md)

- Thêm `DEMO-SCRIPT.md` (gốc repo): kịch bản 3 chặng cho giám khảo WRO 2026 — (1) so sánh & lưu trữ theo node từ dữ liệu mẫu, (2) tuần tra trực tiếp qua mock/BLE, (3) edge AI 97.28% trên điện thoại không cần mạng — kèm checklist chuẩn bị, bản rút gọn 4 phút, và câu chốt trình bày.

### 2026-08-16 — Tái cấu trúc giả lập app: seed dữ liệu mẫu tự động + ảnh lưu node thật + camera/thư viện native

**Lý do**: user chưa thấy được compare & lưu trữ tại node (mock lưu ảnh 1×1 px, compare chỉ hiện sau 2+ tuần tra cùng node, History trống khi mở app), và camera hiện chỉ là web-view không chụp được trên máy thật.

**heriguard-app**
- `src/lib/fileStorage.ts`: thêm `savePatrolImageFromFile()` (copy JPEG asset thật vào `patrols/{id}/node_{x}/` thay vì base64 1×1) + `getNodeStorageDir()` (đường dẫn hiển thị UI).
- `src/lib/sim/simMedia.ts` (mới): ánh xạ node → ảnh asset ổn định (node 0–2 = bề mặt sạch wall/column, node 3+ = ảnh nứt heritage-cracks/wall-crack); `resolveSimUri()` dùng `expo-asset` để có file URI thật cho `copyAsync`.
- `src/lib/sim/seedDemoData.ts` (mới): tự sinh **3 lần tuần tra mẫu** (14/7/1 ngày trước), mỗi lần 7 node, diện tích nứt tăng dần theo thời gian (bbox rộng dần) → mở app là thấy ngay: History → chi tiết tuần tra → so sánh Δ → biểu đồ xu hướng → cảnh báo leo thang; đồng bộ `patrolStore.importPatrols()` + `detectionStore` + `alertStore` (4 cảnh báo trend node 3–6).
- `src/store/patrolStore.ts`: thêm action `importPatrols()` (merge + sắp mới nhất trước) cho seed.
- `src/app/_layout.tsx`: khởi động load lịch sử → nếu trống và chưa có demo trên đĩa thì `seedDemoData()` tự động.
- `src/app/patrol/node-detail.tsx`: thẻ "Lưu trữ tại node" hiển thị đường dẫn thư mục node thật trên đĩa.
- `src/lib/mockBle.ts`: mock patrol giờ lưu **JPEG thật** từ assets vào node folder (hết ảnh 1×1); detection/bbox vẫn tăng dần theo số lần tuần tra.
- `src/app/crack-recognition.tsx`: thay web-view bằng **camera native** (`expo-camera` `CameraView` + `takePictureAsync`) và **thư viện ảnh** (`expo-image-picker`) — chụp máy thật hoặc chọn ảnh từ gallery; giữ nguyên MLP 97.28% phân tích on-device + ảnh mẫu.
- Xóa file web-only: `src/lib/browser-camera.ts`, `src/components/BrowserCameraPreview.tsx` (đã thay bằng native).
- `app.json`: cài plugin `expo-camera` + `expo-image-picker` (bản quyền camera/thư viện tiếng Việt) + `CAMERA`, `READ_MEDIA_IMAGES`.
- Cài thư viện: `expo-camera`, `expo-image-picker` (SDK 57, đã xin phép user).

**Kiểm tra**: `tsc --noEmit` 0 lỗi; `expo lint` 0 lỗi.

### 2026-08-16 — Hủy Plan "phương án B" (port MLP 97.28% lên M-Vision) — blocker lưu trữ

- **Lý do hủy**: khảo sát camera (GĐ 0) cho thấy flash trống chỉ **101 KB** (firmware chiếm gần hết 2 MB), không có khe SD → `crack_w.bin` (405 KB) không thể nạp. Thí nghiệm fp8/fp4 trên PC: fp8 giữ nguyên dung lượng (405 KB), fp4 còn 207 KB — đều vượt 101 KB; chỉ model ít trọng số hơn (≤ ~80 KB) mới vừa, nhưng pipeline huấn luyện không tồn tại trên git (branch `feature/edge-ai-recognition` chỉ chứa `crack-model.ts` nhúng + ảnh mẫu).
- **Đã revert**: xóa branch `feature/mvision-mlp-model`; xóa `PLAN-EDGE-AI-MVISION-MODEL.md`, `camera/model.py`, `camera/crack_w.bin`, `camera/crack_meta.json`, toàn bộ `tools/` (export/ground-truth/parity/quant-test); hoàn nguyên `.gitignore` + 2 mục changelog của plan B. Giữ nguyên toàn bộ Phase A/B/C, lệnh 'N', VirtualMap, mock BLE.
- **Hướng thay thế (đang đề xuất)**: chạy đúng model 97.28% (crack-model.ts) **trên app** với khung hình thật từ robot qua BLE/MQTT — điện thoại tắt mạng vẫn chạy (edge AI cục bộ), camera giữ heuristic (bbox + JPEG).

### 2026-08-16 — Lệnh test tĩnh 'N' (test camera/edge-AI không cần robot di chuyển)

**heriguard-robot `src/main.cpp`**
- `handleCommand()`: thêm lệnh `'N'` = static inspect — chụp JPEG + gọi edge-AI `'D'` + gửi detection 12 byte + map marker ngay khi robot đứng yên trên bàn (không cần Start Patrol). Dùng để test nhanh camera/edge-AI khi chưa có bàn chạy line.
- `sendDetectionViaBle()`: điền đúng temp/humidity vào 4 byte cuối (trước đây để 0 → app phải fallback sang dashboard).

**heriguard-app**
- `src/components/dashboard/ControlPanel.tsx`: nút "Chụp ảnh" → gửi `'N'`, đổi nhãn "Chụp + Nhận diện" — bấm 1 phát là thấy ảnh + detection, không cần chạy tuần tra.
- `src/lib/mockBle.ts`: `mockSendCommand()` trả `boolean` (sửa bug có sẵn: mock mode bấm nút luôn hiện alert "Không gửi được lệnh" vì `void` → `!ok` luôn đúng); thêm case `'N'` — mock thêm ảnh + detection giả (crack_small 72%).

**Kiểm tra**: firmware `pio run` SUCCESS; app `tsc --noEmit` 0 lỗi, `expo lint` 0 lỗi (1 warning có sẵn trong BrowserCameraPreview.tsx, không liên quan).

### 2026-08-16 — Bản đồ mô phỏng: ảnh guard làm nền + chấm đỏ điểm dừng

**heriguard-app**
- `src/components/dashboard/VirtualMap.tsx`: thay bản đồ dải chấm ngang cũ bằng **bản đồ mô phỏng** — dùng ảnh `assets/images/guard.png` làm nền bản đồ (resizeMode cover), vẽ đường tuần tra ngang qua giữa, và **chấm đỏ (`Colors.lacquer`) tại từng điểm robot dừng** (marker theo `distanceX2`, tỷ lệ theo quãng đường tối đa). Chạm vào chấm xem tooltip chi tiết (vấn đề, nhiệt độ/độ ẩm). Thêm chú thích dưới bản đồ; dedupe marker trùng vị trí.
- **Kiểm tra**: `tsc --noEmit` 0 lỗi, `expo lint` 0 lỗi mới.

### 2026-08-16 — Phase B+C: Firmware Edge-AI thật + protocol 10/12-byte + UI chi tiết tuần tra

**heriguard-robot `src/main.cpp`**
- **Detection thật thay mock**: `inspectWide()` bỏ `random()` — gọi `captureJpegFromCam()` + `readDetectionFromCam()` (lệnh `'D'` lên camera), có issue → INSPECT_B, sạch → INSPECT_E. Gửi cờ MOSS/MOLD/STAIN/CRACK qua map marker tương ứng.
- **Bật INSPECT_B/C/D** trong `runStateMachine()` (trước bị comment): chụp cận khi pan phải/trái — `inspectCloseApproach()`, `inspectScanLow()`, `inspectScanHigh()` (mỗi vị trí capture + detect + send). Thêm `inspectRetractFull()`.
- **Servo điều khiển camera**: define `SERVO_PAN_L/C/R` (45/90/135), `SERVO_TILT_LOW/HIGH/HOME` (45/135/90), `SERVO_TWIST_*`, hàm `servoHome()` (gọi khi bắt đầu tuần tra) + `servoPan()`.
- **Header JPEG 10 byte** (trước 6): `frameId(2)+nodeX2(1)+shotKind(1)+pan(1)+tilt(1)+chunkIdx(2)+totalChunks(2)` — app hết phải suy đoán node.
- **Detection char 12 byte** (trước 10): `label(1)+confidence(1)+nodeX2(1)+shotKind(1)+bbox(4)+temp(2)+humidity(2)` qua `sendDetectionViaBle()`; `sendMapMarker()` nay nhận cờ 8-bit.
- **Junction**: thêm `handleJunction()` (rẽ phải vuông góc theo cảm biến dừng) — chưa gọi trong `patrolMove()` (để dành bước tiếp theo).
- `MAX_DETECTIONS = 8` — camera trả tối đa 8 kết quả.

**heriguard-robot `camera/main.py`**
- Lệnh `'D'` phân loại **5 label**: crack_small/crack_large (eccentricity > 0.6 + diện tích), moss/mold/stain (3 ngưỡng màu riêng) — giảm false positive do bóng/rêu/nấm mốc. Trả `0xDD + count + N×6 byte [x,y,w,h,label,confidence]` (bbox QQVGA ÷4).

**heriguard-app**
- `src/lib/ble.ts`: `handleCameraChunk()` parse header 10 byte (nodeX2/shotKind/pan/tilt **từ firmware**); `handleDetectionData()` parse 12 byte — bbox ×4 về 640x480, temp/humid từ packet (fallback dashboardStore). Detection được đưa vào `patrolStore.addDetectionEvent()` + alert khi confidence cao.
- **Mới `src/app/patrol/[id].tsx`**: màn chi tiết tuần tra — card tổng quan, NodeCard từng node (badge severity, ảnh node, detection meta, delta vs tuần tra trước, TimelineChart, cảnh báo escalation), điều hướng tới node-detail.
- **Mới `src/app/patrol/node-detail.tsx`**: so sánh ảnh trước/sau (ImageCompareCard), deltaCard (deltaArea %, confidence, nhiệt độ), timeline chart, chip góc chụp (SHOT_KIND_LABELS).
- `src/app/(tabs)/history.tsx`: thêm **patrol list với node summaries** — tên + ngày, số node/ảnh, chấm severity, dòng cảnh báo node có dấu hiệu; chạm vào → `/patrol/{id}`.
- `src/store/patrolStore.ts`: `endPatrol()` chạy `shouldEscalateForConsecutiveGrowth()` cho từng node/shot → `useAlertStore.addAlert({ type: "crack_increased" })` khi diện tích tăng liên tiếp qua các tuần tra.
- **Kiểm tra**: `tsc --noEmit` 0 lỗi (regenerate typed routes cho 2 route patrol mới), `expo lint` 0 lỗi (dọn import thừa trong `[id].tsx` — useEffect, SHOT_KIND_LABELS, RiskColors, biến timelineAll), firmware `pio run` SUCCESS 0 warning.

### 2026-08-15 — Phase A: Node-based image storage + patrol persistence + comparison

**heriguard-app** (toàn bộ phía app, không cần đổi firmware)

- **Mới `src/lib/analyze.ts`**: phân tích 1 ảnh đơn — kết hợp detection Edge-AI (confidence + bbox area) với môi trường (temp/humidity/laser) → severity (low/medium/high) + findings tiếng Việt. `shouldEscalateForTrend()` cho logic cảnh báo.
- **Mới `src/lib/compare.ts`**: so sánh cùng node giữa các lần tuần tra — `findPreviousImage()` (khớp nodeX2 + shotKind), `computeNodeDelta()` (deltaArea %, deltaConfidence, delta temp/hum, trend), `getNodeTimeline()` (chuỗi thời gian cho chart), `shouldEscalateForConsecutiveGrowth()` (cảnh báo tăng liên tiếp).
- **Mới `src/types/robot.ts`**: `NodeImage` (uri, frameId, nodeX2, shotKind, pan/tilt, detection, analysis), `DetectionEvent` (link detection → node + shot), mở rộng `PatrolSession` với `images[]`, `detections[]`, giữ `imageUris[]` tương thích ngược. Thêm `SHOT_KIND_LABELS`, `CrackSeverity`.
- **Mới `src/lib/fileStorage.ts`**: `savePatrolImage()` → lưu ảnh vào `Documents/heriguard/patrols/{id}/node_{nodeX2}/shot_{kind}_{frameId}.jpg` + cập nhật `patrol.json` manifest; `readPatrolJson()`, `updatePatrolJson()`, `listPatrolDirs()`, `loadPersistedPatrols()`.
- **`src/store/patrolStore.ts`**: `addNodeImage()`, `addDetectionEvent()`, `endPatrol()` (ghi patrol.json lên đĩa), `loadPersistedHistory()` (đọc tất cả tuần tra khi khởi động app → dữ liệu sống sót qua restart).
- **`src/lib/ble.ts`**: `handleCameraChunk()` lưu ảnh theo node + cập nhật patrol khi tuần tra đang chạy (fallback legacy khi không có patrol); `handleDetectionData()` tạo `DetectionEvent` gắn nodeX2/shotKind.
- **`src/lib/mockBle.ts`**: mock có tính lặp lại — cùng node = cùng URI ảnh qua các tuần tra, detection tăng dần theo số tuần tra (demo xu hướng vết nứt, ~43% tăng).
- **`src/app/_layout.tsx`**: gọi `loadPersistedHistory()` khi app khởi động.
- **Sửa lỗi TS**: type predicate `TimelinePoint` (severity dùng `CrackSeverity`), `NodeImage.detection/analysis` cho phép `null` (khớp JSON khi persist), bỏ import thừa, bỏ `as any` trong mockBle. Regenerate typed routes (fix lỗi sẵn có `router.push("/crack-recognition")`).
- Docs mới: `QUICK-START.md` (hướng dẫn test), `PHASE-A-COMPLETION.md`, `PHASE-A-TESTING.md`, `EDGE-AI-ASSESSMENT.md`.

### 2026-08-13 — Fix LED không sáng (sai API setColor) + log lỗi DHT

**heriguard-robot `src/main.cpp`**
- **LED không bao giờ sáng từ đầu** — `MiniR4.LED.setColor(r, g, b, brightness)` là call sai: API thư viện MatrixMiniR4 là `setColor(idx, r, g, b)` với `idx` ∈ {1, 2} (2 LED WS2812B). Truyền tham số thứ nhất = 0 → `setColor` trả `false`, LED không đổi màu (xanh lá lúc kết nối trước đây thực ra chưa từng sáng — chỉ có còi). Thêm helper `setLedColor(r, g, b)` set cả 2 LED, thay toàn bộ 9 call cũ: xanh dương nhấp nháy khi chưa kết nối, xanh lá + còi khi connect, đỏ flash khi capture fail.
- `readSensor()`: in lỗi DHT ra serial (`getErrorString`: 253 timeout / 254 checksum) — nếu `T=0.0 H=0` thì biết ngay sensor MS-011 chưa gắn/đấu dây ở cổng D1 thay vì đoán mò.

### 2026-08-13 — Fix lưu ảnh JPEG từ robot (expo-file-system new API)

**heriguard-app `src/lib/ble.ts`**
- `saveJpegBytes()`: thay `root.createDirectory("")` (sai API — báo "child name must be a single path segment") bằng `root.create({ intermediates: true, idempotent: true })` — tạo đủ chuỗi `heriguard/camera/frames` và an toàn khi gọi lại.
- Thêm fallback khi `createFile` lỗi do file trùng tên (frameId lặp lại sau khi firmware reset): xoá file cũ rồi tạo mới — trước đây promise throw "Uncaught" và ảnh không hiển thị.

### 2026-08-13 — Fix lỗi kết nối "Device is not connected" khi auto-reconnect / scan

**heriguard-app `src/lib/ble.ts`**
- `connectToDevice()` → tách `doConnectToDevice()` + single-flight: nếu một luồng connect đang chạy (auto-reconnect ở dashboard + người dùng bấm Kết nối ở scan screen), lời gọi sau dùng chung promise đó. Trước đây hai luồng chạy song song, kết nối của luồng đầu bị luồng sau hủy → "BLE connect error: Device ... is not connected" khi discover service trên connection đã chết.
- `await device.isConnected()` (không phải property — ble-plx trả `Promise<boolean>`); vẫn giữ nguyên tắc không gọi `connect()` trên device đã connected.
- Bắt lỗi connect báo "already connected" (errorCode 5) → dùng thẳng device, KHÔNG `cancelConnection()` (trước đây sẽ giết kết nối đang sống).
- Discover thất bại với "not connected" (errorCode 6) / timeout (errorCode 2) → tự hủy kết nối rớt rồi `connect()` + discover lại 1 lần trước khi báo lỗi — xử lý trường hợp robot reset/hết pin/ra ngoài phạm vi ngay sau khi connect() resolve.
- `mapBleError()`: thêm message rõ ràng cho "not connected": robot tắt / ngoài phạm vi.

### 2026-08-13 — Fix ảnh camera + sensor không về app (mock off / BLE thật)

**heriguard-app `src/lib/ble.ts`**
- `subscribeToCharacteristic()`: monitor TRỰC TIẾP, bỏ gating qua `readCharacteristicForService().then(monitor)`. Trước đây nếu lần read đầu thất bại (điển hình charCamera 512B — long read dễ lỗi trên Android), `monitorCharacteristicForService` không bao giờ được gọi và lỗi bị `.catch(() => {})` nuốt im lặng → app **không nhận bất kỳ notification nào**: không ảnh, không sensor, không status. Nguyên nhân gốc của cả 2 lỗi "Chụp ảnh không gửi ảnh về" và "tắt mock thì nhiệt độ/độ ẩm không được ghi nhận".
- `connectToDevice()`: nếu `device.isConnected` đã đúng thì dùng thẳng device, không gọi `connect()` lại. Trước đây khi toggle mock OFF (settings gọi `stopMockBle()` reset state thành "disconnected" dù BLE thật vẫn sống), HomeScreen chạy `tryReconnectLastDevice()` → `connect()` trên device đã connected → lỗi → `cancelConnection()` **giết chết kết nối thật đang hoạt động** → sensor ngừng chảy.
- `tryReconnectLastDevice()`: guard sớm — nếu `bleConnected` trong dashboardStore đã true thì trả về true ngay (không kết nối lại làm gì).
- `handleMapMarker()`: thêm `addSensorLog()` (nhiệt độ/độ ẩm tại marker) vào phiên tuần tra — trước đây tuần tra BLE thật chỉ thêm marker, sensor log không bao giờ được ghi → lịch sử tuần tra trống dữ liệu nhiệt độ/độ ẩm.

**heriguard-robot `src/main.cpp`**
- `captureJpegFromCam()`: flush hết byte rác trong `Serial1` trước khi gửi trigger `'C'` — banner "CAM READY" lúc camera khởi động hoặc dữ liệu cũ còn trong buffer làm header `0xAA` sai → "bad header" → capture fail.
- `sendJpegViaBle()`: `delay(5)` → `delay(25)` giữa các chunk 206B — 5ms quá nhanh, Android thả notification khi GATT queue bận → thiếu chunk → app không bao giờ ghép đủ frame → ảnh không hiển thị.

### 2026-08-13 — Fix gửi lệnh BLE thất bại (invalid data format)

**heriguard-app `src/lib/ble.ts`**
- `sendCommand()`: mã hoá lệnh sang **Base64** trước khi `writeCharacteristicWithResponseForService` — ble-plx/Android từ chối chuỗi trần (`BleError: Cannot write ... invalid data format: C`). Nguyên nhân khiến nút "Bắt đầu tuần tra / Chụp ảnh / Dừng" bấm nhưng robot không nhận lệnh dù đã kết nối thành công (LED xanh lá).


### 2026-08-13 — Firmware: LED nhấp nháy xanh dương khi chưa kết nối BLE

**heriguard-robot `src/main.cpp`**
- Khi chưa kết nối BLE: LED RGB nhấp nháy màu xanh dương (chu kỳ 500ms, non-blocking bằng `millis()`) — người dùng biết robot đang chờ ghép nối.
- Khi kết nối thành công: đã có sẵn âm thanh còi (880Hz → 1100Hz) + LED chuyển xanh lá (`onBLEConnected`); giữ nguyên.
- Khi mất kết nối: LED về xanh dương và tiếp tục nhấp nháy (`onBLEDisconnected`).

### 2026-08-13 — Sửa lỗi kết nối BLE app (không lên LED xanh / không gửi được lệnh)

**heriguard-app `src/lib/ble.ts`**
- `connectToDevice()`: thêm timeout cho `device.connect()` (12s) và `discoverAllServicesAndCharacteristics()` (10s) — trước đây có thể kẹt vĩnh viễn ở trạng thái "connecting" khi Android không trả lời → mọi nút điều khiển chết âm thầm.
- `requestMTU(512)` không còn `await` — trên một số máy Android lời gọi này treo không bao giờ resolve; thất bại MTU chỉ giảm kích thước gói, không ảnh hưởng lệnh điều khiển.
- Lỗi kết nối giờ trả về message tiếng Việt rõ ràng (`mapBleError`): timeout, bị rớt, service không tìm thấy, lỗi cache/bond — màn hình quét hiển thị lý do thật thay vì "Thử lại" chung chung.
- `disconnect()` khi connect thất bại giữa chừng: `cancelConnection()` dọn kết nối dang dở.
- Thêm `tryReconnectLastDevice()` + lưu thiết bị cuối vào AsyncStorage (`heriguard:lastDevice`) → khi mở lại app, tự kết nối lại robot đã ghép, không phải quét lại từ đầu.
- `sendCommand()`: log lỗi thật (`console.warn`) để dễ debug khi write thất bại.

**heriguard-app `src/app/device/scan.tsx`**
- Hiển thị đúng lỗi kết nối trả về từ `connectToDevice()` (khớp kiểu trả về mới).

**heriguard-app `src/app/(tabs)/index.tsx`**
- Thanh trạng thái kết nối hiển thị đúng trạng thái thật: "Chưa kết nối BLE — vào Cài đặt để quét" / "Đang kết nối…" / "Đã kết nối BLE — {tên}" (trước đây luôn hiện "Đang kết nối…" khi chưa kết nối → gây hiểu nhầm).
- Khi không bật mock mode: tự gọi `tryReconnectLastDevice()` lúc mở dashboard.
- Không gọi `stopMockBle()` khi đang dùng BLE thật (trước đây cleanup có thể ghi đè trạng thái kết nối thật thành "disconnected").

**heriguard-app `src/components/dashboard/ControlPanel.tsx`**
- Nút điều khiển khả dụng khi `isConnected || mockMode`: khôi phục chế độ demo mock khi chưa có robot, đồng thời giữ ưu tiên BLE thật khi đã kết nối.
- Cảnh báo gửi lệnh thất bại có hướng dẫn: "Kiểm tra kết nối BLE với robot (Cài đặt → Quét thiết bị)".


### 2026-08-13 — Sửa BLE + Camera M-Vision

**heriguard-robot `src/main.cpp`**
- Bỏ `BLE.setMTU(517)` — API không tồn tại trong ArduinoBLE 1.5.0 (bản dùng cho UNO R4 WiFi) → lỗi compile. MTU được set tự động trong `HCI.begin()`: `ATT.setMaxMtu(pktLen - 9)` = 242 (HCI pktLen 251 của ESP32-S3).
- `JPEG_CHUNK_PAYLOAD 506 → 200`: với MTU max 242, notification chỉ chở được 239B payload (242 - 3 ATT header); chunk 506B bị cắt cụt → ảnh không bao giờ reassemble. 200 + 6B header = 206B ≤ 239B.
- **Camera:** khôi phục luồng JPEG đúng protocol của firmware camera tùy chỉnh (`camera/main.py` — MicroPython gửi JPEG qua UART 921600, trigger `'C'`, frame `0xAA + length(2B BE) + data + checksum XOR`):
  - Giữ `Serial1.begin(921600)`; JPEG buffer 6000 (khớp QQVGA quality 60 ~3-6KB vừa RAM).
  - `captureJpegFromCam()` TIMEOUT 3000ms, guard `length > JPEG_BUF_SIZE`.
  - Lệnh `'C'` → capture + `sendJpegViaBle()` chunk 200B → LED vàng/vàng-xanh/đỏ-nháy theo kết quả.
- *(Ghi chú: đã thử nhầm hướng dùng `MiniR4.Vision.SmartCamReader()` protocol stock 115200 — không hợp vì camera đang chạy firmware JPEG tùy chỉnh; đã hủy.)*

**heriguard-app `src/lib/ble.ts`**
- Scan: lọc theo **service UUID** (không chỉ dựa vào `device.name`) — ArduinoBLE bỏ local name khỏi advertisement khi flags + 128-bit UUID + name > 31 byte → `device.name = null` trên Android → app không tìm thấy robot.
- Thêm `getBleState()`, `tryEnableBluetooth()`, `waitForPowerOn()`, `openLocationSettings()`.
- `startScan()` nhận callback `onError`, tự `stopDeviceScan()` khi lỗi.
- `handleDetectionData()`: confidence từ camera 0–100 → chuẩn hóa `/100` thành 0–1 (khớp mock).

**heriguard-app `src/app/device/scan.tsx`**
- Trước khi quét: kiểm tra quyền → tự bật Bluetooth → lỗi tiếng Việt rõ ràng khi Bluetooth tắt / Location tắt.
- Hiển thị nút "Mở Cài đặt Vị trí" khi lỗi Location; nút "Quét lại".

**heriguard-app `src/components/dashboard/ControlPanel.tsx`**
- Ưu tiên BLE thật khi đã kết nối thiết bị; mock chỉ dùng khi chưa kết nối (mockMode vẫn bật mặc định nhưng không nuốt lệnh điều khiển robot thật).
- Gửi lệnh fail → Alert "Không gửi được lệnh".

## 2026-08-12 (working copy, chưa commit)

### fix: xóa hardcoded API key trong settingsStore

**heriguard-app**
- `src/store/settingsStore.ts`: `geminiApiKey` lấy từ `DEFAULT_GEMINI_API_KEY` (config/apiKey), `geminiMockMode: false`.

### feat: nâng cấp AI, camera, BLE và dashboard (commit `74fa757`)

- App: request MTU 512 khi kết nối Android; scan lại tự động sau khi vào màn hình.
- Robot: chuyển sang dùng `MiniR4.Motion.getAccel()`; giảm `JPEG_BUF_SIZE` 60000 → 6000; timeout JPEG 3000 → 1000ms.
- Camera tab: bỏ hằng số OSD thừa.

## 2026-08-XX — Các commit trước

| Commit | Mô tả |
|---|---|
| `55c222a` | docs: cập nhật PLAN.md khớp trạng thái thực tế |
| `5fcaec2` | fix: xóa hardcoded API key trong settingsStore |
| `69bf072` | chore: gỡ expo-blob và xóa PLAN-BLE-CAMERA-AI.md |
| `74fa757` | feat: nâng cấp AI, camera, BLE và dashboard |
| `d9af414` | docs: Cập nhật PLAN.md — đồng bộ tiến độ thực tế |
| `2307c33` | Hoàn thiện app + AI crack detection + Gemini integration |
| `0027fcf` | feat: cập nhật app & firmware — AI, camera, BLE, dashboard components, patrol/detection stores |
| `9a46c49` | Initial commit — Heriguard B4 Full Project (app + robot firmware) |