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
bookings
payments
refunds
booking_status_histories
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
- [x] Tạo model `Booking` map bảng `bookings`.
- [x] Tạo model `Payment` map bảng `payments`.
- [x] Tạo model `Refund` map bảng `refunds`.
- [x] Tạo model `BookingStatusHistory` map bảng `booking_status_histories`.
- [x] Tạo model `CourtStatusHistory` map bảng `court_status_histories`.
- [x] Tạo model `Violation` map bảng `violations`.
- [x] Tạo model `Notification` map bảng `notifications`.
- [x] Tạo model `WaitlistEntry` map bảng `waitlist_entries`.
- [x] Tạo model `SystemSetting` map bảng `system_settings`.
- [x] Tạo model `AuditLog` map bảng `audit_logs`.
- [x] Đồng bộ enum booking/payment/refund/court/account status.
- [x] Thêm index cho các query quan trọng.
- [x] Thêm migration SQL chống overlap booking bằng PostgreSQL exclusion constraint.
- [x] Viết seed data: admin, manager, user, roles, priority groups, court types, courts, rules.

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
- [x] Lấy active bookings trong ngày.
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

- [ ] API `POST /api/bookings`.
- [ ] API `GET /api/bookings/my`.
- [ ] API `GET /api/bookings/:id`.
- [ ] Validate user account active.
- [ ] Validate booking permission not restricted.
- [ ] Validate court active.
- [ ] Validate operating hours.
- [ ] Validate advance booking window.
- [ ] Validate max duration.
- [ ] Validate max bookings per day.
- [ ] Validate participant count <= court capacity nếu áp dụng.
- [ ] Validate overlap trong service layer.
- [ ] Tạo booking trong transaction.
- [ ] Ghi `booking_status_histories` khi tạo booking.
- [ ] Bắt lỗi DB overlap constraint và trả message thân thiện.
- [ ] API cancel by user.
- [ ] Tạo refund nếu user cancel hợp lệ.

Acceptance criteria:

- [ ] User tạo được booking `PENDING_PAYMENT`.
- [ ] Slot được hold đến `hold_expires_at`.
- [ ] Không thể tạo 2 booking active overlap cùng sân.
- [ ] User chỉ xem/sửa booking của chính mình trừ manager/admin.

---

### 6.10 Payment module

Mục tiêu: thanh toán toàn bộ chi phí và confirm booking.

Checklist:

- [ ] API `POST /api/payments/create`.
- [ ] API `POST /api/payments/callback/:provider`.
- [ ] API `GET /api/payments/:id`.
- [ ] Tạo payment record `INITIATED`.
- [ ] Hỗ trợ payment sandbox/fake provider cho MVP.
- [ ] Callback verify signature nếu dùng gateway thật.
- [ ] Callback idempotent.
- [ ] Payment success cập nhật booking `CONFIRMED` trong transaction.
- [ ] Payment failed cập nhật payment `FAILED`.
- [ ] Xử lý callback đến sau khi booking expired.
- [ ] Ghi booking status history.
- [ ] Gửi notification payment success/fail.

Acceptance criteria:

- [ ] Thanh toán thành công thì booking thành `CONFIRMED`.
- [ ] Callback gọi lại nhiều lần không làm sai dữ liệu.
- [ ] Không confirm booking nếu hold đã hết hạn và không có logic đối soát hợp lệ.

---

### 6.11 Refund module

Mục tiêu: tạo và xử lý hoàn tiền.

Checklist:

- [ ] Tạo refund khi user hủy đúng hạn.
- [ ] Tạo refund khi manager/admin hủy do sân lỗi.
- [ ] Không tạo refund cho no-show/check-in expired.
- [ ] API admin list refunds.
- [ ] API admin retry refund.
- [ ] Refund phải liên kết `payment_id` bắt buộc.
- [ ] Refund phải liên kết `booking_id`.
- [ ] Ghi trạng thái refund.
- [ ] Ghi audit log khi admin xử lý refund thủ công.

