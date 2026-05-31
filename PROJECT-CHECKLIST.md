# PROJECT IMPLEMENTATION PLAN & CHECKLIST

> Dự án: **Hệ thống đặt sân thể thao trường học**  
> Tài liệu này dùng cho team và coding agents để nắm context, chia module, theo dõi tiến độ và phối hợp phát triển từ backend đến frontend.  
> Tech stack: **Node.js + Express + TypeScript + React + TypeScript + PostgreSQL + Prisma**.  
> Nguồn nghiệp vụ chính: `agent-spec.md` / `final-agent-spec.md`.

---

## 1. Mục tiêu tài liệu

Tài liệu này dùng để:

1. Tóm tắt đúng context nghiệp vụ đã chốt.
2. Chia hệ thống thành module rõ ràng.
3. Gắn từng module với checklist task cụ thể.
4. Giúp team biết module nào đã xong, module nào đang làm, module nào còn thiếu.
5. Làm tài liệu điều phối khi nhiều người hoặc nhiều coding agents cùng phát triển.

Quy ước trạng thái task:

| Trạng thái | Ý nghĩa |
|---|---|
| `[ ]` | Chưa làm |
| `[~]` | Đang làm / làm dở |
| `[x]` | Đã hoàn thành |
| `[!]` | Bị block hoặc cần quyết định thêm |

---

## 2. Context nghiệp vụ đã chốt

### 2.1 Mô hình hệ thống

Hệ thống quản lý đặt sân thể thao trong trường học, gồm:

- Quản lý sân.
- Quản lý loại sân.
- Quản lý khung giờ hoạt động.
- Quản lý bảng giá.
- Đặt sân.
- Giữ chỗ tạm thời.
- Thanh toán toàn bộ chi phí.
- Check-in bởi ban quản lý sân.
- Hoàn thành buổi sử dụng.
- Xử lý no-show / quá giờ check-in.
- Hủy sân và hoàn tiền.
- Quản lý vi phạm.
- Danh sách chờ.
- Thông báo.
- Báo cáo thống kê.
- Quản trị người dùng và phân quyền.

### 2.2 Actors chính

| Actor | Vai trò |
|---|---|
| Người đặt sân | Xem sân, xem lịch trống, đặt sân, thanh toán, hủy sân hợp lệ, xem lịch sử |
| Ban quản lý sân / Field Manager | Xác nhận check-in, hoàn thành, no-show, cập nhật tình trạng sân, hủy lịch do phía sân |
| Quản trị viên / Admin | Quản lý toàn hệ thống, cấu hình nghiệp vụ, phân quyền, báo cáo |
| Hệ thống | Tự động hủy đơn quá hạn thanh toán, phát hiện quá giờ check-in, gửi thông báo |
| Cổng thanh toán | Xử lý thanh toán và hoàn tiền |

### 2.3 Luồng booking đã chốt

Booking là **auto approval**, không có admin duyệt tay booking thông thường.

```text
1. User chọn sân + khung giờ
2. System validate điều kiện đặt sân
3. System tạo booking hold
4. Booking = PENDING_PAYMENT
5. User thanh toán 100%
6. Payment success
7. Booking = CONFIRMED
8. Đến giờ sử dụng, Field Manager check-in
9. Booking = IN_USE
10. Field Manager hoàn thành
11. Booking = COMPLETED
```

### 2.4 Quy tắc thanh toán

- Không hỗ trợ đặt cọc.
- User phải thanh toán 100% trước khi booking được xác nhận.
- Booking mới tạo có trạng thái `PENDING_PAYMENT`.
- Slot được giữ tạm thời bằng `hold_expires_at`.
- Nếu thanh toán thành công, booking chuyển sang `CONFIRMED`.
- Nếu quá hạn thanh toán, booking chuyển sang `PAYMENT_EXPIRED` và slot được giải phóng.
- Payment callback phải xử lý idempotent.

### 2.5 Quy tắc priority

Thứ tự ưu tiên mặc định:

```text
Lecturer / Staff > Student > External User
```

Priority chỉ ảnh hưởng:

- Số ngày được đặt trước.
- Hạn mức đặt sân.
- Thứ tự trong waitlist.
- Một số khung giờ ưu tiên nếu cấu hình.

Priority **không được cướp slot** đã được hold hoặc confirmed.

Ví dụ:

```text
External User đã giữ slot hợp lệ và đang PENDING_PAYMENT.
Lecturer vào sau cùng khung giờ.
=> Lecturer không được cướp slot.
=> Lecturer bị reject hoặc vào waitlist.
```

### 2.6 Quy tắc chống double booking

Cần chống overlap ở cả service layer và DB layer.

Overlap condition:

```text
new_start < existing_end
AND
new_end > existing_start
```

Active booking statuses chiếm slot:

```text
PENDING_PAYMENT
PAYMENT_PROCESSING
CONFIRMED
IN_USE
```

Khuyến nghị dùng PostgreSQL exclusion constraint với `tstzrange` để chống overlap ở tầng DB.

### 2.7 Quy tắc check-in

User **không tự check-in**.

Chỉ Field Manager hoặc Admin được:

- Xác nhận người đặt đã đến.
- Cập nhật booking sang `IN_USE`.
- Ghi `checkin_time`.
- Ghi `checked_in_by_user_id`.
- Tạo `booking_status_histories`.

### 2.8 Quy tắc no-show / quá giờ check-in

- Nếu đến giờ sử dụng mà user chưa được manager check-in, hệ thống chờ trong `late_checkin_minutes`.
- Nếu quá thời gian chờ, hệ thống chuyển booking sang `CHECKIN_EXPIRED` hoặc `PENDING_NO_SHOW_CONFIRMATION` tùy schema đã chọn trong spec.
- Manager xác nhận no-show cuối cùng.
- No-show không hoàn tiền.
- No-show có thể cộng điểm vi phạm.
- Nếu user vượt ngưỡng vi phạm, hệ thống khóa quyền đặt sân trong số ngày cấu hình.

### 2.9 Quy tắc hủy và hoàn tiền

| Trường hợp | Hoàn tiền mặc định |
|---|---:|
| User hủy trước hạn | Có, theo cấu hình |
| User hủy sát giờ | Không hoặc không cho hủy |
| Quá giờ check-in | Không |
| No-show | Không |
| Manager/Admin hủy do sân lỗi/bảo trì | Có, mặc định 100% |
| Hệ thống lỗi khiến sân không sử dụng được | Có, mặc định 100% |

### 2.10 RBAC đã chốt

Dùng mô hình:

```text
users
roles
user_roles
```

