import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Users } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { RoomCard } from "../components/share/ShareParts";
import CreateRoomDialog from "../components/share/CreateRoomDialog";
import { useShareRooms } from "../hooks/useShare";
import { useMe } from "../hooks/useAccount";
import { usePageMeta } from "../hooks/usePageMeta";
import { t } from "../lib/i18n";
import type { ShareAccountType } from "../lib/shareApi";

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-xs transition-colors ${on ? "border-accent bg-accent font-semibold text-on-accent" : "border-border bg-bg-surface text-text-secondary hover:border-border-hover"}`;

/** /share — public list of rooms waiting for a partner, join by code, create a room. */
export default function ShareListPage() {
  usePageMeta(t("Tìm người share game Xbox"), t("Cùng mua game Xbox với người khác: chia tiền, mỗi người tự trả phần của mình."));
  const [params, setParams] = useSearchParams();
  const gameId = params.get("game") ?? undefined;
  const [accountType, setAccountType] = useState<ShareAccountType | undefined>();
  const [even, setEven] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState<"new" | "ending">("new");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(params.get("create") === "1");
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: rooms, isLoading } = useShareRooms({ gameId, accountType, percent: even ? 50 : undefined, sort, open: onlyOpen || undefined });

  const presetName = params.get("gameName");
  const preset = gameId && presetName ? { id: gameId, name: presetName } : undefined;

  const openCreate = () => {
    if (!me) {
      const back = `/share?${new URLSearchParams({ ...(gameId ? { game: gameId } : {}), ...(presetName ? { gameName: presetName } : {}), create: "1" })}`;
      navigate(`/login?redirect=${encodeURIComponent(back)}`);
      return;
    }
    setCreating(true);
  };

  return (
    <Container className="mb-20 mt-8">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto font-display text-3xl font-bold text-text-primary">{t("Tìm người share game")}</h1>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (c) navigate(`/share/${c}`);
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder={t("MÃ PHÒNG")}
            aria-label={t("Mã phòng")}
            className="h-10 w-32 rounded-md border border-border bg-bg-surface px-3 font-display text-sm font-semibold tracking-[0.15em] text-text-primary placeholder:tracking-normal placeholder:text-text-placeholder focus:border-accent focus:outline-none"
          />
          <button type="submit" className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover">{t("Vào phòng")}</button>
        </form>
        <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-semibold text-text-primary hover:border-border-hover">
          <Plus className="h-4 w-4" /> {t("Tạo phòng share")}
        </button>
      </div>
      <p className="mb-5 max-w-2xl text-sm text-text-muted">
        {t("Một bản quyền Xbox chơi được cho 2 người. Vào phòng, thoả thuận trong khu thảo luận, mỗi người tự quét QR trả phần của mình. Đủ 2 phần Moxic mới mua và cài game.")}
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {gameId && (
          <button type="button" className={chip(true)} onClick={() => { params.delete("game"); params.delete("gameName"); setParams(params); }}>
            {presetName ?? t("Game đã chọn")} ✕
          </button>
        )}
        <button type="button" className={chip(onlyOpen)} onClick={() => setOnlyOpen((v) => !v)}>{t("Đang thiếu người")}</button>
        <button type="button" className={chip(accountType === "Owner")} onClick={() => setAccountType(accountType === "Owner" ? undefined : "Owner")}>{t("Tài khoản chủ phòng")}</button>
        <button type="button" className={chip(accountType === "Moxic")} onClick={() => setAccountType(accountType === "Moxic" ? undefined : "Moxic")}>{t("Tài khoản Moxic cấp")}</button>
        <button type="button" className={chip(even)} onClick={() => setEven((v) => !v)}>{t("Chia 50/50")}</button>
        <button type="button" className={chip(false)} onClick={() => setSort(sort === "new" ? "ending" : "new")}>{sort === "new" ? t("Mới nhất") : t("Sắp hết hạn")} ▾</button>
      </div>

      {isLoading ? (
        <SectionLoader />
      ) : !rooms || rooms.length === 0 ? (
        <div className="rounded-lg border border-border bg-bg-surface py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-accent/60" />
          <p className="font-semibold text-text-primary">{t("Chưa có phòng nào đang tìm người")}</p>
          <p className="mb-5 mt-1 text-sm text-text-muted">{t("Tạo phòng rồi đăng link lên Facebook để rủ người share cùng.")}</p>
          <button type="button" onClick={openCreate} className="h-11 rounded-md bg-accent px-6 text-sm font-bold text-on-accent hover:bg-accent-hover">{t("Tạo phòng share")}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((r) => <RoomCard key={r.code} room={r} />)}
        </div>
      )}

      <CreateRoomDialog open={creating} onClose={() => setCreating(false)} preset={preset} />
    </Container>
  );
}