Acceptance criteria:

- [ ] Refund chỉ phát sinh từ payment thành công.
- [ ] Refund policy đúng theo nguyên nhân hủy.
- [ ] Có trạng thái để đối soát: `REQUESTED`, `PROCESSING`, `SUCCESS`, `FAILED`, `MANUAL_REVIEW`.

---

### 6.12 Manager operations module

Mục tiêu: vận hành sân hằng ngày.

Checklist:

- [ ] API `GET /api/manager/bookings/today`.
- [ ] API `POST /api/manager/bookings/:id/check-in`.
- [ ] API `POST /api/manager/bookings/:id/complete`.
- [ ] API `POST /api/manager/bookings/:id/no-show`.
- [ ] API `POST /api/manager/bookings/:id/cancel`.
- [ ] Check-in chỉ cho booking `CONFIRMED` hoặc trạng thái hợp lệ theo spec.
- [ ] Check-in ghi `checked_in_by_user_id`.
- [ ] Complete chỉ cho booking `IN_USE`.
- [ ] Complete ghi `completed_by_user_id`.
- [ ] No-show không tạo refund.
- [ ] No-show tạo violation nếu policy yêu cầu.
- [ ] Manager cancel tạo refund 100% mặc định.
- [ ] Mọi chuyển trạng thái ghi `booking_status_histories`.

Acceptance criteria:

- [ ] Manager check-in được user tại sân.
- [ ] User không tự check-in được.
- [ ] Manager hoàn thành được buổi sử dụng.
- [ ] Manager xác nhận no-show và tạo violation đúng.

---

### 6.13 Jobs module

Mục tiêu: xử lý tự động các nghiệp vụ theo thời gian.

Checklist:

- [ ] Job expire pending payment bookings chạy mỗi 1 phút.
- [ ] Job chuyển booking quá giờ check-in.
- [ ] Job gửi notification trước giờ sử dụng nếu cần.
- [ ] Job notify waitlist khi slot được giải phóng.
- [ ] Job phải idempotent.
- [ ] Job ghi status history/audit log khi cập nhật trạng thái.
- [ ] Có log lỗi và retry strategy cơ bản.

Acceptance criteria:

- [ ] Booking quá hạn thanh toán tự chuyển `PAYMENT_EXPIRED`.
- [ ] Booking quá giờ check-in tự chuyển trạng thái đúng.
- [ ] Không job nào update trùng gây sai dữ liệu.

---

### 6.14 Waitlist module

Mục tiêu: cho phép user vào danh sách chờ khi slot đã kín.

Checklist:

- [ ] API join waitlist.
- [ ] API leave waitlist.
- [ ] API list my waitlist entries.
- [ ] Không cho join trùng cùng court/time.
- [ ] Sắp xếp theo priority group.
- [ ] Sắp xếp theo registered_at.
- [ ] Có thể tính điểm uy tín nếu áp dụng.
- [ ] Notify user ưu tiên cao nhất khi slot available.

Acceptance criteria:

- [ ] User vào waitlist được.
- [ ] Slot giải phóng thì user phù hợp được thông báo.
- [ ] Priority chỉ ảnh hưởng thứ tự waitlist, không cướp slot active.

---

### 6.15 Violations module

Mục tiêu: ghi nhận và xử lý điểm vi phạm.

Checklist:

- [ ] Tạo violation khi no-show.
- [ ] Tạo violation khi late cancellation nếu policy yêu cầu.
- [ ] API admin/manager list violations.
- [ ] API admin waive violation.
- [ ] API admin adjust violation points.
- [ ] Cộng điểm vào user.
- [ ] Kiểm tra threshold để khóa quyền đặt sân.
- [ ] Ghi audit log khi admin can thiệp.

Acceptance criteria:

- [ ] No-show tạo violation đúng.
- [ ] Vượt ngưỡng thì user bị restrict booking permission.
- [ ] Admin có thể miễn/điều chỉnh vi phạm có lý do.

