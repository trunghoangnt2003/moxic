import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useGameDetail } from "../hooks/useGames";
import Container from "../components/layout/Container";
import Button from "../components/shared/Button";
import Badge from "../components/shared/Badge";
import GameCard from "../components/games/GameCard";
import { HeroSkeleton } from "../components/shared/Skeleton";
import { formatPrice, formatDate, daysUntil } from "../lib/utils";
import { useCartStore } from "../lib/cartStore";
import { useNavigate } from "react-router-dom";
import { seedGames } from "../lib/seedData";
import {
  ShoppingCart,
  CreditCard,
  Gamepad2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Star,
  Info,
  Monitor,
  Check,
} from "lucide-react";

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
    <div className={` border p-4 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
          {source}
        </span>
        <span className="text-2xl font-display font-bold leading-none">{score}</span>
      </div>
      <div className="w-full h-1.5  bg-white/10 mb-1.5 overflow-hidden">
        <div className={`h-full  transition-all ${barColor}`} style={{ width: `${pct}%` }} />
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

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: game, isLoading, error } = useGameDetail(id!);
  const addItem = useCartStore((s) => s.addItem);
  const [activeMedia, setActiveMedia] = useState(0);
  const [showMinReq, setShowMinReq] = useState(false);
  const [added, setAdded] = useState(false);

  if (isLoading) return <HeroSkeleton />;

  if (error || !game) {
    return (
      <Container className="mt-12 text-center py-16">
        <p className="text-danger mb-4">Không thể tải dữ liệu</p>
        <Link to="/games" className="text-accent hover:text-accent-hover text-sm">Quay lại</Link>
      </Container>
    );
  }

  const isPreorder = game.status === "Preorder";
  const discount = game.originalPrice > 0 && game.salePrice > 0
    ? Math.round((1 - game.salePrice / game.originalPrice) * 100) : 0;
  const primaryImage = game.media[activeMedia]?.presignedUrl || game.media[0]?.presignedUrl;
  const backgroundHeroImage = game.media[0]?.presignedUrl;
  const days = game.releaseDate ? daysUntil(game.releaseDate) : 0;
  const req = game.systemRequirements;
  const activeReq = showMinReq ? req.minimum : req.recommended;

  const relatedGames = seedGames.filter((g) => game.relatedGameIds.includes(g.id));

  const handleAddToCart = () => {
    addItem({
      gameId: game.id,
      name: game.name,
      coverImageUrl: game.media[0]?.presignedUrl || "",
      price: isPreorder ? game.originalPrice : game.salePrice,
      originalPrice: game.originalPrice,
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

  return (
    <div>
      {/* ═══ HERO BACKGROUND ═══ */}
      <div className="relative w-full h-[300px] md:h-[500px]">
        <img src={backgroundHeroImage} alt={game.name} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/80 to-transparent" />
      </div>

      <Container className="-mt-32 md:-mt-48 relative z-10">
        {/* ═══ TITLE + PRICE ═══ */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-5xl text-text-primary mb-3">{game.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={isPreorder ? "preorder" : "available"}>
                {isPreorder ? "Sắp ra mắt" : "Sẵn có"}
              </Badge>
              <span className="text-xs text-text-muted bg-bg-surface px-2 py-1 ">{game.genre}</span>
              {discount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-text-muted text-xs line-through">{formatPrice(game.originalPrice)}</span>
                  <Badge variant="discount">-{discount}%</Badge>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-display text-3xl md:text-4xl text-accent">
              {isPreorder ? formatPrice(game.originalPrice) : game.salePrice > 0 ? formatPrice(game.salePrice) : "Liên hệ"}
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
          {/* ═══ LEFT COL ═══ */}
          <div className="flex-1 min-w-0">
            {/* Gallery */}
            {game.media.length > 0 && (
              <div className="mb-8">
                <div className="relative w-full aspect-video bg-bg-surface  overflow-hidden mb-3 group">
                  <img src={primaryImage} alt={`${game.name} screenshot ${activeMedia + 1}`} className="w-full h-full object-cover" />
                  {game.media.length > 1 && (
                    <>
                      <button onClick={prevMedia} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9  bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                      <button onClick={nextMedia} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9  bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </>
                  )}
                  <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 ">
                    {activeMedia + 1} / {game.media.length}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {game.media.map((m, i) => (
                    <button key={m.id} onClick={() => setActiveMedia(i)}
                      className={`flex-shrink-0 w-[100px] md:w-[120px] aspect-video  overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                        i === activeMedia ? "border-accent brightness-100" : "border-transparent brightness-50 hover:brightness-75"
                      }`}
                    >
                      <img src={m.presignedUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-8" id="mo-ta">
              <h2 className="font-display text-xl text-text-primary mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-accent" /> Mô tả
              </h2>
              <div className="text-text-secondary text-sm leading-relaxed whitespace-pre-line bg-bg-surface border border-border  p-5">
                {game.description}
              </div>
            </div>

            {/* System Requirements */}
            <div className="mb-8" id="cau-hinh">
              <h2 className="font-display text-xl text-text-primary mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-accent" /> Cấu hình yêu cầu
              </h2>
              <div className="bg-bg-surface border border-border  overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-border">
                  <button
                    onClick={() => setShowMinReq(false)}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                      !showMinReq
                        ? "text-text-primary border-b-2 border-accent bg-accent/5"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    Khuyến nghị
                  </button>
                  <button
                    onClick={() => setShowMinReq(true)}
                    className={`flex-1 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                      showMinReq
                        ? "text-text-primary border-b-2 border-accent bg-accent/5"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    Tối thiểu
                  </button>
                </div>
                {/* Specs */}
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
          </div>

          {/* ═══ RIGHT COL ═══ */}
          <div className="w-full lg:w-[340px] flex-shrink-0 space-y-4">
            {/* Price card */}
            <div className="bg-bg-surface border border-border  p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-muted text-xs uppercase tracking-wider">Giá bán</span>
                {discount > 0 && <Badge variant="discount">-{discount}%</Badge>}
              </div>
              <div className="flex items-baseline gap-3 mb-4">
                {game.originalPrice > 0 && game.salePrice > 0 && (
                  <span className="text-text-muted text-lg line-through">{formatPrice(game.originalPrice)}</span>
                )}
                <span className="font-display text-3xl text-accent">
                  {isPreorder ? formatPrice(game.originalPrice) : game.salePrice > 0 ? formatPrice(game.salePrice) : "Liên hệ"}
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
                  className="w-full py-2.5  border border-border text-text-secondary text-sm hover:bg-bg-surface-hover transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {added ? (
                    <><Check className="w-4 h-4 text-success" /> Đã thêm vào giỏ</>
                  ) : (
                    <><ShoppingCart className="w-4 h-4" /> Thêm vào giỏ hàng</>
                  )}
                </button>
              </div>
            </div>

            {/* Game info */}
            <div className="bg-bg-surface border border-border  p-5 space-y-3">
              <h3 className="font-display text-sm text-text-primary uppercase tracking-wider">Thông tin game</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-muted">Thể loại</span>
                  <span className="text-text-primary">{game.genre}</span>
                </div>
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
                {game.tags && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {game.tags.split(",").map((t) => (
                      <span key={t} className="text-[11px] bg-bg-elevated text-text-muted px-2 py-0.5 ">{t.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Purchase guide */}
            <div className="bg-bg-surface border border-border  p-5">
              <h3 className="font-display text-sm text-text-primary uppercase tracking-wider mb-4">Cách mua hàng</h3>
              <div className="space-y-4">
                {[
                  { icon: ShoppingCart, step: "Chọn game", desc: "Thêm vào giỏ hàng" },
                  { icon: CreditCard, step: "Thanh toán", desc: "QR + cung cấp tài khoản Xbox" },
                  { icon: Gamepad2, step: "Cài đặt", desc: "Nhân viên cài đặt trong 15-30 phút" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8  bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
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

        {/* ═══ RELATED GAMES ═══ */}
        {relatedGames.length > 0 && (
          <div className="mt-12 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl text-text-primary flex items-center gap-2">
                <Star className="w-5 h-5 text-accent" /> Game liên quan
              </h2>
              <Link to="/games" className="text-accent hover:text-accent-hover text-sm flex items-center gap-1 transition-colors">
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {relatedGames.map((g) => (
                <GameCard key={g.id} game={g} variant="vertical" />
              ))}
            </div>
          </div>
        )}

        {/* ═══ BACK LINK ═══ */}
        <div className="pb-12">
          <Link to="/games" className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Quay lại cửa hàng
          </Link>
        </div>
      </Container>
    </div>
  );
}

