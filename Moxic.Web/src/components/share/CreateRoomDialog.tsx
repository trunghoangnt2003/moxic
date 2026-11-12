import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Globe, Loader2, Lock, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { t } from "../../lib/i18n";
import { formatPrice } from "../../lib/utils";
import { apiError } from "../../lib/communityApi";
import { createShareRoom, listShareableGames, splitAmounts, type ShareAccountType, type ShareableGame } from "../../lib/shareApi";
import { GameCover } from "./ShareParts";

const QUICK = [50, 60, 70];

function SplitPicker({ total, value, onChange }: { total: number; value: number; onChange: (v: number) => void }) {
  const { owner, partner } = splitAmounts(total, value);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${value === q ? "border-accent bg-accent text-on-accent" : "border-border text-text-secondary hover:border-border-hover"}`}
          >
            {q}/{100 - q}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={10}
        max={90}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={t("Phần của bạn (%)")}
        className="w-full accent-[var(--color-accent)]"
      />
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border border-accent/30 bg-accent/10 p-2.5">
          <p className="text-xs text-text-muted">{t("Bạn trả {0}%", [value])}</p>
          <p className="font-display text-lg font-bold text-text-primary num">{formatPrice(owner)}</p>
        </div>
        <div className="rounded-md border border-info/30 bg-info/10 p-2.5">
          <p className="text-xs text-text-muted">{t("Người share trả {0}%", [100 - value])}</p>
          <p className="font-display text-lg font-bold text-text-primary num">{formatPrice(partner)}</p>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-text-muted">{t("Mỗi người tự áp voucher của mình khi thanh toán.")}</p>
    </div>
  );
}

/** "Tạo phòng share": game (+ edition), account type, split, public/private. Opens the new room on success. */
export default function CreateRoomDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { id: string; name: string } }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [game, setGame] = useState<ShareableGame | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<ShareAccountType>("Owner");
  const [percent, setPercent] = useState(50);
  const [isPublic, setIsPublic] = useState(true);

  const { data: games, isFetching } = useQuery({
    queryKey: ["share", "games", preset ? preset.name : q],
    queryFn: () => listShareableGames(preset ? preset.name : q),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (preset && games && !game) {
      const g = games.find((x) => x.id === preset.id);
      if (g) setGame(g);
    }
  }, [preset, games, game]);

  useEffect(() => {
    if (game) setEditionId(game.editions.find((e) => e.isDefault)?.id ?? game.editions[0]?.id ?? null);
  }, [game]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const total = useMemo(() => {
    if (!game) return 0;
    return game.editions.find((e) => e.id === editionId)?.salePrice ?? game.salePrice;
  }, [game, editionId]);

  const create = useMutation({
    mutationFn: () => createShareRoom({ gameId: game!.id, editionId, accountType, ownerPercent: percent, isPublic }),
    onSuccess: (room) => {
      toast.success(t("Đã tạo phòng {0}", [room.code]));
      onClose();
      navigate(`/share/${room.code}`);
    },
    onError: (e) => toast.error(apiError(e, t("Không tạo được phòng"))),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Tạo phòng share")}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-border bg-bg-surface p-5 sm:rounded-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-text-primary">{t("Tạo phòng share")}</h2>
          <button type="button" onClick={onClose} aria-label={t("Đóng")} className="p-1 text-text-muted hover:text-text-primary"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-text-primary">{t("Game")}</p>
            {game ? (
              <div className="flex items-center gap-3 rounded-md border border-border bg-bg-base p-2.5">
                <GameCover url={game.coverUrl} className="h-14 w-11 rounded-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text-primary">{game.name}</p>
                  <p className="text-sm text-text-muted num">{formatPrice(total)}</p>
                </div>
                {!preset && <button type="button" onClick={() => setGame(null)} className="text-sm text-accent hover:underline">{t("Đổi")}</button>}
              </div>
            ) : (
              <>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("Tìm game cho phép share…")}
                    className="h-11 w-full rounded-md border border-border bg-bg-base pl-9 pr-3 text-sm text-text-primary placeholder:text-text-placeholder focus:border-accent focus:outline-none"
                  />
                </label>
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {isFetching && <li className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-accent" /></li>}
                  {(games ?? []).map((g) => (
                    <li key={g.id}>
                      <button type="button" onClick={() => setGame(g)} className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-bg-surface-hover">
                        <GameCover url={g.coverUrl} className="h-10 w-8 rounded-sm" />
                        <span className="flex-1 truncate text-sm text-text-primary">{g.name}</span>
                        <span className="text-sm text-text-muted num">{formatPrice(g.salePrice)}</span>
                      </button>
                    </li>
                  ))}
                  {games && games.length === 0 && !isFetching && <li className="py-3 text-center text-sm text-text-muted">{t("Không có game nào cho phép share.")}</li>}
                </ul>
              </>
            )}
            {game && game.editions.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {game.editions.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEditionId(e.id)}
                    className={`rounded-md border px-3 py-1.5 text-xs ${editionId === e.id ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary"}`}
                  >
                    {e.name} · {formatPrice(e.salePrice)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-text-primary">{t("Tài khoản Xbox để cài game")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["Owner", "Moxic"] as const).map((a) => (
                <label key={a} className={`cursor-pointer rounded-md border p-3 text-sm ${accountType === a ? "border-accent bg-accent/10" : "border-border hover:border-border-hover"}`}>
                  <input type="radio" name="accountType" className="sr-only" checked={accountType === a} onChange={() => setAccountType(a)} />
                  <span className="block font-semibold text-text-primary">{a === "Owner" ? t("Tài khoản của tôi") : t("Tài khoản Moxic cấp")}</span>
                  <span className="text-xs text-text-muted">
                    {a === "Owner" ? t("Cài vào tài khoản Xbox của chủ phòng (bạn).") : t("Moxic cấp một tài khoản riêng, cả hai nhận thông tin đăng nhập khi cài xong.")}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {game && (
            <div>
              <p className="mb-2 text-sm font-semibold text-text-primary">{t("Tỷ lệ chia tiền")}</p>
              <SplitPicker total={total} value={percent} onChange={setPercent} />
            </div>
          )}

          <button type="button" onClick={() => setIsPublic((v) => !v)} className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left text-sm hover:border-border-hover" aria-pressed={!isPublic}>
            {isPublic ? <Globe className="h-5 w-5 text-accent" /> : <Lock className="h-5 w-5 text-accent" />}
            <span className="flex-1">
              <span className="block font-semibold text-text-primary">{isPublic ? t("Phòng công khai") : t("Phòng riêng tư")}</span>
              <span className="text-xs text-text-muted">{isPublic ? t("Hiện trên trang Tìm người share.") : t("Chỉ ai có link hoặc mã phòng mới vào được.")}</span>
            </span>
            <span className="text-xs text-accent">{t("Đổi")}</span>
          </button>

          <button
            type="button"
            disabled={!game || create.isPending}
            onClick={() => create.mutate()}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent font-bold text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("Tạo phòng")}
          </button>
          <p className="text-center text-xs text-text-muted">{t("Phòng mở trong 7 ngày. Khi đủ 2 người, mỗi người có 48 giờ để thanh toán phần của mình.")}</p>
        </div>
      </div>
    </div>
  );
}