---

### 6.16 Notifications module

Mục tiêu: thông báo sự kiện quan trọng.

Checklist:

- [ ] API list my notifications.
- [ ] API mark notification as read.
- [ ] Tạo notification khi booking pending payment.
- [ ] Tạo notification khi payment success/fail.
- [ ] Tạo notification khi booking expired.
- [ ] Tạo notification khi manager cancel.
- [ ] Tạo notification khi refund status changed.
- [ ] Tạo notification khi no-show/check-in expired.
- [ ] Tạo notification khi booking permission restricted.

Acceptance criteria:

- [ ] User nhận được notification trong app.
- [ ] Notification liên kết booking nếu có.

---

### 6.17 Reports module

Mục tiêu: báo cáo thống kê cho admin.

Checklist:

- [ ] API overview dashboard.
- [ ] Báo cáo số lượt đặt theo ngày/tháng.
- [ ] Báo cáo doanh thu từ payment success.
- [ ] Báo cáo sân được sử dụng nhiều nhất.
- [ ] Báo cáo tỷ lệ hủy.
- [ ] Báo cáo tỷ lệ hoàn tiền.
- [ ] Báo cáo tỷ lệ no-show.
- [ ] Báo cáo user vi phạm nhiều.
- [ ] Filter theo date range.

Acceptance criteria:

- [ ] Admin xem được số liệu cơ bản.
- [ ] Query không quá chậm với dataset mẫu.

---

## 7. Frontend modules checklist

### 7.1 Frontend foundation

Mục tiêu: tạo nền React + TypeScript ổn định.

Checklist:

- [ ] Khởi tạo React + TypeScript.
- [ ] Cấu hình router.
- [ ] Cấu hình API client.
- [ ] Cấu hình auth store.
- [ ] Cấu hình protected routes.
- [ ] Cấu hình role-based routes.
- [ ] Cấu hình global layout.
- [ ] Cấu hình toast/error handling.
- [ ] Cấu hình form validation.
- [ ] Cấu hình theme xanh nước biển.

Acceptance criteria:

- [ ] Frontend chạy được local.
- [ ] Có layout cơ bản.
- [ ] Có route auth/user/manager/admin.

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

- [ ] Tạo `AppHeader`.
- [ ] Tạo `SearchFilterBar`.
- [ ] Tạo `BottomNavigation`.
- [ ] Tạo `CourtCard`.
- [ ] Tạo `CourtGrid`.
- [ ] Tạo `CourtStatusBadge`.
- [ ] Tạo `CourtTagBadge`.
- [ ] Tạo `FavoriteButton`.
- [ ] Tạo `ShareButton`.
- [ ] Tạo `FilterDrawer`.
- [ ] Tạo `LoadingState`.
- [ ] Tạo `EmptyState`.
- [ ] Tạo `ErrorState`.

Acceptance criteria:

- [ ] UI mobile-first.
- [ ] Desktop hiển thị grid 3 cột.
- [ ] Tablet hiển thị grid 2 cột.
- [ ] Mobile hiển thị 1 cột.
- [ ] Bottom navigation fixed trên mobile.
- [ ] Không copy logo/hình ảnh/thương hiệu của website tham khảo.

---

### 7.3 Auth pages

Checklist:

- [ ] Register page.
- [ ] Login page.
- [ ] Logout action.
- [ ] Current user display.
- [ ] Validate form register/login.
- [ ] Redirect theo role sau login.

Acceptance criteria:

- [ ] User đăng ký/login/logout được.
- [ ] Sai thông tin hiển thị lỗi rõ ràng.
- [ ] Role redirect đúng.

---

### 7.4 User court browsing pages

Checklist:

