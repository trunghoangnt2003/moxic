import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Check, Columns3, Crown, Minus, ShoppingCart, Star, X } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { getGameDetail } from "../lib/api";
import { compareList } from "../lib/localIds";
import { useCartStore } from "../lib/cartStore";
import { formatDate, formatPrice } from "../lib/utils";
import { PRODUCT_TYPE_LABELS } from "../lib/productTypes";
import type { GameDetail } from "../types/game";

import { t, locale } from "../lib/i18n";
type Row = { label: string; render: (g: GameDetail) => React.ReactNode; best?: (gs: GameDetail[]) => string | null };

const minBy = (gs: GameDetail[], f: (g: GameDetail) => number) => gs.reduce((b, g) => (f(g) < f(b) ? g : b), gs[0])?.id ?? null;
const maxBy = (gs: GameDetail[], f: (g: GameDetail) => number) => gs.reduce((b, g) => (f(g) > f(b) ? g : b), gs[0])?.id ?? null;
const discountOf = (g: GameDetail) => (g.originalPrice > 0 && g.salePrice < g.originalPrice ? Math.round((1 - g.salePrice / g.originalPrice) * 100) : 0);

const ROWS: Row[] = [
  { label: t("Giá bán"), render: (g) => <b className="text-accent">{g.salePrice > 0 ? formatPrice(g.salePrice) : t("Liên hệ")}</b>, best: (gs) => minBy(gs.filter((g) => g.salePrice > 0), (g) => g.salePrice) },
  { label: t("Giảm so với Store"), render: (g) => (discountOf(g) > 0 ? <span className="text-positive font-semibold">-{discountOf(g)}%</span> : "—"), best: (gs) => maxBy(gs, discountOf) },
  { label: t("Phiên bản"), render: (g) => (g.editions.length > 0 ? g.editions.map((e) => e.name).join(", ") : "Standard") },
  { label: t("Loại"), render: (g) => PRODUCT_TYPE_LABELS[g.productType] ?? g.productType },
  { label: t("Trạng thái"), render: (g) => (g.status === "Preorder" ? t("Đặt trước") : t("Sẵn có")) },
  { label: t("Phát hành"), render: (g) => (g.releaseDate ? formatDate(g.releaseDate) : "—") },
  { label: t("Thể loại"), render: (g) => g.genres.map((x) => x.name).join(", ") || "—" },
  { label: t("Nhà phát hành"), render: (g) => g.publisher ?? "—" },
  {
    label: t("Đánh giá khách"),
    render: (g) => (
      <span className="inline-flex items-center gap-1">
        <Star className="w-3.5 h-3.5 text-caution fill-caution" /> {g.storeRating.toFixed(1)} <span className="text-text-muted">({g.reviews.length})</span>
      </span>
    ),
    best: (gs) => maxBy(gs, (g) => g.storeRating),
  },
  { label: t("Đã bán"), render: (g) => g.purchaseCount.toLocaleString(locale), best: (gs) => maxBy(gs, (g) => g.purchaseCount) },
  ...(["os", "processor", "memory", "graphics", "storage"] as const).map(
    (k): Row => ({
      label: { os: t("Hệ máy"), processor: t("CPU (tối thiểu)"), memory: t("RAM (tối thiểu)"), graphics: t("GPU (tối thiểu)"), storage: t("Dung lượng") }[k],
      render: (g) => g.systemRequirements?.minimum?.[k] || "—",
    }),
  ),
];

