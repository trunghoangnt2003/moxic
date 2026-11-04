import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useLuckySpinCasesPreview } from "../../hooks/useLuckySpin";
import type { PublicPrize } from "../../lib/luckySpinApi";
import PrizeCard, { RARITY_RANK } from "../lucky-spin/PrizeCard";

import { t } from "../../lib/i18n";
const CHAMFER = 16;
const chamferPolygon = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;

export default function LuckySpinBanner() {
  const { data } = useLuckySpinCasesPreview();
  const availableCases = data?.items.filter((c) => c.available) ?? [];
  if (availableCases.length === 0) return null;

  // Rarest preview prizes across available cases, unique, up to 5; the rarest sits in the middle of the fan.
  const unique = new Map<string, PublicPrize>();
  for (const c of availableCases) for (const p of c.previewPrizes) if (!unique.has(p.id)) unique.set(p.id, p);
  const rarest = [...unique.values()].sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]).slice(0, 5);
  if (rarest.length === 0) return null;
  const fanOrder = [3, 1, 0, 2, 4].filter((i) => i < rarest.length).map((i) => rarest[i]);
  const mid = (fanOrder.length - 1) / 2;

  return (
    <section className="relative" style={{ filter: "drop-shadow(0 0 18px rgba(168, 85, 247, 0.3))" }}>
      <div
        className="absolute inset-0"
        style={{
          clipPath: chamferPolygon(CHAMFER),
          background: "linear-gradient(135deg, var(--color-spin-glow) 0%, var(--color-spin-pink) 50%, var(--color-spin-glow) 100%)",
        }}
      />
      <div
        className="relative m-px flex flex-col items-center gap-6 overflow-hidden px-5 py-7 md:flex-row md:gap-10 md:px-10 md:py-9"
        style={{
          clipPath: chamferPolygon(CHAMFER - 1),
          background: "radial-gradient(ellipse at 70% 50%, var(--color-spin-panel) 0%, var(--color-spin-ink) 55%, var(--color-spin-void) 100%)",
        }}
      >
        {/* Copy */}
        <div className="relative z-10 flex-1 text-center md:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-highlight/30 bg-highlight/10 px-3 py-1 text-[10px] font-semibold text-highlight">
            <Sparkles className="h-3 w-3" /> {t("Sự kiện")}
          </span>
          <h2 className="mt-3 font-display text-2xl font-bold text-white md:text-3xl">{t("Vòng Quay May Mắn")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/70 md:mx-0">
            {t("Mở hòm bằng mã quay, miễn phí theo chu kỳ hoặc bằng điểm thưởng, cơ hội nhận game Xbox miễn phí và mã giảm giá")}
          </p>
          <Link
            to="/lucky-spin"
            className="mt-5 inline-flex items-center gap-2 rounded-sm px-6 py-3 font-display text-sm font-bold text-on-solid transition-[filter] hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, var(--color-spin-glow) 0%, var(--color-spin-pink) 100%)",
              boxShadow: "0 0 22px rgba(236, 72, 153, 0.35)",
            }}
          >
            {t("Mở hòm ngay")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Fanned preview */}
        <div className="relative h-[150px] w-full max-w-[300px] [--fan-spread:52px] sm:max-w-[360px] md:h-[200px] md:max-w-[440px] md:[--fan-spread:68px]">
          {fanOrder.map((prize, i) => {
            const off = i - mid;
            const outer = Math.abs(off) >= 2;
            return (
              <div
                key={prize.id}
                className={`absolute left-1/2 top-1/2 ${outer ? "hidden sm:block" : ""}`}
                style={{
                  transform: `translate(-50%, -50%) translateX(calc(${off} * var(--fan-spread))) translateY(${Math.abs(off) * 8}px) rotate(${off * 7}deg)`,
                  zIndex: 10 - Math.abs(Math.round(off)),
                  filter: "drop-shadow(0 8px 14px rgba(0, 0, 0, 0.55))",
                }}
              >
                <PrizeCard prize={prize} size="reel" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