- [ ] Home page với court cards.
- [ ] Court list page.
- [ ] Search by name.
- [ ] Filter by court type.
- [ ] Filter by location.
- [ ] Filter by status.
- [ ] Filter by price/time nếu backend hỗ trợ.
- [ ] Court detail page.
- [ ] Hiển thị ảnh, tên, địa chỉ, giờ mở cửa, trạng thái.
- [ ] Hiển thị availability slots.
- [ ] Hiển thị pricing.
- [ ] Hiển thị rules: cancel/check-in/refund.

Acceptance criteria:

- [ ] User tìm sân được.
- [ ] User xem chi tiết và lịch trống được.
- [ ] Court không khả dụng thì disable nút đặt lịch.

---

### 7.5 Booking pages

Checklist:

- [ ] Booking create page.
- [ ] Date picker.
- [ ] Slot picker.
- [ ] Participant count input.
- [ ] Usage purpose input.
- [ ] Booking summary card.
- [ ] Submit create booking hold.
- [ ] Payment page hoặc fake payment UI.
- [ ] My bookings page.
- [ ] Booking detail page.
- [ ] Cancel booking action.
- [ ] Booking history timeline.

Acceptance criteria:

- [ ] User tạo booking hold được.
- [ ] User thanh toán/fake payment được.
- [ ] User xem trạng thái booking/payment/refund được.
- [ ] User hủy booking hợp lệ được.

---

### 7.6 Manager pages

Checklist:

- [ ] Manager today schedule page.
- [ ] Search booking by code/user/court/time.
- [ ] Check-in action.
- [ ] Complete booking action.
- [ ] No-show management page.
- [ ] Manager cancel booking page/action.
- [ ] Court status management page.
- [ ] Usage history page.

Acceptance criteria:

- [ ] Manager check-in được booking.
- [ ] Manager complete được booking.
- [ ] Manager xác nhận no-show được.
- [ ] Manager cập nhật tình trạng sân được.

---

### 7.7 Admin pages

Checklist:

- [ ] Admin dashboard.
- [ ] User management page.
- [ ] Role assignment UI.
- [ ] Priority group management UI.
- [ ] Court type management UI.
- [ ] Court management UI.
- [ ] Operating hours UI.
- [ ] Pricing rules UI.
- [ ] Booking rules UI.
- [ ] Priority policies UI.
- [ ] Payment management UI.
- [ ] Refund management UI.
- [ ] Violation management UI.
- [ ] Reports page.

Acceptance criteria:

- [ ] Admin quản trị được dữ liệu cốt lõi.
- [ ] Admin cấu hình được nghiệp vụ động.
- [ ] Admin xem được báo cáo cơ bản.

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

- [ ] `POST /api/bookings`
- [ ] `GET /api/bookings/my`
- [ ] `GET /api/bookings/:id`
- [ ] `POST /api/bookings/:id/cancel`
- [ ] `GET /api/manager/bookings/today`
- [ ] `POST /api/manager/bookings/:id/check-in`
- [ ] `POST /api/manager/bookings/:id/complete`
- [ ] `POST /api/manager/bookings/:id/no-show`
- [ ] `POST /api/manager/bookings/:id/cancel`

### 8.5 Payment & refund APIs

- [ ] `POST /api/payments/create`
- [ ] `POST /api/payments/callback/:provider`
- [ ] `GET /api/payments/:id`
- [ ] `GET /api/admin/payments`
- [ ] `GET /api/admin/refunds`
- [ ] `POST /api/admin/refunds/:id/retry`

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

### 8.7 Reports APIs

- [ ] `GET /api/admin/reports/overview`
- [ ] `GET /api/admin/reports/bookings`
- [ ] `GET /api/admin/reports/revenue`
- [ ] `GET /api/admin/reports/violations`

---

## 9. Test checklist

### 9.1 Unit tests

- [x] Overlap detection.
- [ ] Booking duration validation.
- [x] Advance booking validation.
- [ ] Cancel/refund eligibility.
- [ ] Priority sorting.
- [ ] Violation point calculation.
- [ ] Payment callback idempotency logic.

### 9.2 Integration tests