/** Side-by-side comparison of up to 3 games (?ids= is shareable). */
export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const local = compareList.useIds();
  const urlIds = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3);
  const ids = urlIds.length > 0 ? urlIds : local;
  const addItem = useCartStore((s) => s.addItem);

  // Keep the URL shareable when coming from the tray.
  useEffect(() => {
    if (urlIds.length === 0 && local.length > 0) setParams({ ids: local.join(",") }, { replace: true });
  }, [urlIds.length, local, setParams]);

  const results = useQueries({ queries: ids.map((id) => ({ queryKey: ["game", id], queryFn: () => getGameDetail(id) })) });
  const games = results.map((r) => r.data).filter((g): g is GameDetail => !!g);
  const loading = results.some((r) => r.isLoading);

  const remove = (id: string) => {
    compareList.remove(id);
    const next = ids.filter((x) => x !== id);
    setParams(next.length ? { ids: next.join(",") } : {}, { replace: true });
  };

  if (ids.length === 0) {
    return (
      <Container className="mt-12 mb-20 text-center py-16">
        <Columns3 className="w-12 h-12 mx-auto text-info/50 mb-4" />
        <p className="font-semibold mb-1">{t("Chưa có game nào để so sánh")}</p>
        <p className="text-sm text-text-muted mb-6">{t("Bấm “So sánh” ở trang game để thêm tối đa 3 game.")}</p>
        <Link to="/games" className="inline-flex h-11 items-center px-6 bg-accent text-on-accent text-sm font-bold">
          {t("Đến cửa hàng")}
        </Link>
      </Container>
    );
  }
  if (loading) return <SectionLoader />;

  const bests = Object.fromEntries(ROWS.filter((r) => r.best).map((r) => [r.label, games.length > 1 ? r.best!(games) : null]));

  return (
    <Container className="mt-8 mb-24">
      <h1 className="font-display text-2xl md:text-4xl font-bold flex items-center gap-3 mb-6">
        <Columns3 className="w-7 h-7 text-info" /> {t("So sánh game")}
      </h1>
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-40 md:w-48" />
              {games.map((g) => (
                <th key={g.id} className="p-2 align-top text-left font-normal">
                  <div className="relative">
                    <Link to={`/games/${g.id}`} className="block aspect-[3/4] max-w-[180px] bg-bg-elevated overflow-hidden">
                      {g.media[0]?.presignedUrl && <img loading="lazy" decoding="async" src={g.media[0].presignedUrl} alt="" className="w-full h-full object-cover" />}
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(g.id)}
                      aria-label={t("Bỏ {0}", [g.name])}
                      className="absolute top-1 left-1 w-7 h-7 flex items-center justify-center bg-black/70 text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <Link to={`/games/${g.id}`} className="block mt-2 font-display font-bold text-white hover:text-accent line-clamp-2">
                    {g.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      addItem({ gameId: g.id, name: g.name, coverImageUrl: g.media[0]?.presignedUrl || "", price: g.salePrice, originalPrice: g.originalPrice, status: g.status, quantity: 1 });
                      toast.success(t("Đã thêm {0} vào giỏ", [g.name]));
                    }}
                    className="mt-2 h-9 px-3 inline-flex items-center gap-1.5 bg-accent text-on-accent text-xs font-bold cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" /> {t("Thêm vào giỏ")}
                  </button>
                </th>
              ))}
              {games.length < 3 && (
                <th className="p-2 align-top">
                  <Link to="/games" className="flex flex-col items-center justify-center gap-2 aspect-[3/4] max-w-[180px] border border-dashed border-white/15 text-text-muted hover:text-white hover:border-white/30 text-xs">
                    <Columns3 className="w-6 h-6" /> {t("Thêm game")}
                  </Link>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={r.label} className={i % 2 === 0 ? "bg-white/[0.02]" : ""}>
                <td className="px-3 py-2.5 text-text-muted text-xs">{r.label}</td>
                {games.map((g) => {
                  const isBest = bests[r.label] === g.id;
                  return (
                    <td key={g.id} className={`px-3 py-2.5 text-text-secondary ${isBest ? "bg-positive/[0.07]" : ""}`}>
                      <span className="inline-flex items-center gap-1.5">
                        {r.render(g)}
                        {isBest && <Crown className="w-3.5 h-3.5 text-caution" aria-label={t("Tốt nhất")} />}
                      </span>
                    </td>
                  );
                })}
                {games.length < 3 && <td />}
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2.5 text-text-muted text-xs">{t("Có trong bản")}</td>
              {games.map((g) => (
                <td key={g.id} className="px-3 py-2.5">
                  {g.editions.length === 0 ? (
                    <Minus className="w-4 h-4 text-text-muted/50" />
                  ) : (
                    <ul className="space-y-0.5 text-xs text-text-secondary">
                      {(g.editions.find((e) => e.isDefault) ?? g.editions[0]).includes.slice(0, 5).map((x) => (
                        <li key={x} className="flex items-start gap-1">
                          <Check className="w-3 h-3 text-positive mt-0.5 shrink-0" /> {x}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              ))}
              {games.length < 3 && <td />}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-text-muted flex items-center gap-1">
        <Crown className="w-3 h-3 text-caution" /> {t("= tốt nhất trong các game đang so sánh")}
      </p>
    </Container>
  );
}
