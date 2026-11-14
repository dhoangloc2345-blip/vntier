# VNTIER

Website xếp hạng Minecraft PvP với giao diện Việt/Anh, bộ lọc chế độ và khu vực đăng nhập Admin.

## Chạy thử
Yêu cầu Node.js 18 trở lên.

Đặt biến môi trường `ADMIN_PASSWORD` thành mật khẩu riêng có ít nhất 12 ký tự, sau đó chạy:

```bash
ADMIN_PASSWORD="your-long-unique-password" node server.js
```

Mở `http://localhost:3000`.

## Deploy
- Dùng dịch vụ hosting hỗ trợ Node.js.
- Build command: để trống.
- Start command: `node server.js`
- Environment variable: `ADMIN_PASSWORD` (mật khẩu riêng, tối thiểu 12 ký tự).
- Không đưa mật khẩu vào GitHub.

## Lưu ý quan trọng
Đây là bản khởi đầu/demo, chưa được kiểm thử bảo mật để vận hành công khai. Dữ liệu hiện lưu trong `data.json`; nhiều hosting miễn phí có ổ đĩa tạm thời và có thể xóa dữ liệu khi khởi động lại. Trước khi mở công khai, cần chuyển dữ liệu sang cơ sở dữ liệu bền vững, bật HTTPS, thêm giới hạn đăng nhập và sao lưu. Phiên đăng nhập hiện lưu trong bộ nhớ nên bị mất khi server khởi động lại.

Tier được sắp theo thứ tự từ thấp đến cao: LT5 → LT4 → LT3 → LT2 → LT1 → MT5 → MT4 → MT3 → MT2 → MT1 → HT5 → HT4 → HT3 → HT2 → HT1.
