import { Check, Layers, Minus } from "lucide-react";
import type { GameEdition } from "../../types/game";
import { formatPrice } from "../../lib/utils";

/** "So sánh phiên bản": rows = every included item across editions, columns = editions. */
export default function EditionCompare({
  editions,
  selectedId,
  onSelect,
}: {
  editions: GameEdition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rows: string[] = [];
  for (const e of editions) for (const item of e.includes) if (!rows.some((r) => r.toLowerCase() === item.toLowerCase())) rows.push(item);
  const has = (e: GameEdition, item: string) => e.includes.some((x) => x.toLowerCase() === item.toLowerCase());

  return (
    <section className="mt-12">
      <h2 className="font-display text-xl text-text-primary flex items-center gap-2 mb-5">
        <Layers className="w-5 h-5 text-accent" /> So sánh phiên bản
      </h2>
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-[38%]" />
              {editions.map((e) => {
                const active = e.id === selectedId;
                return (
                  <th key={e.id} className="p-0 align-bottom">
                    <button
                      type="button"
                      onClick={() => onSelect(e.id)}
                      aria-pressed={active}
                      className={`w-full px-3 pt-3 pb-3 border-t-2 text-center transition-colors cursor-pointer ${
                        active ? "border-accent bg-accent/10" : "border-transparent bg-bg-surface hover:bg-bg-surface-hover"
                      }`}
                    >
                      <span className={`block font-display font-bold ${active ? "text-white" : "text-text-secondary"}`}>{e.name}</span>
                      {e.originalPrice > e.salePrice && <span className="block text-[11px] text-text-muted line-through">{formatPrice(e.originalPrice)}</span>}
                      <span className={`block text-base font-bold ${active ? "text-accent" : "text-text-primary"}`}>{formatPrice(e.salePrice)}</span>
                      <span className={`mt-2 inline-block px-2 py-0.5 text-[11px] font-semibold ${active ? "bg-accent text-on-accent" : "border border-white/15 text-text-muted"}`}>
                        {active ? "Đang chọn" : "Chọn bản này"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => (
              <tr key={item} className={i % 2 === 0 ? "bg-white/[0.02]" : ""}>
                <td className="px-3 py-2.5 text-text-secondary">{item}</td>
                {editions.map((e) => (
                  <td key={e.id} className={`px-3 py-2.5 text-center ${e.id === selectedId ? "bg-accent/5" : ""}`}>
                    {has(e, item) ? (
                      <Check className="w-4 h-4 mx-auto text-positive" aria-label="Có" />
                    ) : (
                      <Minus className="w-4 h-4 mx-auto text-text-muted/50" aria-label="Không" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