Không dùng enum `role` trực tiếp trong bảng `users` làm source of truth.

Role cơ bản:

```text
USER
FIELD_MANAGER
ADMIN
```

### 2.11 Naming convention DB đã chốt

Dùng snake_case plural table names:

```text
users
roles
user_roles
priority_groups
court_types
courts
operating_hours
pricing_rules
booking_orders
booking_items
payments
refunds
booking_order_status_histories
booking_item_status_histories
court_status_histories
violations
notifications
waitlist_entries
system_settings
audit_logs
```

---

## 3. Agent workflow nên áp dụng

Khi dùng coding agent hoặc team member làm một module, quy trình nên là:

```text
DEFINE -> PLAN -> BUILD -> VERIFY -> REVIEW -> SHIP
```

### 3.1 DEFINE

- Đọc `agent-spec.md` / `final-agent-spec.md`.
- Xác định module đang làm.
- Xác định bảng DB, API, service, UI liên quan.
- Xác định dependency.

### 3.2 PLAN

- Chia task nhỏ.
- Cập nhật checklist task sang trạng thái `[~]`.
- Xác định file cần tạo/sửa.
- Xác định test cần viết.

### 3.3 BUILD

- Implement theo module nhỏ.
- Không đổi nghiệp vụ đã chốt nếu không cập nhật spec.
- Đồng bộ DB schema, API contract và frontend type.

### 3.4 VERIFY

- Chạy lint.
- Chạy typecheck.
- Chạy unit test.
- Chạy integration test nếu có.
- Test manual flow chính.

### 3.5 REVIEW

- Kiểm tra lại checklist.
- Kiểm tra naming convention.
- Kiểm tra RBAC.
- Kiểm tra validation và error handling.

### 3.6 SHIP

- Cập nhật checklist `[x]`.
- Ghi chú phần còn thiếu hoặc tech debt.
- Push code kèm migration/test liên quan.

---

## 4. Agent skills nên dùng cho dự án

Khi repo/workspace có skill tương ứng, ưu tiên dùng các nhóm skill sau:

| Nhóm skill | Dùng khi nào |
|---|---|
| `spec-driven-development` | Trước khi code module mới, đảm bảo không lệch spec |
| `planning-and-task-breakdown` | Khi chia module lớn thành task nhỏ |
| `api-and-interface-design` | Khi thiết kế hoặc sửa API contract |
| `postgres-patterns` | Khi làm schema, index, constraint, migration |
| `prisma-orm-patterns` | Khi viết Prisma model/query/transaction |
| `backend-service-architecture` | Khi tổ chức controller/service/repository |
| `frontend-ui-engineering` | Khi xây UI React, layout, component |
| `test-driven-development` | Khi viết test cho nghiệp vụ rủi ro cao |
| `security-and-hardening` | Khi làm auth, RBAC, payment callback |
| `code-review-and-quality` | Trước khi merge module |
| `documentation-and-adrs` | Khi cần ghi lại quyết định kỹ thuật |

---

## 5. Kiến trúc project đề xuất

```text
project-root/
  backend/
    src/
      app.ts
      server.ts
      config/
      middlewares/
      modules/
      jobs/
      utils/
      tests/
    prisma/
      schema.prisma
      migrations/
      seed.ts
    package.json

  frontend/
    src/
      main.tsx
      App.tsx
      routes/
      api/
      pages/
      components/
      stores/
      hooks/
      utils/
      types/
    package.json

  docs/
    agent-spec.md
    PROJECT-CHECKLIST.md
    api-contract.md
    database-notes.md
    adr/
```

---

## 6. Backend modules checklist

### 6.1 Backend foundation

Mục tiêu: tạo nền Express + TypeScript chuẩn để các module khác phát triển.

Checklist:

- [x] Khởi tạo backend project Node.js + TypeScript.
- [x] Cấu hình Express app.
- [x] Cấu hình environment variables.
- [x] Cấu hình Prisma client.
- [x] Cấu hình global error handler.
- [x] Cấu hình request validation middleware.
- [x] Cấu hình auth middleware placeholder.
- [x] Cấu hình RBAC middleware placeholder.
- [x] Cấu hình logger.
- [x] Cấu hình CORS.
- [x] Cấu hình health check endpoint `GET /health`.
- [x] Thêm lint/typecheck/test script.

Acceptance criteria:

- [x] Backend start được local.
- [x] `GET /health` trả về OK.
- [x] `npm run typecheck` pass.
- [x] `npm run lint` pass.

---

### 6.2 Database & Prisma schema

Mục tiêu: tạo schema DB đúng spec, đúng naming convention, đủ FK.

Checklist:

- [x] Tạo `schema.prisma`.
- [x] Tạo model `User` map bảng `users`.
- [x] Tạo model `Role` map bảng `roles`.
- [x] Tạo model `UserRole` map bảng `user_roles`.
- [x] Tạo model `PriorityGroup` map bảng `priority_groups`.
- [x] Tạo model `CourtType` map bảng `court_types`.
- [x] Tạo model `Court` map bảng `courts`.
- [x] Tạo model `OperatingHour` map bảng `operating_hours`.
- [x] Tạo model `PricingRule` map bảng `pricing_rules`.
- [x] Tạo model `BookingRule` map bảng `booking_rules`.
- [x] Tạo model `PriorityPolicy` map bảng `priority_policies`.
- [x] Tạo model `BookingOrder` map bảng `booking_orders`.
- [x] Tạo model `BookingItem` map bảng `booking_items`.
- [x] Tạo model `Payment` map bảng `payments`.
- [x] Tạo model `Refund` map bảng `refunds`.
- [x] Tạo model `BookingOrderStatusHistory` map bảng `booking_order_status_histories`.
- [x] Tạo model `BookingItemStatusHistory` map bảng `booking_item_status_histories`.
- [x] Tạo model `CourtStatusHistory` map bảng `court_status_histories`.
- [x] Tạo model `Violation` map bảng `violations`.
- [x] Tạo model `Notification` map bảng `notifications`.
- [x] Tạo model `WaitlistEntry` map bảng `waitlist_entries`.
- [x] Tạo model `SystemSetting` map bảng `system_settings`.
- [x] Tạo model `AuditLog` map bảng `audit_logs`.
- [x] Đồng bộ enum booking/payment/refund/court/account status.
- [x] Thêm index cho các query quan trọng.
- [x] Thêm migration SQL chống overlap booking bằng PostgreSQL exclusion constraint.
- [x] Viết seed data vận hành: users/roles/priority, courts, rules, bookings/items, payments, refunds, waitlist, notifications, violations, histories, audit logs.