- [ ] Register/login flow.
- [ ] Create booking hold.
- [ ] Prevent double booking.
- [ ] Payment success confirms booking.
- [ ] Expire pending payment booking.
- [ ] Manager check-in.
- [ ] Manager complete.
- [ ] No-show creates violation.
- [ ] User cancel creates refund when eligible.
- [ ] Manager cancel creates refund.
- [x] RBAC denies wrong role.

### 9.3 E2E tests

- [ ] User browses courts -> creates booking -> pays -> sees confirmed booking.
- [ ] Manager checks in booking -> completes booking.
- [ ] User does not arrive -> system expires check-in -> manager confirms no-show.
- [ ] Admin configures booking rule -> new rule affects booking validation.

---

## 10. Milestone roadmap

### Sprint 0 — Foundation

- [x] Backend foundation.
- [ ] Frontend foundation.
- [x] Prisma schema baseline.
- [x] Seed data.
- [x] Auth basic.
- [x] RBAC basic.

### Sprint 1 — Courts & availability

- [ ] Court types.
- [ ] Courts.
- [ ] Operating hours.
- [ ] Pricing rules.
- [ ] Availability API.
- [ ] Court list UI.
- [ ] Court detail UI.

### Sprint 2 — Booking & payment MVP

- [ ] Booking hold.
- [ ] Overlap prevention.
- [ ] Payment sandbox.
- [ ] Confirm booking after payment.
- [ ] My bookings UI.
- [ ] Booking detail UI.

### Sprint 3 — Manager operations

- [ ] Today schedule.
- [ ] Check-in.
- [ ] Complete booking.
- [ ] No-show.
- [ ] Manager cancel.
- [ ] Court status update.

### Sprint 4 — Refund, violation, jobs

- [ ] User cancellation.
- [ ] Refund module.
- [ ] Expire payment job.
- [ ] Check-in expiration job.
- [ ] Violation module.
- [ ] Notifications.

### Sprint 5 — Admin & reports

- [ ] User management.
- [ ] Role management.
- [ ] Booking rules.
- [ ] Priority groups.
- [ ] Payment/refund management.
- [ ] Reports dashboard.

### Sprint 6 — Polish & hardening

- [ ] Full E2E flow.
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
- [ ] Không cập nhật booking status mà không ghi `booking_status_histories`.
- [ ] Không thay đổi schema mà quên migration.
- [ ] Không thay đổi API mà quên cập nhật frontend types.

---

## 13. Tracking nhanh theo module

| Module | Owner | Status | Notes |
|---|---|---|---|
| Backend foundation | Codex | DONE | Express + TypeScript foundation verified: build/typecheck/lint/test/health |
| Database & Prisma | Codex | DONE | Schema/migration/seed verified; overlap constraint restored and checked in PostgreSQL |
| Auth | Codex | DONE | Auth APIs/JWT/password hashing verified; DB manual flow pending local PostgreSQL |
| RBAC & Users | Codex | DONE | Admin user/role APIs, RBAC tests, and audit logs implemented |
| Courts & Court Types | Codex | DONE | Court type/court APIs, filters, status updates, and status history implemented |
| Operating Hours & Pricing | Codex | DONE | Admin CRUD APIs implemented; booking-impact warnings deferred until booking/availability modules |
| Booking Rules & Priority | Codex | DONE | Admin config APIs, audit logs, and shared rules repository implemented |
| Availability | Codex | DONE | Hold-aware slot generation, conflict detection, pricing, and policy response implemented |
| Booking |  | TODO |  |
| Payment |  | TODO |  |
| Refund |  | TODO |  |
| Manager operations |  | TODO |  |
| Jobs |  | TODO |  |
| Waitlist |  | TODO |  |
| Violations |  | TODO |  |
| Notifications |  | TODO |  |
| Reports |  | TODO |  |
| Frontend foundation |  | TODO |  |
| UI design system |  | TODO |  |
| User pages |  | TODO |  |
| Manager pages |  | TODO |  |
| Admin pages |  | TODO |  |
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
