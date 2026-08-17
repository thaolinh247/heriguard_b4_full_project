# VIỆC CÒN LẠI — HERI-GUARD (cập nhật 2026-08-17)

> App: ✅ TSC 0 lỗi / lint 0 lỗi. Firmware: ✅ `pio run` SUCCESS (RAM 69.4%, Flash 47.8%).

---

## ✅ ĐÃ HOÀN THÀNH (so với bảng cũ 2026-08-16)

### A1. Di chuyển
| # | Việc | Kết quả |
|---|------|---------|
| 1 | `handleJunction()` gọi từ patrol | ✅ gọi từ `followRightEdgeStep()` khi junction latch (2 frame liên tiếp) → `turnToAngle()` rẽ 90° IMU + reset encoder/PID |
| 2 | Can vuông góc | ⏭️ BỎ — bàn 6m thẳng không có line cắt ngang; robot tự thẳng hàng với line (ghi chú CHANGELOG 2026-08-16) |
| 3 | PID B3 | ✅ KP=18/KI=0.002/KD=2, lọc alpha 0.45, deadband 0.05, limitStep, setTankSmoothed |
| 4 | Xử lý mất line | ✅ active < 2 sensor × 3 frame → dừng; mất > 3s → EMERGENCY + BLE status |
| 5 | Đi thẳng quãng đường | ✅ `driveForwardCm()` + encoder 0.5m target; INSPECT_B dùng laser 15-20cm |

### A2. Edge AI firmware
| # | Việc | Kết quả |
|---|------|---------|
| 6 | Bỏ comment `captureJpegFromCam()` | ✅ chụp chủ động tại INSPECT_A/B/C/D |
| 7 | Detection thật từ camera | ✅ `readDetectionFromCam()` — lệnh `'D'`, parse 0xDD+count+N×6 byte |
| 8 | Bật INSPECT_B/C/D | ✅ state machine đầy đủ |
| 9 | Capture + detect tại mỗi pan | ✅ B: 1 shot close-up; C: 3 vị trí pan + detect; D: tương tự cao |
| 10 | Header camera 10 byte | ✅ frameId+nodeX2+shotKind+pan+tilt+chunkIdx+total |
| 11 | Detection 12 byte | ✅ label+conf+nodeX2+shotKind+x,y,w,h+temp,hum |
| 12 | `captureAndSendDetection()` | ✅ thay bằng luồng mới: capture → sendJpegViaBle; detect → sendDetectionViaBle |

### B. App
| # | Việc | Kết quả |
|---|------|---------|
| 13 | History + "Lưu trữ theo node" | ✅ history.tsx: ảnh từng lần tuần tra ngang hàng + Δ severity + so sánh |
| 14 | Node detail | ✅ `patrol/node-detail.tsx` + `getNodeTimeline()` + escalate |
| 15 | Nối cảnh báo xu hướng | ✅ patrolStore dùng `shouldEscalateForConsecutiveGrowth()` |
| 16 | Ảnh thật từ patrol | ✅ luồng BLE thật + staticCapture (lệnh 'N') |

---

## C. TEST THẬT (Phase 6 — còn lại)

| # | Việc | Ghi chú |
|---|------|---------|
| 1 | Line follow 6m track — dừng đúng mỗi 0.5m | cần track thật |
| 2 | Junction rẽ 90° tại giao điểm (nếu track có) | chưa test — code đã làm, cần track có line rẽ |
| 3 | Camera + detection thật (vết nứt giả trên tường) | test tĩnh bằng lệnh 'N' + OpenMV IDE 'D' |
| 4 | Điều khiển từ app: Start/Stop/Capture | app đã sẵn sàng |
| 5 | Virtual map hiển thị đúng vị trí | đã có, test thật |
| 6 | End-to-end 1 tuần tra hoàn chỉnh + restart app giữ dữ liệu | QUICK-START.md |
| 7 | Demo prep: video, slides | chưa |

## D. Camera OpenMV (main.py)

| # | Việc | Hiện trạng |
|---|------|-----------|
| 1 | Giảm false positive (moss/mờ/shadow trùng vết nứt — chỉ là dark blob) | chưa |
| 2 | Gửi kèm nodeX2/shotKind trong detection | chưa — firmware tự gán 2 giá trị này khi nhận |
| 3 | Phân biệt label: crack/moss/mold/stain (app đã map id 0-4) | blob tạm đủ cho demo |

---

## ĐỀ XUẤT THỨ TỰ LÀM TIẾP

1. **Test thật trên track** (C.1-C.2) — đây là việc duy nhất cản demo
2. Test ảnh trên tường thật với lệnh 'N' (C.3)
3. Demo prep (C.7)