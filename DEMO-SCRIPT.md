# KỊCH BẢN DEMO — HERI-GUARD (WRO 2026, NovaCulture)

Kịch bản trình diễn app HERI-GUARD trước ban giám khảo. Toàn bộ demo **không cần mạng** — AI chạy trên thiết bị, dữ liệu lưu cục bộ.

---

## ✅ Chuẩn bị trước khi demo (2 phút)

| Việc | Cách làm |
|------|----------|
| Seed dữ liệu mẫu | Mở app ít nhất 1 lần trước → lần khởi động đầu, History trống sẽ **tự tạo 3 tuần tra mẫu** (14/7/1 ngày trước) |
| Ảnh mẫu trong gallery | Chụp sẵn **2–3 ảnh tường nứt thật** vào thư viện điện thoại (nguồn sống nhất cho chặng 3) |
| Bật mô phỏng | Cài đặt → bật **Mô phỏng** (mock BLE) |
| Chứng minh offline | Bật **máy bay** (airplane mode) — AI + seed + so sánh đều cục bộ |

> Kiểm tra nhanh: vào **Lịch sử** → phải thấy 3 tuần tra "…ngày trước". Vào **Cảnh báo** → 4 cảnh báo leo thang node 3–6.

---

## 🕐 Chặng 1 — So sánh & lưu trữ theo node (~2 phút)

Mục tiêu: chứng minh app lưu trữ đúng theo node và so sánh xu hướng giữa các lần tuần tra.

1. Mở tab **Lịch sử** → ngay đầu tab là mục **"Lưu trữ theo node"**: mỗi node 1 thẻ, **ảnh từng lần tuần tra ngang hàng** (có ngày + màu mức độ) + **Δ diện tích** so lần trước (▲ đỏ = mở rộng).
2. Chạm vào thẻ một node (vd Node 3) → mở so sánh chi tiết:
   - **So sánh 2 ảnh** "Lần trước / Gần nhất" — cùng node, cùng góc chụp
   - **So sánh**: Δ diện tích, Δ độ tin cậy, Δ nhiệt độ
   - **Xu hướng**: 3 cột diện tích tăng dần + cảnh báo "tăng liên tiếp"
   - **"Lưu trữ tại node"**: chỉ đường dẫn thật `patrols/demo-3/node_3/…` → *"mỗi node một thư mục riêng, giữ nguyên qua các lần tuần tra để đối chiếu"*
3. Cuộn xuống danh sách tuần tra → bấm tuần tra **"1 ngày trước"** → thẻ Tổng quan (số node, ảnh, phát hiện).
4. Mở tab **Cảnh báo** → 4 cảnh báo leo thang node 3–6 (đã sinh sẵn từ dữ liệu mẫu).

---

## 🕐 Chặng 2 — Tuần tra trực tiếp (~2 phút)

Mục tiêu: chứng minh vòng vận hành đầy đủ — robot (giả lập) chạy, ảnh thật lưu theo node, compare chạy ngay.

1. Về **Dashboard** → bấm **"Bắt đầu tuần tra"**.
2. Robot giả di chuyển, **3 giây/node**, mỗi node hiện **ảnh JPEG thật** (lưu vào `patrols/{id}/node_{x}/`).
3. Chạy 6 node (~18s) → tự kết thúc.
4. Mở **Lịch sử** → tuần tra mới nhất → vì đã có 3 tuần tra seed, **so sánh chạy ngay lần đầu** — xu hướng nối tiếp mượt mà.
5. Ngoài ra: bấm **"Chụp + Nhận diện"** (lệnh 'N') → robot **chỉ chụp và gửi ảnh về**, app chạy model 97.28% ngay trên ảnh: nếu đạt ngưỡng → lưu ảnh + nhiệt độ/độ ẩm tại node + phân tích như tuần tra (xuất hiện trong Lịch sử & Lưu trữ theo node); nếu sạch → chỉ hiện trên ảnh hiện trường.

> Nếu có robot thật: chặng này dùng BLE — Cài đặt → Quét thiết bị → kết nối `HERI-GUARD-01` → cùng luồng nút bấm, ảnh thật từ camera M-Vision.

---

## 🕐 Chặng 3 — Edge AI trên điện thoại, offline (~2 phút)

Mục tiêu: chứng minh AI 97.28% chạy ngay trên thiết bị, không cần mạng.

1. Mở **"Nhận diện vết nứt"** (từ camera tab).
2. **Chụp trực tiếp** bằng camera điện thoại (camera native) → model khoanh vùng + độ tin cậy hiện ngay.
3. Bấm **"Thư viện ảnh"** → chọn ảnh tường nứt đã chụp sẵn → kết quả tương tự.
4. Nếu camera chưa được cấp quyền → bấm **"Chạy ảnh mẫu có vết nứt"** (ảnh thật từ tập test).
5. Chỉ lên icon máy bay: *"Đang ở chế độ máy bay — không có mạng, AI vẫn chạy."*

---

## 🎤 Câu chốt với giám khảo (~30 giây)

> "Robot tuần tra, gửi ảnh từng node về app; lệnh 'Chụp & Nhận diện' — robot chỉ chụp, app chạy model 97.28% trên chính ảnh đó, hoàn toàn offline. Dữ liệu mỗi node được lưu thành file thật trên thiết bị, mỗi node một thư mục riêng để so sánh theo thời gian; khi nứt tăng liên tiếp, app tự cảnh báo."

---

## ⏱️ Bản 4 phút (cắt ngắn)

Nếu chỉ có 4 phút, ưu tiên: **Chặng 1 → Chặng 3** (bỏ tuần tra live, chỉ nhắc nhanh ControlPanel). Dữ liệu mẫu + AI offline là 2 thứ ấn tượng nhất.

## 🔄 Quy trình thao tác app (tóm tắt)

```
Kết nối (mock hoặc BLE thật)
  → Bắt đầu tuần tra ('P') / Chụp + Nhận diện ('N': robot chỉ chụp)
  → Robot quét → ảnh JPEG + sensor → app lưu theo node
  → App chạy model 97.28% trên ảnh → đạt ngưỡng: lưu ảnh + nhiệt/ẩm tại node
  → Lịch sử + Lưu trữ theo node + So sánh + Xu hướng + Cảnh báo
```