import { Link } from "react-router-dom";
import Container from "../components/layout/Container";
import MyShareRooms from "../components/share/MyShareRooms";
import { usePageMeta } from "../hooks/usePageMeta";
import { t } from "../lib/i18n";

/** Tài khoản → "Phòng share": rooms I'm in or was in, status, who paid, links to the room and its discussion. */
export default function AccountSharesPage() {
  usePageMeta(t("Phòng share của tôi"));
  return (
    <Container className="mb-20 mt-8 max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-primary">{t("Phòng share")}</h1>
          <p className="mt-1 text-sm text-text-muted">{t("Các phòng bạn đang và đã tham gia, ai đã thanh toán, đơn đến bước nào.")}</p>
        </div>
        <Link to="/share" className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-bold text-on-accent hover:bg-accent-hover">{t("Tìm người share")}</Link>
      </div>
      <MyShareRooms />
    </Container>
  );
}