Acceptance criteria:

- [x] `prisma migrate dev` chạy thành công.
- [x] `prisma generate` chạy thành công.
- [x] Seed tạo được dữ liệu mẫu.
- [x] FK đúng và không còn model mâu thuẫn với spec.
- [x] DB constraint chặn overlap booking active đã có trong migration SQL.

---

### 6.3 Auth module

Mục tiêu: đăng ký, đăng nhập, token, current user.

Checklist:

- [x] API `POST /api/auth/register`.
- [x] API `POST /api/auth/login`.
- [x] API `POST /api/auth/logout`.
- [x] API `GET /api/auth/me`.
- [x] Hash password bằng bcrypt/argon2.
- [x] Validate email/phone/password.
- [x] Gán priority group khi register.
- [x] Gán role mặc định `USER`.
- [x] Sinh access token.
- [x] Middleware authenticate request.
- [x] Test register duplicate email.
- [x] Test login sai mật khẩu.
- [x] Test account locked/disabled.

Acceptance criteria:

- [!] User đăng ký API đã implement, chưa manual verify với DB local.
- [!] User login API đã implement, chưa manual verify với DB local.
- [x] Token dùng được cho protected route.
- [!] Role mặc định được tạo trong `user_roles` trong code transaction, chưa manual verify với DB local.

---

### 6.4 RBAC & Users module

Mục tiêu: phân quyền theo `roles` + `user_roles`.

Checklist:

- [x] Middleware `requireRole(['ADMIN'])`.
- [x] Middleware `requireRole(['FIELD_MANAGER', 'ADMIN'])`.
- [x] API admin list users.
- [x] API admin update user profile.
- [x] API admin assign role.
- [x] API admin remove role.
- [x] API admin lock/unlock account.
- [x] API admin restrict/unrestrict booking permission.
- [x] API admin update priority group.
- [x] Ghi audit log khi admin thay đổi role/account status.
- [x] Test user thường không truy cập được admin API.
- [x] Test manager truy cập được manager API nhưng không truy cập được admin-only API.

Acceptance criteria:

- [x] RBAC hoạt động đúng.
- [x] Mỗi user có thể có nhiều role.
- [x] Thay đổi nhạy cảm đều có audit log.

---

### 6.5 Courts & Court Types module

Mục tiêu: quản lý sân và loại sân.

Checklist:

- [x] API public/auth `GET /api/court-types`.
- [x] API public/auth `GET /api/courts`.
- [x] API `GET /api/courts/:id`.
- [x] API admin create court type.
- [x] API admin update court type.
- [x] API admin disable court type.
- [x] API admin create court.
- [x] API admin update court.
- [x] API admin retire court.
- [x] API manager/admin update court status.
- [x] Ghi `court_status_histories` khi đổi trạng thái sân.
- [x] Search/filter theo tên, loại sân, vị trí, trạng thái.
- [x] Test không cho xóa cứng sân đã có booking.

Acceptance criteria:

- [x] User xem được danh sách sân.
- [x] Admin quản lý được sân/loại sân.
- [x] Manager cập nhật được tình trạng sân.
- [x] Lịch sử trạng thái sân được ghi lại.

---

### 6.6 Operating Hours & Pricing module

Mục tiêu: cấu hình giờ hoạt động và giá sân.

Checklist:

- [x] API admin CRUD operating hours.
- [x] API admin CRUD pricing rules.
- [x] Validate `open_time < close_time`.
- [x] Validate `slot_duration_minutes > 0`.
- [x] Validate pricing amount >= 0.
- [x] Hỗ trợ giá theo court.
- [x] Hỗ trợ giá theo khung giờ.
- [x] Hỗ trợ giá theo priority group nếu cần.
- [!] Cảnh báo nếu đổi operating hours ảnh hưởng booking đã có: hoãn đến module booking/availability vì hiện chưa có booking flow.

Acceptance criteria:

- [x] Admin cấu hình được giờ hoạt động.
- [x] Admin cấu hình được bảng giá.
- [x] Availability service dùng đúng operating hours/pricing rules.

---

### 6.7 Booking Rules & Priority Policies module

Mục tiêu: cấu hình nghiệp vụ động, không hard-code.

Checklist:

- [x] API admin get/update booking rules.
- [x] API admin get/update priority groups/policies.
- [x] Cấu hình `max_bookings_per_day`.
- [x] Cấu hình `max_duration_minutes`.
- [x] Cấu hình `hold_minutes`.
- [x] Cấu hình `cancel_before_hours`.
- [x] Cấu hình `late_checkin_minutes`.
- [x] Cấu hình `violation_threshold`.
- [x] Cấu hình `booking_ban_days`.
- [x] Cấu hình `advance_booking_days` theo priority group.
- [x] Cấu hình thứ tự ưu tiên.
- [x] Ghi audit log khi admin đổi config.

Acceptance criteria:

- [x] Nghiệp vụ đọc config từ DB.
- [x] Không hard-code số ngày đặt trước, hold time, cancel window, no-show time.

---

### 6.8 Availability module

Mục tiêu: trả về lịch trống, slot đã đặt, slot đang giữ, giá và policy.

Checklist:

- [x] API `GET /api/courts/:id/availability?date=YYYY-MM-DD`.
- [x] Lấy operating hours theo sân và thứ trong tuần.
- [x] Sinh slot theo `slot_duration_minutes`.
- [x] Lấy active booking items trong ngày.
- [x] Đánh dấu slot unavailable nếu overlap.
- [x] Đánh dấu slot đang hold nếu `PENDING_PAYMENT` còn hạn.
- [x] Tính giá slot theo pricing rules.
- [x] Trả về policy áp dụng: cancel window, hold time, late check-in, refund.
- [x] Validate advance booking theo priority group user.

Acceptance criteria:

- [x] User xem được slot trống/chưa trống.
- [x] Slot active booking không hiện là available.
- [x] Giá trả về đúng rule.

---

### 6.9 Booking module

Mục tiêu: tạo booking hold, validate nghiệp vụ, chống overlap.

Checklist:

- [x] API `POST /api/bookings`.
- [x] API `GET /api/bookings/my`.
- [x] API `GET /api/bookings/:id`.
- [x] Validate user account active.
- [x] Validate booking permission not restricted.
- [x] Validate court active.
- [x] Validate operating hours.
- [x] Validate advance booking window.
- [x] Validate max duration.
- [x] Validate max bookings per day.
- [x] Không dùng participant count/court capacity theo schema mới.
- [x] Validate overlap trong service layer.
- [x] Tạo booking trong transaction.
- [x] Ghi `booking_order_status_histories` và `booking_item_status_histories` khi tạo booking.
- [x] Bắt lỗi DB overlap constraint và trả message thân thiện.
- [x] API cancel by user.
- [x] Tạo refund nếu user cancel hợp lệ.

