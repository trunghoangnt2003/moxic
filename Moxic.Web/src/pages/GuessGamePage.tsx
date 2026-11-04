import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Flame, HelpCircle, Lightbulb, RefreshCw, Search, ShoppingCart, Timer, X } from "lucide-react";
import Container from "../components/layout/Container";
import ShareButton from "../components/shared/ShareButton";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { usePageMeta } from "../hooks/usePageMeta";
import { confetti, haptic } from "../lib/fx";
import { getGuessOptions, getGuessToday, imageUrl, submitGuess, type GuessState } from "../lib/guessApi";
import { formatPrice } from "../lib/utils";

const POINTS = [100, 70, 50, 35, 20, 10];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="font-mono tabular-nums">
      {p(Math.floor(ms / 3_600_000))}:{p(Math.floor((ms % 3_600_000) / 60_000))}:{p(Math.floor((ms % 60_000) / 1000))}
    </span>
  );
}

function shareText(s: GuessState) {
  const cells = s.guesses.map((g) => (g.correct ? "🟩" : "🟥")).join("");
  const pad = s.solved ? "" : "";
  return `Moxic Đoán Game #${s.number} 🎮\n${cells}${pad} ${s.solved ? `${s.tries}/${s.maxTries}` : `X/${s.maxTries}`}${s.streak > 1 ? ` 🔥${s.streak}` : ""}\nThử sức tại moxic.co/doan-game`;
}

