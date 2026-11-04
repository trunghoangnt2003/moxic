import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowDownUp, Search, TrendingDown } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { usePageMeta } from "../hooks/usePageMeta";
import { formatPrice } from "../lib/utils";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

interface Row {
  id: string;
  name: string;
  status: string;
  moxicPrice: number;
  storePrice: number;
  savePercent: number;
  storeCheckedAt: string | null;
}
interface PriceData {
  updatedAt: string;
  storeCheckedAt: string | null;
  avgSave: number;
  items: Row[];
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
type Sort = "save" | "price" | "name";

/** "Bảng giá game Xbox hôm nay": Xbox Store vs Moxic for every game, refreshed daily. */
export default function PriceListPage() {
  const today = new Date().toLocaleDateString("vi-VN");
  usePageMeta(`Bảng giá game Xbox hôm nay ${today}`, "So sánh giá game Xbox Store và giá Moxic, cập nhật hằng ngày.");
  const { data, isLoading } = useQuery({
    queryKey: ["seo", "prices"],
    queryFn: async () => (await api.get<PriceData>("/seo/prices")).data,
    staleTime: 10 * 60_000,
  });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("save");

  const rows = useMemo(() => {
    const list = (data?.items ?? []).filter((r) => !q.trim() || norm(r.name).includes(norm(q.trim())));
    return [...list].sort((a, b) =>
      sort === "save" ? b.savePercent - a.savePercent : sort === "price" ? a.moxicPrice - b.moxicPrice : a.name.localeCompare(b.name, "vi"),
    );
  }, [data, q, sort]);

  if (isLoading || !data) return <SectionLoader />;
  const totalSaved = data.items.reduce((s, r) => s + Math.max(0, r.storePrice - r.moxicPrice), 0);

  return (
    <Container className="mt-8 mb-20 max-w-5xl">
      <p className="text-xs uppercase tracking-[0.25em] text-accent">Cập nhật {today}</p>
      <h1 className="font-display text-3xl md:text-4xl font-extrabold mt-1">Bảng giá game Xbox hôm nay</h1>
      <p className="text-text-secondary mt-2 max-w-2xl">
        So sánh giá niêm yết trên Xbox Store Việt Nam với giá tại Moxic cho {data.items.length} game. Giá Xbox Store được kiểm tra tự động hằng ngày
        {data.storeCheckedAt ? ` (lần gần nhất ${new Date(data.storeCheckedAt).toLocaleDateString("vi-VN")})` : ""}.
      </p>

      <div className="grid grid-cols-3 gap-2 mt-5">
        <div className="border border-white/10 bg-bg-surface p-3 text-center">
          <p className="font-display text-2xl font-bold text-emerald-300">-{data.avgSave}%</p>
          <p className="text-[11px] text-text-muted">Tiết kiệm trung bình</p>
        </div>
        <div className="border border-white/10 bg-bg-surface p-3 text-center">
          <p className="font-display text-2xl font-bold">{data.items.length}</p>
          <p className="text-[11px] text-text-muted">Game</p>
        </div>
        <div className="border border-white/10 bg-bg-surface p-3 text-center">
          <p className="font-display text-lg sm:text-2xl font-bold text-accent">{formatPrice(totalSaved)}</p>
          <p className="text-[11px] text-text-muted">Tổng chênh lệch nếu mua hết</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm game…" className="w-full h-10 pl-9 pr-3 bg-bg-surface border border-white/15 text-[16px] sm:text-sm focus:outline-none focus:border-accent" />
        </div>
        <div className="inline-flex border border-white/15 text-xs">
          {(
            [
              ["save", "Tiết kiệm nhiều"],
              ["price", "Giá thấp"],
              ["name", "Tên A–Z"],
            ] as [Sort, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSort(k)} className={`px-3 h-10 inline-flex items-center gap-1 cursor-pointer ${sort === k ? "bg-accent/15 text-accent" : "text-text-muted hover:text-white"}`}>
              {sort === k && <ArrowDownUp className="w-3 h-3" />} {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 border border-white/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-text-muted text-xs">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold">Game</th>
              <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Xbox Store</th>
              <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">Moxic</th>
              <th className="text-right px-3 py-2.5 font-semibold">Tiết kiệm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.03]">
                <td className="px-3 py-2.5">
                  <Link to={`/games/${r.id}`} className="font-semibold hover:text-accent">
                    {r.name}
                  </Link>
                  {r.status !== "Có sẵn" && <span className="ml-2 text-[10px] px-1.5 py-0.5 border border-sky-400/40 text-sky-300">{r.status}</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-text-muted line-through whitespace-nowrap">{r.storePrice > r.moxicPrice ? formatPrice(r.storePrice) : "—"}</td>
                <td className="px-3 py-2.5 text-right font-bold text-accent whitespace-nowrap">{formatPrice(r.moxicPrice)}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {r.savePercent > 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                      <TrendingDown className="w-3.5 h-3.5" /> -{r.savePercent}%
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-text-muted">
        Có câu hỏi về cách mua? Xem <Link to="/hoi-dap" className="text-accent hover:underline">Hỏi đáp</Link>.
      </p>
    </Container>
  );
}