Acceptance criteria:

- [x] User tạo được booking `PENDING_PAYMENT`.
- [x] Slot được hold đến `hold_expires_at`.
- [x] Không thể tạo 2 booking active overlap cùng sân.
- [x] User chỉ xem/sửa booking của chính mình trừ manager/admin.

---

### 6.10 Payment module

Mục tiêu: thanh toán toàn bộ chi phí và confirm booking.

Checklist:

- [x] API `POST /api/bookings/:id/payments`.
- [x] API `POST /api/payments/callback/mock`.
- [x] API `GET /api/payments/:id`.
- [x] API `GET /api/admin/payments`.
- [x] Tạo payment record `PROCESSING`.
- [x] Hỗ trợ payment sandbox/fake provider cho MVP.
- [x] Callback verify signature bằng `MOCK_PAYMENT_SECRET`.
- [x] Callback idempotent.
- [x] Payment success cập nhật booking `CONFIRMED` trong transaction.
- [x] Payment failed cập nhật payment `FAILED`.
- [x] Xử lý callback đến sau khi booking expired.
- [x] Ghi booking status history.
- [x] Gửi notification payment success/fail qua module 6.16 Notifications.

Acceptance criteria:

- [x] Thanh toán thành công thì booking thành `CONFIRMED`.
- [x] Callback gọi lại nhiều lần không làm sai dữ liệu.
- [x] Không confirm booking nếu hold đã hết hạn và không có logic đối soát hợp lệ.

---

### 6.11 Refund module

Mục tiêu: tạo và xử lý hoàn tiền.

Checklist:

- [x] Tạo refund khi user hủy đúng hạn.
- [x] Tạo refund khi manager/admin hủy do sân lỗi.
- [x] Không tạo refund cho no-show/check-in expired.
- [x] API admin list refunds.
- [x] API admin retry refund.
- [x] Refund phải liên kết `payment_id` bắt buộc.
- [x] Refund phải liên kết `booking_id`.
- [x] Ghi trạng thái refund.
- [x] Ghi audit log khi admin xử lý refund thủ công.

Acceptance criteria:

- [x] Refund chỉ phát sinh từ payment thành công.
- [x] Refund policy đúng theo nguyên nhân hủy.
- [x] Có trạng thái để đối soát: `REQUESTED`, `PROCESSING`, `SUCCESS`, `FAILED`, `MANUAL_REVIEW`.

---

### 6.12 Manager operations module

Mục tiêu: vận hành sân hằng ngày.

Checklist:

- [x] API `GET /api/manager/bookings/today`.
- [x] API `POST /api/manager/booking-items/:id/check-in`.
- [x] API `POST /api/manager/booking-items/:id/override-checkin`.
- [x] API `POST /api/manager/booking-items/:id/override-complete`.
- [x] API `POST /api/manager/booking-items/:id/no-show`.
- [x] API `POST /api/manager/bookings/:id/cancel`.
- [x] Check-in chỉ cho booking item `CONFIRMED` và order đã thanh toán `SUCCESS`.
- [x] Check-in ghi `checked_in_by_user_id`.
- [x] Complete exception chỉ cho booking item `IN_USE`.
- [x] Complete ghi `completed_by_user_id`.
- [x] No-show không tạo refund.
- [x] No-show tạo violation nếu policy yêu cầu.
- [x] Manager cancel tạo refund 100% mặc định.
- [x] Mọi chuyển trạng thái ghi order/item status histories tương ứng.

Acceptance criteria:

- [x] Manager check-in được user tại sân.
- [x] User không tự check-in được.
- [x] Manager xử lý hoàn thành ngoại lệ khi item đang `IN_USE`.
- [x] Manager xác nhận no-show và tạo violation đúng.

---

### 6.13 Jobs module

Mục tiêu: xử lý tự động các nghiệp vụ theo thời gian.

Checklist:

- [x] Job expire pending payment bookings chạy qua runner nội bộ.
- [x] Job chuyển booking item quá giờ check-in.
- [x] Job tự hoàn thành booking item khi hết giờ sử dụng.
- [x] Job expire waitlist notified entries quá `expires_at`.
- [!] Job gửi reminder trước giờ sử dụng nếu cần: hoãn đến module reminder/scheduler sau.
- [x] Job notify waitlist khi slot được giải phóng bởi payment hold expiry / waitlist response expiry.
- [x] Job phải idempotent.
- [x] Job ghi status history/audit log khi cập nhật trạng thái.
- [x] Có runner `jobs:run-once` để scheduler gọi.

Acceptance criteria:

- [x] Booking quá hạn thanh toán tự chuyển `PAYMENT_EXPIRED`.
- [x] Booking item quá giờ check-in tự chuyển `CHECKIN_EXPIRED`.
- [x] Booking item `IN_USE` hết giờ tự chuyển `COMPLETED`.
- [x] Không job nào update trùng gây sai dữ liệu.

---

### 6.14 Waitlist module

Mục tiêu: cho phép user vào danh sách chờ khi slot đã kín.

Checklist:

- [x] API join waitlist.
- [x] API leave waitlist.
- [x] API list my waitlist entries.
- [x] Không cho join trùng cùng court/time.
- [x] Sắp xếp theo priority group.
- [x] Sắp xếp theo registered_at.
- [!] Có thể tính điểm uy tín nếu áp dụng: chưa áp dụng reputation scoring trong policy hiện tại.
- [x] Notify user ưu tiên cao nhất khi slot available.

Acceptance criteria:

- [x] User vào waitlist được.
- [x] Slot giải phóng thì user phù hợp được thông báo.
- [x] Priority chỉ ảnh hưởng thứ tự waitlist, không cướp slot active.

---

### 6.15 Violations module

Mục tiêu: ghi nhận và xử lý điểm vi phạm.

Checklist:

- [x] Tạo violation khi no-show.
- [x] Tạo violation khi late cancellation nếu policy yêu cầu.
- [x] API admin/manager list violations.
- [x] API admin waive violation.
- [x] API admin adjust violation points.
- [x] Cộng điểm vào user.
- [x] Kiểm tra threshold để khóa quyền đặt sân.
- [x] Ghi audit log khi admin can thiệp.

Acceptance criteria:

- [x] No-show tạo violation đúng.
- [x] Vượt ngưỡng thì user bị restrict booking permission.
- [x] Admin có thể miễn/điều chỉnh vi phạm có lý do.

