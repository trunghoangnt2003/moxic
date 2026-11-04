import { useState, useEffect } from "react";
import WishlistButton from "../components/games/WishlistButton";
import EditionCompare from "../components/game-detail/EditionCompare";
import RentPanel from "../components/rental/RentPanel";
import { CompareButton } from "../components/games/Compare";
import { SaleCountdown } from "../components/games/FlashSale";
import { GamePageRails } from "../components/games/DiscoveryRails";
import PriceHistory from "../components/game-detail/PriceHistory";
import GameDiscussion from "../components/community/GameDiscussion";
import ReportButton from "../components/community/ReportButton";
import { PRODUCT_TYPE_LABELS } from "../lib/productTypes";
import RecentlyViewed from "../components/games/RecentlyViewed";
import ShareButton from "../components/shared/ShareButton";
import { usePageMeta } from "../hooks/usePageMeta";
import { recentlyViewed } from "../lib/localIds";
import { useParams, Link } from "react-router-dom";
import { useGameDetail } from "../hooks/useGames";
import Container from "../components/layout/Container";
import Button from "../components/shared/Button";
import Badge from "../components/shared/Badge";
import type { GameReview } from "../types/game";
import { PageLoader } from "../components/shared/MoxicLoader";
import { formatPrice, formatDate, daysUntil, timeAgo } from "../lib/utils";
import { useCartStore } from "../lib/cartStore";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  CreditCard,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Star,
  Info,
  Monitor,
  Check,
  Flame,
  MessageCircle,
  User,
  BadgeCheck,
} from "lucide-react";
import toast from "react-hot-toast";

