import { Link } from "react-router-dom";

import { Button } from "../../components/common/Button";
import { ROUTE_PATHS } from "../../routes/route-paths";

type PlaceholderPageProps = {
  title: string;
  message: string;
};

export function PlaceholderPage({ message, title }: PlaceholderPageProps) {
  return (
    <section className="state-panel">
      <p className="eyebrow">Sắp triển khai</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <Link to={ROUTE_PATHS.courts}>
        <Button>Khám phá sân</Button>
      </Link>
    </section>
  );
}