---

### 6.16 Notifications module

Mục tiêu: thông báo sự kiện quan trọng.

Checklist:

- [x] API list my notifications.
- [x] API mark notification as read.
- [x] Tạo notification khi booking pending payment.
- [x] Tạo notification khi payment success/fail.
- [x] Tạo notification khi booking expired.
- [x] Tạo notification khi manager cancel.
- [x] Tạo notification khi refund status changed.
- [x] Tạo notification khi no-show/check-in expired.
- [x] Tạo notification khi booking permission restricted.

Acceptance criteria:

- [x] User nhận được notification trong app.
- [x] Notification liên kết booking nếu có.

---

### 6.17 Reports module

Mục tiêu: báo cáo thống kê cho admin.

Checklist:

- [x] API overview dashboard.
- [x] Báo cáo số lượt đặt theo ngày/tháng.
- [x] Báo cáo doanh thu từ payment success.
- [x] Báo cáo sân được sử dụng nhiều nhất.
- [x] Báo cáo tỷ lệ hủy.
- [x] Báo cáo tỷ lệ hoàn tiền.
- [x] Báo cáo tỷ lệ no-show.
- [x] Báo cáo user vi phạm nhiều.
- [x] Filter theo date range.
- [x] Added idempotent report demo seed script `backend/prisma/seed-reports-demo.ts` and `npm run seed:reports`.

Acceptance criteria:

- [x] Admin xem được số liệu cơ bản.
- [x] Query không quá chậm với dataset mẫu.

---

### 6.18 Database refactor sync: BookingOrder/BookingItem

Mục tiêu: đồng bộ backend theo thiết kế DB mới `booking_orders` + `booking_items`.

Checklist:

- [x] Thay Prisma model `Booking` bằng `BookingOrder` và `BookingItem`.
- [x] Bỏ `location` và `capacity` khỏi `courts`.
- [x] Bỏ `participantCount`, `usagePurpose`, `checkoutTime`, `noRefundReason` khỏi booking flow.
- [x] Thêm `booking_order_status_histories` và `booking_item_status_histories`.
- [x] Chuyển overlap/availability sang `booking_items`.
- [x] Chuyển payment sang `booking_orders`.
- [x] Chuyển refund sang `booking_orders` và optional `booking_items`.
- [x] Chuyển violations sang optional `booking_item_id`.
- [x] Chuyển notifications sang optional `booking_order_id` và `booking_item_id`.
- [x] Giữ `waitlist_entries.expires_at`.
- [x] Thêm migration SQL `no_overlapping_active_booking_items`.
- [x] Cập nhật seed data tương thích schema mới và đủ dữ liệu vận hành cho frontend real API.
- [x] Cập nhật API contract.
- [x] Re-verify auth/RBAC/courts/rules/availability/bookings/payments/refunds tests.

Acceptance criteria:

- [x] Single booking order với 1 item tạo được.
- [x] Combo booking order nhiều item tạo được.
- [x] Combo all-or-nothing khi 1 item conflict.
- [x] Availability block slot theo `booking_items`.
- [x] Payment success confirm order và items.
- [x] Payment callback idempotent không tạo duplicate history.
- [x] Refund gắn order và hỗ trợ optional item.

---

## 7. Frontend modules checklist

### 7.1 Frontend foundation

Mục tiêu: tạo nền React + TypeScript ổn định.

Checklist:

- [x] Khởi tạo React + TypeScript.
- [x] Cấu hình router.
- [x] Cấu hình API client.
- [x] Cấu hình auth store.
- [x] Cấu hình protected routes.
- [x] Cấu hình role-based routes.
- [x] Cấu hình global layout.
- [x] Cấu hình toast/error handling.
- [x] Cấu hình form validation.
- [x] Cấu hình theme xanh nước biển.

Acceptance criteria:

- [x] Frontend chạy được local.
- [x] Có layout cơ bản.
- [x] Có route auth/user/manager/admin.

---

### 7.2 UI theme & design system

Mục tiêu: giao diện tham khảo style marketplace đặt sân, dùng màu chủ đạo xanh nước biển.

Theme gợi ý:

```ts
const theme = {
  colors: {
    primary: '#0EA5E9',
    primaryDark: '#0369A1',
    primaryLight: '#E0F2FE',
    accent: '#FACC15',
    success: '#22C55E',
    danger: '#EF4444',
    background: '#F8FAFC',
    card: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    border: '#E2E8F0'
  },
  radius: {
    card: '16px',
    button: '10px',
    pill: '999px'
  },
  shadow: {
    card: '0 4px 12px rgba(15, 23, 42, 0.08)',
    floating: '0 8px 24px rgba(15, 23, 42, 0.12)'
  }
};
```

Checklist:

- [x] Tạo `AppHeader`.
- [x] Tạo `SearchFilterBar`.
- [x] Tạo `BottomNavigation`.
- [x] Tạo `CourtCard`.
- [x] Tạo `CourtGrid`.
- [x] Tạo `CourtStatusBadge`.
- [x] Tạo `CourtTagBadge`.
- [x] Tạo `FavoriteButton`.
- [x] Tạo `ShareButton`.
- [x] Tạo `FilterDrawer`.
- [x] Tạo `LoadingState`.
- [x] Tạo `EmptyState`.
- [x] Tạo `ErrorState`.

Acceptance criteria:

- [x] UI mobile-first.
- [x] Desktop hiển thị grid 3 cột.
- [x] Tablet hiển thị grid 2 cột.
- [x] Mobile hiển thị 1 cột.
- [x] Bottom navigation fixed trên mobile.
- [x] Không copy logo/hình ảnh/thương hiệu của website tham khảo.

---

### 7.3 Auth pages

Checklist:

- [x] Register page.
- [x] Login page.
- [x] Logout action.
- [x] Current user display.
- [x] Validate form register/login.
- [x] Redirect theo role sau login.

Acceptance criteria:

- [x] User đăng ký/login/logout được.
- [x] Sai thông tin hiển thị lỗi rõ ràng.
- [x] Role redirect đúng.

Verification notes:

- [x] `npm run typecheck` pass.
- [x] `npm run lint` pass.
- [x] `npm test` pass.
- [x] `npm run build` pass.
- [x] Manual route `/login`, `/register`, `/user`, `/manager`, `/admin` trả 200 từ dev server.
- [x] Backend auth API verify: register USER, `/me`, logout, login, duplicate email `409`, wrong password `401`.
- [ ] Manual E2E login bằng tài khoản ADMIN/FIELD_MANAGER cần credential seed hợp lệ.

---

