import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, Gift, Lock, ShieldCheck } from "lucide-react";
import Container from "../components/layout/Container";
import { PageLoader, MoxicLoader } from "../components/shared/MoxicLoader";
import { claimGift, getGift } from "../lib/api";
import { usePageMeta } from "../hooks/usePageMeta";

const BURST = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const r = 120 + (i % 3) * 40;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r - 40, color: ["#c9a96e", "#f43f5e", "#38bdf8", "#a3e635"][i % 4], delay: (i % 5) * 30 };
});

const inputClass =
  "w-full bg-bg-elevated border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-accent/60 text-text-primary placeholder:text-text-muted transition-colors";

export default function GiftPage() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const { data: gift, isLoading, error } = useQuery({
    queryKey: ["gift", token],
    queryFn: () => getGift(token!),
    enabled: !!token,
    retry: false,
  });
  usePageMeta("Bạn có một món quà", "Mở quà game Xbox từ Moxic GameStore.");

  const [phase, setPhase] = useState<"closed" | "opening" | "open">("closed");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState(false);

  const claim = useMutation({
    mutationFn: () => claimGift(token!, { xboxEmail: email.trim(), xboxPassword: password, phone: phone.trim() || undefined }),
    onSuccess: () => {
      setPassword("");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["gift", token] });
    },
    onError: (e: any) => setFormError(e?.response?.data?.error || "Không gửi được, vui lòng thử lại"),
  });

  if (isLoading) return <PageLoader />;
  if (error || !gift) {
    return (
      <Container className="py-20 text-center">
        <Gift className="w-12 h-12 mx-auto text-text-muted mb-4" />
        <p className="text-text-primary font-display text-xl mb-2">Không tìm thấy quà tặng</p>
        <p className="text-sm text-text-muted mb-6">Link có thể sai hoặc đã hết hạn.</p>
        <Link to="/" className="text-accent hover:underline text-sm">Về trang chủ</Link>
      </Container>
    );
  }

  // Returning visitors who already claimed skip the unboxing.
  const shown = phase === "open" || gift.claimed;
  const open = () => {
    if (phase !== "closed") return;
    setPhase("opening");
    window.setTimeout(() => setPhase("open"), 1100);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!email.includes("@")) return setFormError("Email tài khoản Xbox không hợp lệ");
    if (!password) return setFormError("Nhập mật khẩu tài khoản Xbox");
    claim.mutate();
  };

  const showForm = gift.canClaim && (!gift.claimed || editing || gift.status === "ActionRequired");

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,var(--color-bg-surface),var(--color-bg-base)_60%)] py-10 md:py-16 overflow-hidden">
      <Container>
        <div className="max-w-xl mx-auto">
          {!shown ? (
            <div className="text-center pt-6">
              <p className="text-xs text-accent mb-2">Moxic GameStore</p>
              <h1 className="font-display text-3xl md:text-4xl text-text-primary mb-2">
                {gift.recipientName ? `${gift.recipientName} ơi,` : "Bạn ơi,"} có quà nè!
              </h1>
              <p className="text-text-secondary mb-10">
                {gift.fromName ? <><b className="text-text-primary">{gift.fromName}</b> đã gửi tặng bạn</> : "Ai đó đã gửi tặng bạn"} một món quà game Xbox
              </p>

              <button
                type="button"
                onClick={open}
                aria-label="Mở quà"
                className="relative mx-auto block w-48 h-48 cursor-pointer select-none"
                style={{ animation: phase === "closed" ? "gift-float 2.4s ease-in-out infinite" : undefined }}
              >
                <span className="absolute inset-0" style={{ animation: phase === "opening" ? "gift-shake 0.45s ease-in-out" : undefined }}>
                  {/* box */}
                  <span className="absolute left-4 right-4 bottom-0 h-28 bg-gradient-to-b from-accent to-accent-deep shadow-2xl shadow-black/60" />
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-6 h-28 bg-negative/90" />
                  {/* lid */}
                  <span
                    className="absolute left-1 right-1 top-12 h-10 bg-gradient-to-b from-accent to-accent shadow-lg"
                    style={{ animation: phase === "opening" ? "gift-lid 0.6s 0.45s ease-in forwards" : undefined }}
                  >
                    <span className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-6 bg-negative" />
                    <span className="absolute left-1/2 -top-7 -translate-x-[110%] w-10 h-8 border-[6px] border-negative rounded-full rotate-[-20deg]" />
                    <span className="absolute left-1/2 -top-7 translate-x-[10%] w-10 h-8 border-[6px] border-negative rounded-full rotate-[20deg]" />
                  </span>
                </span>
                {phase === "opening" &&
                  BURST.map((b, i) => (
                    <span
                      key={i}
                      className="absolute left-1/2 top-1/2 w-2.5 h-2.5 rounded-sm"
                      style={{
                        background: b.color,
                        ["--dx" as string]: `${b.dx}px`,
                        ["--dy" as string]: `${b.dy}px`,
                        animation: `gift-burst 0.9s ${450 + b.delay}ms ease-out forwards`,
                        opacity: 0,
                      }}
                    />
                  ))}
              </button>
              <p className="mt-8 text-sm text-text-muted">{phase === "closed" ? "Chạm vào hộp quà để mở" : "Đang mở…"}</p>
            </div>
          ) : (
            <div className="space-y-5 animate-[popIn_0.4s_ease-out]">
              <div className="text-center">
                <p className="text-xs text-accent mb-2">Quà tặng từ {gift.fromName || "một người bạn"}</p>
                <h1 className="font-display text-2xl md:text-3xl text-text-primary">
                  {gift.items.length === 1 ? gift.items[0].gameName : `${gift.items.length} game Xbox`}
                </h1>
              </div>

              <div className={`grid gap-3 ${gift.items.length === 1 ? "grid-cols-1 max-w-[220px] mx-auto" : "grid-cols-2 sm:grid-cols-3"}`}>
                {gift.items.map((it, i) => (
                  <Link key={i} to={`/games/${it.gameId}`} className="group block">
                    <div className="aspect-[3/4] bg-bg-surface overflow-hidden border border-white/10 group-hover:border-accent/60 transition-colors">
                      {it.coverUrl ? (
                        <img loading="lazy" decoding="async" src={it.coverUrl} alt={it.gameName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Gift className="w-10 h-10 text-text-muted" /></div>
                      )}
                    </div>
                    {gift.items.length > 1 && <p className="mt-1.5 text-xs text-text-primary line-clamp-2">{it.gameName}</p>}
                    {it.editionName && <p className="text-[11px] text-text-muted">{it.editionName}</p>}
                  </Link>
                ))}
              </div>

              {gift.message && (
                <blockquote className="relative bg-bg-surface border border-white/10 px-5 py-4 text-text-primary italic whitespace-pre-line">
                  <span className="absolute -top-3 left-4 text-4xl leading-none text-accent">“</span>
                  {gift.message}
                  {gift.fromName && <span className="block not-italic text-right text-xs text-text-secondary mt-2">{gift.fromName}</span>}
                </blockquote>
              )}

              {gift.status === "Cancelled" ? (
                <div className="flex items-center gap-2 bg-negative/10 border border-negative/30 px-4 py-3 text-sm text-negative">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Đơn quà tặng này đã bị hủy.
                </div>
              ) : gift.status === "Completed" ? (
                <div className="flex items-center gap-2 bg-positive/10 border border-positive/30 px-4 py-3 text-sm text-positive">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Game đã được cài vào tài khoản {gift.xboxEmailHint}. Chơi vui nhé!
                </div>
              ) : gift.claimed && !showForm ? (
                <div className="bg-bg-surface border border-white/10 p-5 space-y-2">
                  <p className="flex items-center gap-2 text-positive font-semibold"><CheckCircle2 className="w-5 h-5" /> Đã nhận quà</p>
                  <p className="text-sm text-text-secondary">
                    Tài khoản Xbox: <b className="text-text-primary">{gift.xboxEmailHint}</b>.{" "}
                    {gift.status === "Installing" ? "Moxic đang cài game cho bạn." : gift.paid ? "Moxic sẽ cài game sớm nhất." : "Moxic sẽ cài game ngay khi người tặng hoàn tất thanh toán."}
                  </p>
                  {gift.canClaim && (
                    <button type="button" onClick={() => setEditing(true)} className="text-xs text-accent hover:underline cursor-pointer">
                      Nhập sai? Cập nhật tài khoản Xbox
                    </button>
                  )}
                </div>
              ) : null}

              {showForm && gift.status !== "Cancelled" && (
                <form onSubmit={submit} className="bg-bg-surface border border-white/10 p-5 space-y-4">
                  <div>
                    <h2 className="font-display text-lg text-text-primary">Nhận quà vào tài khoản Xbox của bạn</h2>
                    <p className="text-xs text-text-muted mt-1">
                      {gift.status === "ActionRequired"
                        ? "Thông tin trước đó chưa đúng, vui lòng nhập lại."
                        : "Moxic sẽ đăng nhập để cài game, giống như khi bạn tự mua."}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="gift-email" className="block text-xs text-text-secondary font-semibold mb-1.5">Email tài khoản Xbox *</label>
                    <input id="gift-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@outlook.com" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="gift-pass" className="block text-xs text-text-secondary font-semibold mb-1.5">Mật khẩu tài khoản Xbox *</label>
                    <input id="gift-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu đăng nhập Xbox" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="gift-phone" className="block text-xs text-text-secondary font-semibold mb-1.5">SĐT / Zalo <span className="text-text-muted">(để Moxic liên hệ khi cài)</span></label>
                    <input id="gift-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901234567" className={inputClass} />
                  </div>
                  <p className="flex items-start gap-2 text-[11px] text-text-muted">
                    <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Mật khẩu được mã hóa, chỉ dùng để cài game. Bạn nên đổi mật khẩu sau khi game đã được cài.
                  </p>
                  {formError && (
                    <p className="flex items-center gap-2 bg-negative/10 border border-negative/30 px-3 py-2 text-xs text-negative">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                    </p>
                  )}
                  <button type="submit" disabled={claim.isPending} className="w-full h-12 inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-on-accent font-bold disabled:opacity-50 cursor-pointer">
                    {claim.isPending ? <><MoxicLoader size="sm" /> Đang gửi…</> : <><Gift className="w-4 h-4" /> Nhận quà</>}
                  </button>
                </form>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary">
                <p className="flex items-center gap-2 bg-bg-surface/60 border border-white/10 px-3 py-2.5"><ShieldCheck className="w-4 h-4 text-accent shrink-0" /> Game chính hãng Microsoft</p>
                <p className="flex items-center gap-2 bg-bg-surface/60 border border-white/10 px-3 py-2.5"><Clock className="w-4 h-4 text-accent shrink-0" /> Cài trong 15 đến 30 phút</p>
              </div>

              <p className="text-center text-sm text-text-muted">
                Muốn tặng lại bạn bè?{" "}
                <Link to="/games" className="text-accent hover:underline">Khám phá game giá rẻ</Link>
              </p>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