import ReviewForm from "../components/game-detail/ReviewForm";
function RatingCard({
  source,
  score,
  maxScore,
  label,
}: {
  source: string;
  score: number;
  maxScore: number;
  label: string;
}) {
  const pct = (score / maxScore) * 100;
  const color =
    pct >= 80
      ? "text-green-400 border-green-500/30 bg-green-500/10"
      : pct >= 60
        ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
        : "text-red-400 border-red-500/30 bg-red-500/10";

  const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className={`border p-4 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
          {source}
        </span>
        <span className="text-2xl font-display font-bold leading-none">{score}</span>
      </div>
      <div className="w-full h-1.5 bg-white/10 mb-1.5 overflow-hidden">
        <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] opacity-60">{label}</p>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="text-text-muted text-xs w-[90px] flex-shrink-0">{label}</span>
      <span className="text-text-primary text-xs">{value}</span>
    </div>
  );
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? "text-yellow-400 fill-yellow-400" : "text-white/10"}
        />
      ))}
    </div>
  );
}

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: game, isLoading, error } = useGameDetail(id!);


  const addItem = useCartStore((s) => s.addItem);
  const [activeMedia, setActiveMedia] = useState(0);
  const [showMinReq, setShowMinReq] = useState(false);
  const [added, setAdded] = useState(false);
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const [showReviews, setShowReviews] = useState(true);
  const [newReviews, setNewReviews] = useState<GameReview[]>([]);
  const [editionId, setEditionId] = useState<string | null>(null);
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyCTA(window.scrollY > window.innerHeight * 0.6);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  usePageMeta(game?.name, game ? `Mua ${game.name} cho Xbox giá rẻ hơn Store tại Moxic GameStore.` : null);

  // "Đã xem gần đây"
  useEffect(() => {
    if (game?.id) recentlyViewed.push(game.id);
  }, [game?.id]);

  if (isLoading) return <PageLoader />;

  if (error || !game) {
    return (
      <Container className="mt-12 text-center py-16">
        <p className="text-danger mb-4">Không thể tải dữ liệu</p>
        <Link to="/games" className="text-accent hover:text-accent-hover text-sm">Quay lại</Link>
      </Container>
    );
  }

  const editions = game.editions ?? [];
  const edition = editions.find((e) => e.id === editionId) ?? editions.find((e) => e.isDefault) ?? editions[0] ?? null;
  const price = edition?.salePrice ?? game.salePrice;
  const original = edition?.originalPrice ?? game.originalPrice;
  const isPreorder = game.status === "Preorder";
  const discount = original > 0 && price > 0
    ? Math.round((1 - price / original) * 100) : 0;
  const primaryImage = game.media[activeMedia]?.presignedUrl || game.media[0]?.presignedUrl;
  const backgroundHeroImage = game.media[0]?.presignedUrl;
  const days = game.releaseDate ? daysUntil(game.releaseDate) : 0;
  const req = game.systemRequirements;
  const activeReq = showMinReq ? req.minimum : req.recommended;

  const handleAddToCart = () => {
    toast.success(edition ? `Đã thêm bản ${edition.name} vào giỏ hàng!` : "Đã thêm vào giỏ hàng!", { duration: 3000 });
    addItem({
      gameId: game.id,
      name: edition ? game.name + " — " + edition.name : game.name,
      editionId: edition?.id ?? null,
      editionName: edition?.name ?? null,
      coverImageUrl: game.media[0]?.presignedUrl || "",
      price: price,
      originalPrice: original,
      status: game.status,
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setTimeout(() => navigate("/cart"), 300);
  };

  const prevMedia = () => setActiveMedia((p) => (p === 0 ? game.media.length - 1 : p - 1));
  const nextMedia = () => setActiveMedia((p) => (p === game.media.length - 1 ? 0 : p + 1));

  const formatCount = (n: number): string => {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",") + "K";
    return n.toLocaleString("vi-VN");
  };

  return (
    <div>
      {/* ─── HERO BACKGROUND ─── */}
      <div className="relative w-full h-[300px] md:h-[500px]">
        <img src={backgroundHeroImage} alt={game.name} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent" />
      </div>

      <Container className="-mt-32 md:-mt-48 relative z-10">
        {/* ─── TITLE + PRICE ─── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-5xl text-text-primary mb-3">{game.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={isPreorder ? "preorder" : "available"}>
                {isPreorder ? "Sắp ra mắt" : "Sẵn có"}
              </Badge>
              <span className="text-xs text-text-muted bg-bg-surface px-2 py-1">{game.genres?.map(g => g.name).join(", ") || "—"}</span>
              {discount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-xs line-through">{formatPrice(original)}</span>
                  <Badge variant="discount">-{discount}%</Badge>
                </div>
              )}
              {game.purchaseCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-accent bg-accent/10 px-2 py-1">
                  <Flame className="w-3.5 h-3.5" />
                  {formatCount(game.purchaseCount)} người đã mua
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-display text-3xl md:text-4xl text-accent">
              {isPreorder ? formatPrice(price) : price > 0 ? formatPrice(price) : "Liên hệ"}
            </p>
            <Button variant="ghost" onClick={handleAddToCart}>
              {added ? "Đã thêm" : "Thêm vào giỏ"}
            </Button>
            <Button variant="primary" className="text-base whitespace-nowrap" onClick={handleBuyNow}>
              {isPreorder ? "Đặt trước" : "Mua ngay"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* ─── LEFT COL ─── */}
          <div className="flex-1 min-w-0">
            {/* Gallery */}
            {game.media.length > 0 && (
              <div className="mb-8">
                <div className="relative w-full aspect-video bg-bg-surface overflow-hidden mb-3 group">
                  {game.media[activeMedia]?.presignedUrl?.includes('.mp4') ? (
                    <video
                      key={game.media[activeMedia].presignedUrl}
                      src={game.media[activeMedia].presignedUrl}
                      autoPlay muted loop playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={primaryImage}
                      alt={`${game.name} media ${activeMedia + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {game.media.length > 1 && (
                    <>
                      <button onClick={prevMedia} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                      <button onClick={nextMedia} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </>
                  )}
                  <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1">
                    {activeMedia + 1} / {game.media.length}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {game.media.map((m, i) => {
                    const isVideo = m.presignedUrl?.includes('.mp4');
                    return (
                      <button
                        key={m.id}
                        onClick={() => setActiveMedia(i)}
                        className={`flex-shrink-0 w-[100px] md:w-[120px] aspect-video overflow-hidden border-2 transition-all duration-200 cursor-pointer relative ${
                          i === activeMedia ? "border-accent brightness-100" : "border-transparent brightness-50 hover:brightness-75"
                        }`}
                      >
                        {isVideo ? (
                          <div className="w-full h-full relative bg-black flex items-center justify-center">
                            <video src={m.presignedUrl} className="w-full h-full object-cover" muted playsInline />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <span className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-white text-xs font-bold">▶</span>
                            </div>
                          </div>
                        ) : (
                          <img src={m.presignedUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-8" id="mo-ta">
              <h2 className="font-display text-xl text-text-primary mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-accent" /> Mô tả
              </h2>
              <div className="text-text-secondary text-sm leading-relaxed whitespace-pre-line bg-bg-surface border border-border p-5">
                {game.description}
              </div>
            </div>

            {/* System Requirements */}
            <div className="mb-8" id="cau-hinh">
              <h2 className="font-display text-xl text-text-primary mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-accent" /> Cấu hình yêu cầu
              </h2>
              <div className="bg-bg-surface border border-border overflow-hidden">
                <div className="flex border-b border-border">
                  <button
                    onClick={() => setShowMinReq(false)}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors cursor-pointer ${!showMinReq
                      ? "text-text-primary border-b-2 border-accent bg-accent/5"
                      : "text-text-muted hover:text-text-secondary"
                    }`}
                  >Khuyến nghị</button>
                  <button
                    onClick={() => setShowMinReq(true)}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors cursor-pointer ${showMinReq
                      ? "text-text-primary border-b-2 border-accent bg-accent/5"
                      : "text-text-muted hover:text-text-secondary"
                    }`}
                  >Tối thiểu</button>
                </div>
                <div className="p-5">
                  <SpecRow label="Hệ điều hành" value={activeReq.os} />
                  <SpecRow label="CPU" value={activeReq.processor} />
                  <SpecRow label="RAM" value={activeReq.memory} />
                  <SpecRow label="GPU" value={activeReq.graphics} />
                  <SpecRow label="Lưu trữ" value={activeReq.storage} />
                </div>
              </div>
            </div>

            {/* Ratings */}
            {game.ratings.length > 0 && (
              <div className="mb-8" id="danh-gia">
                <h2 className="font-display text-xl text-text-primary mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-accent" /> Đánh giá
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {game.ratings.map((r) => <RatingCard key={r.source} {...r} />)}
                </div>
              </div>
            )}

            {/* Store Reviews - collapsible */}
            {/* Store Reviews - collapsible */}
            <div className="mb-8" id="nhan-xet">
              {/* Clickable header toggle */}
              {(game.reviews.length > 0 || newReviews.length > 0) && (
                <button
                  onClick={() => setShowReviews(!showReviews)}
                  className="w-full flex items-center justify-between mb-5 cursor-pointer group"
                  aria-expanded={showReviews}
                  aria-controls="reviews-content"
                >
                  <h2 className="font-display text-xl text-text-primary flex items-center gap-2 group-hover:text-accent transition-colors">
                    <MessageCircle className="w-5 h-5 text-accent" /> Đánh giá từ khách hàng
                  </h2>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-1.5 bg-bg-surface border border-border px-2.5 py-1.5 md:px-3 md:py-1.5">
                      <StarRating rating={Math.round(game.storeRating)} size={10} />
                      <span className="font-display text-base md:text-lg text-yellow-400 font-bold">{game.storeRating}</span>
                      <span className="text-text-muted text-[10px] md:text-xs">/ 5</span>
                    </div>
                    <div className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center bg-bg-surface border border-border text-text-muted group-hover:text-text-primary transition-colors">
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${showReviews ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>
                </button>
              )}

              {/* Collapsible content */}
              {(game.reviews.length > 0 || newReviews.length > 0) && (
                <div
                  id="reviews-content"
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    showReviews ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="space-y-3">
                    {[...newReviews, ...game.reviews.filter((r) => !newReviews.some((n) => n.id === r.id))].map((review) => (
                      <div key={review.id} className="bg-bg-surface border border-border p-3 md:p-4">
                        <div className="flex items-start gap-2.5 md:gap-3">
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-bg-elevated flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {review.avatarUrl ? (
                              <img src={review.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-text-muted" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-semibold text-text-primary">{review.userName}</span>
                              {review.isVerifiedPurchase && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                                  <BadgeCheck className="w-3 h-3" /> Đã mua
                                </span>
                              )}
                              <StarRating rating={review.rating} size={10} />
                              <span className="text-[10px] md:text-[11px] text-text-muted ml-auto flex-shrink-0 whitespace-nowrap">{timeAgo(review.createdAt)}</span>
                            </div>
                            <p className="text-sm text-text-secondary leading-relaxed break-words">{review.content}</p>
                            {!review.isMine && (
                              <div className="flex justify-end -mb-1">
                                <ReportButton targetType="Review" targetId={review.id} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review form */}
              <ReviewForm gameId={game.id} onReviewAdded={(r) => setNewReviews((prev) => [r, ...prev.filter((x) => x.id !== r.id)])} />
            </div>

          </div>
          {/* ─── RIGHT COL ─── */}
          <div className="w-full lg:w-[340px] flex-shrink-0 space-y-4">
            {/* Price card */}
            <div className="bg-bg-surface border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-muted text-xs uppercase tracking-wider">Giá bán</span>
                {discount > 0 && <Badge variant="discount">-{discount}%</Badge>}
              </div>
              {game.saleEndsAt && (
                <div className="mb-4 -mx-5 px-5 py-2.5 bg-gradient-to-r from-rose-500/15 to-orange-500/10 border-y border-rose-500/30">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-orange-300 mb-1.5">⚡ Flash Sale</p>
                  <SaleCountdown endsAt={game.saleEndsAt} />
                </div>
              )}
              {editions.length > 1 && (
                <div className="mb-4 space-y-2" role="radiogroup" aria-label="Chọn phiên bản">
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">Chọn phiên bản</p>
                  {editions.map((ed) => {
                    const active = ed.id === edition?.id;
                    const off = ed.originalPrice > ed.salePrice && ed.originalPrice > 0 ? Math.round((1 - ed.salePrice / ed.originalPrice) * 100) : 0;
                    return (
                      <button
                        key={ed.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setEditionId(ed.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border text-left transition-colors cursor-pointer ${
                          active ? "border-accent bg-accent/10" : "border-border hover:border-white/30"
                        }`}
                      >
                        <span className={`w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center ${active ? "border-accent" : "border-white/30"}`}>
                          {active && <span className="w-2 h-2 rounded-full bg-accent" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-semibold truncate ${active ? "text-white" : "text-text-secondary"}`}>{ed.name}</span>
                          {ed.includes.length > 0 && <span className="block text-[11px] text-text-muted truncate">{ed.includes.length} nội dung</span>}
                        </span>
                        <span className="text-right shrink-0">
                          {off > 0 && <span className="block text-[10px] font-bold text-discount">-{off}%</span>}
                          <span className={`text-sm font-bold ${active ? "text-accent" : "text-text-primary"}`}>{formatPrice(ed.salePrice)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex items-baseline gap-3 mb-4">
                {original > 0 && price > 0 && (
                  <span className="text-text-muted text-lg line-through">{formatPrice(original)}</span>
                )}
                <span className="font-display text-3xl text-accent">
                  {isPreorder ? formatPrice(price) : price > 0 ? formatPrice(price) : "Liên hệ"}
                </span>
              </div>
              {isPreorder && game.releaseDate && (
                <div className="mb-4">
                  <p className="text-text-secondary text-sm">
                    {days > 0 ? `Còn ${days} ngày đến ngày phát hành` : `Phát hành: ${formatDate(game.releaseDate)}`}
                  </p>
                  <p className="text-text-muted text-xs mt-1">Game sẽ được cài đặt vào tài khoản Xbox của bạn đúng ngày phát hành.</p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button variant="primary" className="w-full text-base" onClick={handleBuyNow}>
                  {isPreorder ? "Đặt trước ngay" : "Mua ngay"}
                </Button>
                <button
                  onClick={handleAddToCart}
                  className="w-full py-2.5 border border-border text-text-secondary text-sm hover:bg-bg-surface-hover transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {added ? (
                    <><Check className="w-4 h-4 text-success" /> Đã thêm vào giỏ</>
                  ) : (
                    <><ShoppingCart className="w-4 h-4" /> Thêm vào giỏ hàng</>
                  )}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <WishlistButton gameId={game.id} gameName={game.name} variant="full" className="w-full !h-10" />
                  <CompareButton gameId={game.id} gameName={game.name} className="w-full" />
                </div>
                <ShareButton path={`/games/${game.id}`} title={`${game.name} — giá rẻ tại Moxic GameStore`} text={`Mua ${game.name} cho Xbox giá rẻ hơn Store`} />
                {game.xboxProductId && (
                  <a
                    href={`https://www.xbox.com/vi-VN/games/store/x/${game.xboxProductId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center text-xs text-text-muted hover:text-accent underline underline-offset-4 pt-1"
                  >
                    So giá trên Xbox Store chính hãng ↗
                  </a>
                )}
              </div>            </div>

            <RentPanel gameId={game.id} gameName={game.name} buyPrice={price} />

            {/* Game info */}
            <div className="bg-bg-surface border border-border p-5 space-y-3">
              <h3 className="font-display text-sm text-text-primary uppercase tracking-wider">Thông tin game</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-muted">Thể loại</span>
                  <span className="text-text-primary">{game.genres?.map(g => g.name).join(", ") || "—"}</span>
                </div>
                {game.productType && game.productType !== "Game" && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Loại</span>
                    <span className="text-text-primary">{PRODUCT_TYPE_LABELS[game.productType] ?? game.productType}</span>
                  </div>
                )}
                {game.publisher && (
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">Nhà phát hành</span>
                    <Link to={`/games?publisher=${encodeURIComponent(game.publisher)}`} className="text-text-primary text-right hover:text-accent">
                      {game.publisher}
                    </Link>
                  </div>
                )}
                {game.developer && (
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">Nhà phát triển</span>
                    <span className="text-text-primary text-right">{game.developer}</span>
                  </div>
                )}
                {game.region && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Region</span>
                    <span className="text-text-primary">{game.region}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-muted">Trạng thái</span>
                  <span className="text-text-primary">{isPreorder ? "Sắp ra mắt" : "Sẵn có"}</span>
                </div>
                {game.releaseDate && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">Phát hành</span>
                    <span className="text-text-primary">{formatDate(game.releaseDate)}</span>
                  </div>
                )}
                {game.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {game.tags.map((t) => (
                      <span key={t.id} className="text-[11px] bg-bg-elevated text-text-muted px-2 py-0.5">{t.name}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Purchase guide */}
            <div className="bg-bg-surface border border-border p-5">
              <h3 className="font-display text-sm text-text-primary uppercase tracking-wider mb-4">Cách mua hàng</h3>
              <div className="space-y-4">
                {[
                  { icon: ShoppingCart, step: "Chọn game", desc: "Thêm vào giỏ hàng" },
                  { icon: CreditCard, step: "Thanh toán", desc: "QR + cung cấp tài khoản Xbox" },
                  { icon: Gamepad2, step: "Cài đặt", desc: "Nhân viên cài đặt trong 15-30 phút" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-text-primary font-semibold">{item.step}</p>
                      <p className="text-xs text-text-muted">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <PriceHistory gameId={game.id} />

        <GameDiscussion gameId={game.id} />

        {/* ─── EDITION COMPARISON ─── */}
        {editions.length > 1 && <EditionCompare editions={editions} selectedId={edition?.id ?? null} onSelect={setEditionId} />}

        <div className="mt-12">
          <GamePageRails gameId={game.id} />
        </div>

        <div className="mt-12 mb-8">
          <RecentlyViewed excludeId={game.id} />
        </div>

        {/* ─── BACK LINK ─── */}
        <div className="pb-12">
          <Link to="/games" className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Quay lại cửa hàng
          </Link>
        </div>
      </Container>

      {/* Sticky bottom CTA - mobile only */}
      {showStickyCTA && (
        <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-bg-surface/95 backdrop-blur-md border-t border-border p-3 pb-[calc(0.75rem+var(--sab))] flex items-center gap-3 shadow-2xl animate-slide-up">
          <div className="flex-1 min-w-0">
            <p className="font-display text-lg text-accent">
              {isPreorder ? formatPrice(price) : price > 0 ? formatPrice(price) : "Liên hệ"}
            </p>
            {original > 0 && price > 0 && (
              <p className="text-text-muted text-xs line-through">{formatPrice(original)}</p>
            )}
          </div>
          <button
            onClick={handleBuyNow}
            className="bg-accent hover:bg-accent-hover text-white px-6 py-3 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            {isPreorder ? "Đặt trước" : "Mua ngay"}
          </button>
          <button
            onClick={handleAddToCart}
            className="w-11 h-11 bg-accent/20 hover:bg-accent/30 flex items-center justify-center cursor-pointer"
            aria-label="Thêm vào giỏ hàng"
          >
            <ShoppingCart className="w-5 h-5 text-accent" />
          </button>
        </div>
      )}
    </div>
  );
}