### 7.4 User court browsing pages

Checklist:

- [x] Home page với court cards.
- [x] Court list page.
- [x] Search by name.
- [x] Filter by court type.
- [x] Filter by location.
- [x] Filter by status.
- [x] Filter by price/time nếu backend hỗ trợ.
- [x] Court detail page.
- [x] Hiển thị ảnh, tên, địa chỉ, giờ mở cửa, trạng thái.
- [x] Hiển thị availability slots.
- [x] Hiển thị pricing.
- [x] Hiển thị rules: cancel/check-in/refund.

Acceptance criteria:

- [x] User tìm sân được.
- [x] User xem chi tiết và lịch trống được.
- [x] Court không khả dụng thì disable nút đặt lịch.

#### 7.4.1 Court Listing & Court Detail Pages

Checklist:

- [x] Route `/courts` hoạt động với dữ liệu thật từ API/DB seed.
- [x] Route `/courts/:courtId` hoạt động với dữ liệu thật từ API/DB seed.
- [x] Mock court data và fallback dev preview đã được gỡ khỏi page/service.
- [x] Service list/detail dùng API thật, không fallback mock.
- [x] Có search/filter/sort cơ bản.
- [x] Detail id không tồn tại hiển thị state hợp lý.
- [x] Header/bottom navigation trỏ đúng route court browsing.

Acceptance criteria:

- [x] `npm run typecheck` pass.
- [x] `npm run lint` pass.
- [x] `npm test` pass.
- [x] `npm run build` pass.
- [x] Manual route `/courts` trả 200.
- [x] Manual route `/courts/<uuid-seed-court-id>` trả 200.
- [x] Manual route `/courts/not-found-id` trả 200 và xử lý not found trong UI.

#### 7.4.2 Court Availability & Policy Integration

Checklist:

- [x] Court detail có date picker chọn ngày xem lịch trống.
- [x] Tạo availability service dùng API thật, không fallback mock.
- [x] Tạo availability slot picker/card.
- [x] Slot available/hold/booked/unavailable hiển thị rõ và disabled đúng.
- [x] Court không `ACTIVE` không cho đặt lịch.
- [x] Hiển thị giá theo slot nếu có dữ liệu.
- [x] Hiển thị policy giữ chỗ, hủy, check-in, hoàn tiền.
- [x] Có loading/error/empty state cho availability.
- [x] Không tạo booking hold trong module này.
- [x] Không có nút user tự check-in.

Verification notes:

- [x] `npm run typecheck` pass.
- [x] `npm run lint` pass.
- [x] `npm test` pass.
- [x] `npm run build` pass.
- [x] Programmatic Vite route check `/courts`, `/courts/<uuid-seed-court-id>`, `/courts/not-found-id` trả 200.
- [x] Backend `localhost:3000` reachable; register USER và `GET /api/courts` trả seed courts.
- [x] Real availability success: seed court ids changed to validator-safe UUIDs; `GET /api/courts/00000000-0000-4000-8000-000000000101/availability?date=2026-05-29&includePricing=true` returns real slots.

---

### 7.5 Booking pages

Checklist:

- [x] Booking create page.
- [x] Date picker.
- [x] Slot picker.
- [x] Participant count input: Khong trien khai theo API contract moi vi `POST /api/bookings` khong nhan field nay.
- [x] Usage purpose input: map vào `note` theo API contract.
- [x] Booking summary card.
- [x] Submit create booking hold.
- [x] Payment page hoặc fake payment UI.
- [x] My bookings page.
- [x] Booking detail page.
- [x] Cancel booking action.
- [x] Booking history timeline.

Acceptance criteria:

- [x] User tạo booking hold được qua frontend flow gọi API thật.
- [x] User thanh toán qua payment sandbox backend.
- [x] User xem trạng thái booking/payment/refund được.
- [x] User hủy booking hợp lệ được qua frontend flow gọi API thật.

Verification notes:

- [x] `npm run typecheck` pass.
- [x] `npm run lint` pass.
- [x] `npm test` pass.
- [x] `npm run build` pass.
- [x] Dev route check `/bookings/create`, `/bookings/my`, `/courts/<uuid-seed-court-id>` trả 200.
- [x] Real booking API/frontend E2E pass: browser flow creates real hold, mock payment callback confirms `CONFIRMED/SUCCESS`, `/bookings/my` and detail render backend data.

---

### 7.6 Manager pages

Checklist:

- [x] Manager today schedule page.
- [x] Search booking by code/user/court/time.
- [x] Check-in action.
- [x] Complete booking action / override complete.
- [x] No-show management page.
- [x] Manager cancel booking page/action.
- [x] Court status management page.
- [x] Usage history page: UI dùng dữ liệu `GET /api/manager/bookings/today` vì chưa có endpoint history riêng.

Acceptance criteria:

- [x] Manager check-in được booking qua frontend action/service gọi API thật.
- [x] Manager complete được booking qua override-complete action/service.
- [x] Manager xác nhận no-show được qua frontend action/service.
- [x] Manager cập nhật tình trạng sân được qua route backend hiện có `PATCH /api/admin/courts/:id/status`.

Verification notes:

- [x] `npm run typecheck` pass.
- [x] `npm run lint` pass.
- [x] `npm test` pass.
- [x] `npm run build` pass.
- [x] Dev route check `/manager`, `/manager/today`, `/manager/check-in`, `/manager/in-use`, `/manager/no-show`, `/manager/courts`, `/manager/history` trả 200.
- [x] Backend RBAC verify: USER thường gọi `GET /api/manager/bookings/today` trả `403 FORBIDDEN`.
- [x] Manual manager E2E pass with `FIELD_MANAGER`: seed credential login, today schedule, check-in `CONFIRMED -> IN_USE`, override complete `IN_USE -> COMPLETED`, and safe no-show test verified.

---

### 7.7 Admin pages

Checklist:

- [x] Admin dashboard.
- [x] User management page.
- [x] Role assignment UI.
- [x] Priority group management UI.
- [x] Court type management UI.
- [x] Court management UI.
- [x] Operating hours UI.
- [x] Pricing rules UI.
- [x] Booking rules UI.
- [x] Priority policies UI.
- [x] Payment management UI.
- [x] Refund management UI.
- [x] Violation management UI.
- [x] Reports page.

Acceptance criteria:

- [x] Admin quan tri duoc du lieu cot loi: ADMIN credential verified; users/courts/payments/refunds/violations load real data.
- [x] Admin cau hinh duoc nghiep vu dong: booking rules get/update verified.
- [x] Admin xem duoc bao cao co ban: overview and reports pages/API load real data.
- [x] Admin reports page renders KPI cards, revenue trend, booking trend, court usage ranking, rates summary, and violating users table.

