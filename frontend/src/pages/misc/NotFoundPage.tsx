import { Link } from "react-router-dom";

import { ROUTE_PATHS } from "../../routes/route-paths";

export function NotFoundPage() {
  return (
    <section className="state-panel">
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn bạn vừa mở không tồn tại hoặc đã được thay đổi.</p>
      <Link className="primary-button" to={ROUTE_PATHS.home}>
        Về trang chủ
      </Link>
    </section>
  );
}
