# Business Changes Log

## Scope
Tài liệu này ghi lại các thay đổi nghiệp vụ đã chốt để  thống nhất với `agent-spec.md`.

## Changelog nghiệp vụ cuối cùng

### 1. Booking không duyệt tay
- Bỏ workflow quản trị viên duyệt/từ chối booking thông thường.
- Booking đi theo luồng: tạo giữ chỗ tạm → thanh toán 100% → tự động xác nhận.

### 2. Thanh toán 100% trước khi xác nhận
- Không dùng đặt cọc.
- Chỉ thanh toán đủ 100% mới chuyển booking sang `CONFIRMED`.
- Đơn chờ thanh toán hết hạn thì tự chuyển `PAYMENT_EXPIRED`.

### 3. Priority booking
- Thứ tự ưu tiên: cán bộ/giảng viên → sinh viên → người ngoài trường.
- Priority chỉ ảnh hưởng: số ngày được đặt trước, quota, waitlist, khung giờ ưu tiên nếu có.
- Priority không được cướp slot đã hold hoặc đã confirm.

### 4. Check-in do quản lý sân xác nhận
- Người dùng không tự check-in.
- Ban quản lý sân/field manager là người xác nhận check-in.
- Check-in thành công thì booking sang `IN_USE`.

### 5. Hết giờ thì hệ thống tự hoàn thành
- Khi hết thời gian sử dụng, hệ thống tự động chuyển booking sang `COMPLETED`.
- Ban quản lý chỉ can thiệp nếu có ngoại lệ hoặc cần đóng sớm.

### 6. Quá giờ check-in / no-show
- Hết `late_checkin_minutes` mà chưa check-in thì booking sang `CHECKIN_EXPIRED`.
- Đây là trạng thái chờ ban quản lý xử lý.
- Ban quản lý có thể cho check-in muộn nếu sân chưa bị dùng bởi người khác, hoặc xác nhận `NO_SHOW`.
- `NO_SHOW` không hoàn tiền và có thể tạo vi phạm.

### 7. Hủy và hoàn tiền
- User hủy đúng hạn: có thể hoàn tiền theo cấu hình.
- User hủy sát giờ hoặc quá hạn: không hoàn tiền.
- Manager/Admin hủy do sân lỗi, bảo trì, sự cố: hoàn tiền 100% mặc định.
- `CHECKIN_EXPIRED` và `NO_SHOW` không hoàn tiền.

### 8. RBAC
- Dùng `users + roles + user_roles`.
- Không lưu role enum trực tiếp trong `users`.
- Một user có thể có nhiều role.

### 9. Naming convention DB
- Bảng số nhiều, snake_case.
- Nguồn chân lý: `operating_hours`, `booking_status_histories`, `refunds`, `roles`, `user_roles`, `court_status_histories`, `system_settings`.
- Không dùng lại các tên cũ như `court_schedule`, `booking_history`, `payment_refund`, `field_managers`.

### 10. Audit & history
- Mọi chuyển trạng thái booking phải ghi `booking_status_histories`.
- Đổi trạng thái sân phải ghi `court_status_histories`.
- Thao tác nhạy cảm phải ghi `audit_logs`.

### 11. Hold & chống double booking
- Booking active statuses chiếm slot: `PENDING_PAYMENT`, `PAYMENT_PROCESSING`, `CONFIRMED`, `IN_USE`.
- Chống overlap bằng transaction/locking và constraint DB nếu có.

### 12. Tài liệu giao diện/feature
- Trang manager `InUse` chỉ xử lý ngoại lệ/đóng sớm, không phải luồng hoàn thành thủ công mặc định.
- Hết giờ sử dụng là job hệ thống xử lý tự động.

## Ghi chú cho coding agent
Khi code, ưu tiên đọc `agent-spec.md` và dùng changelog này để nhận diện các điểm nghiệp vụ đã thay đổi so với phiên bản cũ.