Verification notes:

- [x] `npm run typecheck` pass.
- [x] `npm run lint` pass.
- [x] `npm test` pass.
- [x] `npm run build` pass.
- [x] Dev route check `/admin`, `/admin/dashboard`, `/admin/users`, `/admin/roles`, `/admin/priority-groups`, `/admin/court-types`, `/admin/courts`, `/admin/operating-hours`, `/admin/pricing-rules`, `/admin/booking-rules`, `/admin/priority-policies`, `/admin/payments`, `/admin/refunds`, `/admin/violations`, `/admin/reports` trả 200.
- [x] Backend RBAC verify: tài khoản `FIELD_MANAGER` gọi `GET /api/admin/users` trả `403 FORBIDDEN`.
- [x] Manual admin E2E pass with real `ADMIN` credential: dashboard, users, courts, booking rules, payments, refunds, violations, reports, lock/unlock and restrict/unrestrict test user verified.

---

## 8. API contract checklist

### 8.1 Auth APIs

- [x] `POST /api/auth/register`
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/me`

### 8.2 Admin User & RBAC APIs

- [x] `GET /api/admin/users`
- [x] `PUT /api/admin/users/:id`
- [x] `POST /api/admin/users/:id/roles`
- [x] `DELETE /api/admin/users/:id/roles/:roleName`
- [x] `PATCH /api/admin/users/:id/account-status`
- [x] `PATCH /api/admin/users/:id/booking-permission`
- [x] `PATCH /api/admin/users/:id/priority-group`

### 8.3 Court APIs

- [x] `GET /api/court-types`
- [x] `GET /api/courts`
- [x] `GET /api/courts/:id`
- [x] `GET /api/courts/:id/availability`
- [x] `POST /api/admin/court-types`
- [x] `PUT /api/admin/court-types/:id`
- [x] `PATCH /api/admin/court-types/:id/status`
- [x] `POST /api/admin/courts`
- [x] `PUT /api/admin/courts/:id`
- [x] `PATCH /api/admin/courts/:id/status`

### 8.4 Booking APIs

- [x] `POST /api/bookings`
- [x] `GET /api/bookings/my`
- [x] `GET /api/bookings/:id`
- [x] `POST /api/bookings/:id/cancel`
- [x] `GET /api/manager/bookings/today`
- [x] `POST /api/manager/booking-items/:id/check-in`
- [x] `POST /api/manager/booking-items/:id/override-checkin`
- [x] `POST /api/manager/booking-items/:id/override-complete`
- [x] `POST /api/manager/booking-items/:id/no-show`
- [x] `POST /api/manager/bookings/:id/cancel`

### 8.5 Payment & refund APIs

- [x] `POST /api/bookings/:id/payments`
- [x] `POST /api/payments/callback/mock`
- [x] `GET /api/payments/:id`
- [x] `GET /api/admin/payments`
- [x] `GET /api/admin/refunds`
- [x] `GET /api/admin/refunds/:id`
- [x] `POST /api/admin/refunds/:id/retry`

### 8.6 Admin config APIs

- [x] `GET /api/admin/booking-rules`
- [x] `PUT /api/admin/booking-rules`
- [x] `GET /api/admin/priority-groups`
- [x] `PUT /api/admin/priority-groups/:id`
- [x] `GET /api/admin/priority-policies`
- [x] `PUT /api/admin/priority-policies/:id`
- [x] CRUD `/api/admin/court-types`
- [x] CRUD `/api/admin/operating-hours`
- [x] CRUD `/api/admin/pricing-rules`

### 8.7 Notification APIs

- [x] `GET /api/notifications`
- [x] `GET /api/notifications/unread-count`
- [x] `PATCH /api/notifications/:id/read`
- [x] `PATCH /api/notifications/read-all`

### 8.8 Violation APIs

- [x] `GET /api/admin/violations`
- [x] `POST /api/admin/violations/:id/waive`
- [x] `POST /api/admin/violations/:id/adjust-points`

### 8.9 Reports APIs

- [x] `GET /api/admin/reports/overview`
- [x] `GET /api/admin/reports/bookings`
- [x] `GET /api/admin/reports/revenue`
- [x] `GET /api/admin/reports/courts/usage`
- [x] `GET /api/admin/reports/rates`
- [x] `GET /api/admin/reports/violations`

---

## 9. Test checklist

### 9.1 Unit tests

- [x] Overlap detection.
- [x] Booking duration validation.
- [x] Advance booking validation.
- [x] Cancel/refund eligibility.
- [ ] Priority sorting.
- [x] Violation point calculation.
- [x] Payment callback idempotency logic.

### 9.2 Integration tests

- [ ] Register/login flow.
- [x] Create booking hold.
- [x] Prevent double booking.
- [x] Payment success confirms booking.
- [x] Expire pending payment booking.
- [x] Manager check-in.
- [x] Manager override complete exception.
- [x] No-show creates violation.
- [x] User cancel creates refund when eligible.
- [x] Manager cancel creates refund.
- [x] RBAC denies wrong role.

### 9.3 E2E tests

- [x] User browses courts -> creates booking -> pays -> sees confirmed booking.
- [x] Manager checks in booking -> completes booking.
- [x] User does not arrive -> system expires check-in -> manager confirms no-show.
- [ ] Admin configures booking rule -> new rule affects booking validation.

---

## 10. Milestone roadmap

### Sprint 0 — Foundation

- [x] Backend foundation.
- [x] Frontend foundation.
- [x] Prisma schema baseline.
- [x] Seed data.
- [x] Auth basic.
- [x] RBAC basic.

### Sprint 1 — Courts & availability

- [x] Court types.
- [x] Courts.
- [x] Operating hours.
- [x] Pricing rules.
- [x] Availability API.
- [x] Court list UI.
- [x] Court detail UI.

### Sprint 2 — Booking & payment MVP

- [x] Booking hold.
- [x] Overlap prevention.
- [x] Payment sandbox.
- [x] Confirm booking after payment.
- [x] My bookings UI.
- [x] Booking detail UI.

### Sprint 3 — Manager operations

- [x] Today schedule.
- [x] Check-in.
- [x] Complete booking.
- [x] No-show.
- [x] Manager cancel.
- [x] Court status update.

### Sprint 4 — Refund, violation, jobs

- [x] User cancellation.
- [x] Refund module.
- [x] Expire payment job.
- [x] Check-in expiration job.
- [x] Violation module.
- [x] Notifications.

### Sprint 5 — Admin & reports

- [x] User management.
- [x] Role management.
- [x] Booking rules.
- [x] Priority groups.
- [x] Payment/refund management.
- [x] Reports dashboard.

### Sprint 6 — Polish & hardening

- [x] Full E2E flow.
- [ ] Error handling polish.
- [ ] Loading/empty states.
- [ ] Security review.
- [ ] Performance check.
- [ ] Documentation update.

---

## 11. Definition of Done

Một module được coi là hoàn thành khi:

- [ ] Code đã implement đúng spec.
- [ ] Có migration nếu thay đổi DB.
- [ ] Có API contract rõ ràng nếu là backend module.
- [ ] Có frontend UI nếu module yêu cầu giao diện.
- [ ] Có validation.
- [ ] Có error handling.
- [ ] Có RBAC nếu endpoint cần phân quyền.
- [ ] Có test tối thiểu cho nghiệp vụ quan trọng.
- [ ] Chạy lint/typecheck/test pass.
- [ ] Checklist được cập nhật.
- [ ] Không tạo mâu thuẫn với `agent-spec.md`.

---

## 12. Những điểm tuyệt đối tránh

- [ ] Không để user tự check-in.
- [ ] Không cho priority cướp slot đã hold/confirmed.
- [ ] Không confirm booking trước khi thanh toán thành công.
- [ ] Không hard-code booking rules.
- [ ] Không dùng enum role trong `users` làm source of truth nếu đã dùng `roles` + `user_roles`.
- [ ] Không bỏ qua DB-level overlap protection.
- [ ] Không tạo refund cho no-show/check-in expired.
- [ ] Không cập nhật booking order/item status mà không ghi history tương ứng.
- [ ] Không thay đổi schema mà quên migration.
- [ ] Không thay đổi API mà quên cập nhật frontend types.

---

## 13. Tracking nhanh theo module

| Module | Owner | Status | Notes |
|---|---|---|---|
| Backend foundation | Codex | DONE | Express + TypeScript foundation verified: build/typecheck/lint/test/health |
| Database & Prisma | Codex | DONE | Refactored to booking_orders/booking_items; booking_items overlap constraint verified in PostgreSQL |
| Auth | Codex | DONE | Auth APIs/JWT/password hashing verified; DB manual flow pending local PostgreSQL |
| RBAC & Users | Codex | DONE | Admin user/role APIs, RBAC tests, and audit logs implemented |
| Courts & Court Types | Codex | DONE | Court type/court APIs, filters, status updates, and status history implemented |
| Operating Hours & Pricing | Codex | DONE | Admin CRUD APIs implemented; booking-impact warnings deferred until booking/availability modules |
| Booking Rules & Priority | Codex | DONE | Admin config APIs, audit logs, and shared rules repository implemented |
| Availability | Codex | DONE | Hold-aware slot generation now reads booking_items, conflict detection, pricing, and policy response implemented |
| Booking | Codex | DONE | BookingOrder/BookingItem hold creation, combo all-or-nothing validation, user APIs, cancellation/refund request, and histories implemented |
| Payment | Codex | DONE | Mock payment tied to booking_orders, callback idempotency, status query, admin list, and order/item confirmation implemented |
| Refund | Codex | DONE | Sandbox refund processor tied to booking_orders with optional booking_items, admin APIs, retry audit logs, and manager/admin cancellation implemented |
| DB refactor sync | Codex | DONE | Backend synced to new booking_orders/booking_items database design and re-verified |
| Manager operations | Codex | DONE | Booking item schedule, manager/admin check-in, late override, no-show violation, and in-use exception close implemented |
| Jobs | Codex | DONE | Internal run-once jobs for payment hold expiry, check-in expiry, auto-complete, waitlist expiry, idempotent updates, and histories verified |
| Waitlist | Codex | DONE | Runtime waitlist APIs, active duplicate constraint, priority notification, book-from-waitlist flow, docs, and tests verified |
| Violations | Codex | DONE | Admin/manager violation APIs, waive/adjust audit, shared violation service, late cancellation handling, and verification completed |
| Notifications | Codex | DONE | In-app notification APIs/service, lifecycle integrations, enum migration, and tests verified |
| Reports | Codex | DONE | Admin reports APIs, aggregate service, contract, tests, frontend dashboard charts, and idempotent demo seed data verified |
| Frontend foundation | Codex | DONE | React + TypeScript/Vite foundation with router, API client, auth store, protected/role routes, layout, states, theme, and verification completed |
| UI design system | Codex | DONE | Theme tokens, header, search/filter bar, court cards/grid, badges, drawer, common states, and mobile bottom nav verified with API data |
| Court listing/detail | Codex | DONE | Real API `/courts` and `/courts/:courtId`, search/filter/sort, detail view, navigation links, and verification completed |
| Frontend auth pages | Codex | DONE | Login/register forms, Zod validation, auth service/store actions, logout, current user display, role redirect helper, and backend USER auth flow verified |
| User pages | Codex | DONE | Real court detail/availability and browser booking/payment/my-bookings/detail E2E verified against backend |
| Manager pages | Codex | DONE | Real FIELD_MANAGER login, today schedule, check-in, complete, no-show, court status pages and RBAC verified |
| Admin pages | Codex | DONE | Real ADMIN login, dashboard/users/courts/rules/payments/refunds/violations/reports and RBAC verified |
| Tests |  | TODO |  |
| Documentation |  | TODO |  |

---

## 14. Gợi ý phân công team

| Nhóm | Phụ trách |
|---|---|
| Backend 1 | Auth, RBAC, Users, Admin |
| Backend 2 | Courts, Availability, Booking, Payment |
| Backend 3 | Refund, Jobs, Violations, Reports |
| Frontend 1 | Foundation, user flow, court browsing, booking |
| Frontend 2 | Manager pages, admin pages, reports |
| QA/Reviewer | Test cases, E2E flow, checklist tracking |

---

## 15. Demo script MVP

Luồng demo tối thiểu:

1. Admin đăng nhập.
2. Admin tạo loại sân.
3. Admin tạo sân.
4. Admin cấu hình giờ hoạt động.
5. Admin cấu hình giá.
6. User đăng ký/login.
7. User xem danh sách sân.
8. User xem lịch trống.
9. User tạo booking hold.
10. User thanh toán sandbox.
11. Booking chuyển `CONFIRMED`.
12. Manager đăng nhập.
13. Manager check-in booking.
14. Booking chuyển `IN_USE`.
15. Manager complete booking.
16. Booking chuyển `COMPLETED`.
17. Admin xem báo cáo lượt đặt/doanh thu.