/** Daily "guess the game from a pixelated picture" puzzle. */
export default function GuessGamePage() {
  usePageMeta("Đoán game mỗi ngày", "Đoán tên game Xbox từ ảnh bị làm mờ — mỗi ngày một câu, đoán sớm nhận nhiều điểm.");
  const qc = useQueryClient();
  const { data: s, isLoading, error } = useQuery({ queryKey: ["guess", "today"], queryFn: getGuessToday, staleTime: 30_000 });
  const { data: options } = useQuery({ queryKey: ["guess", "options"], queryFn: getGuessOptions, staleTime: 10 * 60_000 });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  // Image retry: auto-retry 3 times with backoff, then show a reload button. "attempt" busts the browser cache.
  const [attempt, setAttempt] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const guess = useMutation({
    mutationFn: submitGuess,
    onSuccess: (r) => {
      qc.setQueryData(["guess", "today"], r.state);
      setQ("");
      setOpen(false);
      if (r.correct) {
        haptic([20, 60, 20, 60, 80]);
        confetti();
        toast.success(r.earned > 0 ? `Chính xác! +${r.earned} điểm 🎉` : "Chính xác! 🎉", { duration: 5000 });
        qc.invalidateQueries({ queryKey: ["loyalty"] });
      } else {
        haptic(60);
        setShake(true);
        window.setTimeout(() => setShake(false), 500);
        if (r.state.finished) toast("Hết lượt rồi — xem đáp án bên dưới", { icon: "😢" });
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Không gửi được, thử lại nhé"),
  });

  const guessedIds = useMemo(() => new Set(s?.guesses.map((g) => g.id) ?? []), [s]);
  const matches = useMemo(() => {
    if (!options || q.trim().length < 1) return [];
    const nq = norm(q.trim());
    return options.filter((o) => !guessedIds.has(o.id) && norm(o.name).includes(nq)).slice(0, 8);
  }, [options, q, guessedIds]);

  useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
    setAttempt(0);
  }, [s?.imagePath]);
  useEffect(() => {
    if (imgLoaded || imgFailed) return setSlow(false);
    const t = window.setTimeout(() => setSlow(true), 7000);
    return () => window.clearTimeout(t);
  }, [imgLoaded, imgFailed, attempt, s?.imagePath]);
  const reloadImage = () => {
    setImgFailed(false);
    setImgLoaded(false);
    setAttempt((a) => a + 1);
  };
  useEffect(() => setHighlight(0), [q]);

  if (isLoading) return <SectionLoader />;
  if (error || !s)
    return (
      <Container className="py-20 text-center">
        <p className="text-4xl mb-3">🎮</p>
        <p className="font-semibold">Câu đố hôm nay chưa sẵn sàng</p>
        <p className="text-sm text-text-muted">Quay lại sau ít phút nhé!</p>
      </Container>
    );

  const pick = (id: string) => {
    if (guess.isPending || s.finished) return;
    guess.mutate(id);
  };
  const triesLeft = s.maxTries - s.tries;
  const discount = s.answer && s.answer.originalPrice > s.answer.salePrice ? Math.round((1 - s.answer.salePrice / s.answer.originalPrice) * 100) : 0;
  const maxDist = Math.max(1, ...s.stats.distribution);

  return (
    <Container className="mt-6 mb-20 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-accent">Mỗi ngày một câu</p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold">Đoán Game #{s.number}</h1>
        </div>
        <div className="flex items-center gap-2">
          {s.signedIn && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 border text-sm font-bold ${s.streak > 0 ? "border-orange-400/50 bg-orange-500/10 text-orange-300" : "border-white/10 text-text-muted"}`} title="Chuỗi ngày đoán đúng">
              <Flame className="w-4 h-4" /> {s.streak}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-white/10 text-xs text-text-secondary" title="Câu đố mới sau">
            <Timer className="w-3.5 h-3.5" /> <Countdown to={s.nextAt} />
          </span>
        </div>
      </div>

      {/* Picture */}
      <div className={`relative overflow-hidden border border-white/10 bg-black aspect-video ${shake ? "animate-[gift-shake_0.45s_ease-in-out]" : ""}`}>
        {!imgLoaded && !imgFailed && <div className="absolute inset-0 skeleton" />}
        <img
          key={`${s.imagePath}-${attempt}`}
          src={imageUrl(s.imagePath) + (attempt ? `&r=${attempt}` : "")}
          alt="Ảnh game cần đoán"
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            if (attempt < 3) window.setTimeout(() => setAttempt((a) => a + 1), 800 * (attempt + 1));
            else setImgFailed(true);
          }}
          draggable={false}
          className={`w-full h-full object-cover select-none transition-[opacity,filter] duration-700 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
        />
        {(imgFailed || slow) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-center p-4">
            <p className="text-sm text-text-secondary">{imgFailed ? "Không tải được ảnh." : "Ảnh đang tải hơi lâu…"}</p>
            <button type="button" onClick={reloadImage} className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-bg-base text-sm font-bold cursor-pointer">
              <RefreshCw className="w-4 h-4" /> Tải lại ảnh
            </button>
          </div>
        )}
        {imgLoaded && (
          <button type="button" onClick={reloadImage} aria-label="Tải lại ảnh" title="Tải lại ảnh" className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/60 text-white/80 hover:text-white cursor-pointer">
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        {!s.finished && (
          <span className="absolute top-2 left-2 px-2 py-1 text-[11px] font-bold bg-black/70 text-white">
            Đoán đúng ngay: +{s.nextPoints} điểm
          </span>
        )}
        {s.finished && s.answer && (
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent animate-[popIn_0.4s_ease-out]">
            <p className="text-xs text-text-muted">{s.solved ? "Bạn đoán đúng!" : "Đáp án là"}</p>
            <p className="font-display text-xl font-bold">{s.answer.name}</p>
          </div>
        )}
      </div>

      {/* Tries */}
      <div className="flex items-center gap-1.5 mt-3" aria-label={`Đã đoán ${s.tries}/${s.maxTries}`}>
        {Array.from({ length: s.maxTries }).map((_, i) => {
          const g = s.guesses[i];
          return (
            <span
              key={i}
              className={`flex-1 h-2 rounded-full transition-colors duration-500 ${g ? (g.correct ? "bg-emerald-400" : "bg-red-500/80") : "bg-white/10"}`}
            />
          );
        })}
        <span className="ml-2 text-xs text-text-muted whitespace-nowrap">{s.finished ? "Xong" : `Còn ${triesLeft} lượt`}</span>
      </div>

      {/* Input */}
      {!s.finished && (
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, matches.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter" && matches[highlight]) {
                e.preventDefault();
                pick(matches[highlight].id);
              } else if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Gõ tên game để đoán…"
            disabled={guess.isPending}
            className="w-full h-12 pl-10 pr-10 bg-bg-surface border border-white/15 text-[16px] focus:outline-none focus:border-accent"
            aria-autocomplete="list"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Xóa" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
          {open && matches.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-bg-elevated border border-white/10 shadow-2xl shadow-black/60" role="listbox">
              {matches.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(m.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm cursor-pointer ${i === highlight ? "bg-accent/15 text-white" : "text-text-secondary hover:bg-white/5"}`}
                  >
                    {m.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && q.trim().length > 1 && matches.length === 0 && options && (
            <p className="absolute left-0 right-0 mt-1 px-3 py-2 text-xs text-text-muted bg-bg-elevated border border-white/10">Không có game này trong kho Moxic</p>
          )}
        </div>
      )}

      {/* Wrong guesses */}
      {s.guesses.some((g) => !g.correct) && (
        <ul className="mt-3 space-y-1.5">
          {s.guesses
            .filter((g) => !g.correct)
            .map((g) => (
              <li key={g.id} className="flex items-center gap-2 px-3 py-2 text-sm bg-red-500/10 border border-red-500/20 text-red-200 animate-[popIn_0.25s_ease-out]">
                <X className="w-4 h-4 shrink-0" /> {g.name}
              </li>
            ))}
        </ul>
      )}

      {/* Hints */}
      {s.hints.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {s.hints.map((h) => (
            <div key={h.label} className="px-3 py-2 border border-amber-400/25 bg-amber-400/5 animate-[popIn_0.3s_ease-out]">
              <p className="text-[10px] uppercase tracking-wider text-amber-300/80 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> {h.label}
              </p>
              <p className="text-sm font-semibold truncate">{h.value}</p>
            </div>
          ))}
        </div>
      )}
      {!s.finished && s.tries < 2 && (
        <p className="mt-3 text-[11px] text-text-muted flex items-center gap-1">
          <HelpCircle className="w-3 h-3" /> Mỗi lần đoán sai ảnh rõ hơn; từ lần sai thứ 2 sẽ có gợi ý.
        </p>
      )}

      {/* Result */}
      {s.finished && (
        <section className="mt-5 border border-white/10 bg-bg-surface p-4 sm:p-5 space-y-4 animate-[popIn_0.4s_ease-out]">
          <div className="text-center">
            <p className="text-4xl">{s.solved ? "🎉" : "😢"}</p>
            <p className="font-display text-xl font-bold mt-1">
              {s.solved ? `Đúng sau ${s.tries} lần đoán!` : "Hết lượt mất rồi"}
            </p>
            {s.solved && s.points > 0 && <p className="text-amber-300 font-bold">+{s.points} điểm thưởng</p>}
            {s.solved && !s.signedIn && (
              <p className="text-sm text-text-muted mt-1">
                <Link to="/login?redirect=/doan-game" className="text-accent hover:underline">Đăng nhập</Link> để nhận điểm và giữ chuỗi ngày nhé.
              </p>
            )}
            <p className="text-xs text-text-muted mt-2">
              Câu mới sau <Countdown to={s.nextAt} />
            </p>
          </div>

          {s.answer && (
            <Link
              to={`/games/${s.answer.id}`}
              className="flex items-center justify-center gap-2 h-12 bg-accent text-bg-base font-bold"
            >
              <ShoppingCart className="w-4 h-4" /> Mua {s.answer.name.length > 24 ? s.answer.name.slice(0, 24) + "…" : s.answer.name} — {formatPrice(s.answer.salePrice)}
              {discount > 0 && <span className="text-xs font-semibold">(-{discount}%)</span>}
            </Link>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareText(s));
                  toast.success("Đã copy kết quả — dán vào Facebook/Zalo khoe bạn bè!");
                } catch {
                  toast.error("Không copy được");
                }
              }}
              className="h-10 border border-white/15 text-sm font-semibold cursor-pointer"
            >
              {s.guesses.map((g) => (g.correct ? "🟩" : "🟥")).join("")} Copy kết quả
            </button>
            <ShareButton path="/doan-game" title={`Moxic Đoán Game #${s.number}`} text={shareText(s)} label="Thách bạn bè" />
          </div>

          {s.stats.players > 0 && (
            <div>
              <p className="text-xs text-text-muted mb-2">
                {s.stats.players} người đã chơi · {Math.round((s.stats.solved / s.stats.players) * 100)}% đoán đúng
              </p>
              <div className="space-y-1">
                {s.stats.distribution.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-text-muted">{i + 1}</span>
                    <div className="flex-1 h-4 bg-white/5">
                      <div
                        className={`h-full ${s.solved && s.tries === i + 1 ? "bg-emerald-500" : "bg-white/20"} transition-[width] duration-700`}
                        style={{ width: `${(n / maxDist) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Rules */}
      <details className="mt-5 border border-white/10 bg-bg-surface/60 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Cách tính điểm</summary>
        <ul className="mt-2 space-y-1 text-text-secondary">
          <li>Đoán đúng ở lần 1 → 6: {POINTS.join(" / ")} điểm.</li>
          <li>Chuỗi ngày đúng liên tiếp: +5 điểm mỗi ngày (tối đa +50).</li>
          <li>Câu đố mới mỗi ngày lúc 0h (giờ Việt Nam). Điểm chỉ tính cho tài khoản đã đăng nhập.</li>
        </ul>
      </details>
    </Container>
  );
}
