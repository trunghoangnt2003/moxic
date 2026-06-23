import Badge from '../components/shared/Badge';
import { useParams, Link } from "react-router-dom";
import { useGameDetail } from "../hooks/useGames";
import Container from "../components/layout/Container";

import Button from "../components/shared/Button";
import { HeroSkeleton } from "../components/shared/Skeleton";
import { formatPrice, formatDate, daysUntil } from "../lib/utils";
import { ShoppingCart, CreditCard, Gamepad2, ArrowRight } from "lucide-react";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: game, isLoading, error } = useGameDetail(id!);

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
  const discount = Math.round((1 - game.salePrice / game.originalPrice) * 100);
  const primaryImage = game.media.find((m) => m.isPrimary)?.presignedUrl || game.media[0]?.presignedUrl;
  const days = game.releaseDate ? daysUntil(game.releaseDate) : 0;

  return (
    <div>
      {/* Hero */}
      <div className="relative w-full h-[400px] md:h-[500px]">
        {primaryImage && (
          <img src={primaryImage} alt={game.name} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent" />
      </div>

      <Container className="-mt-32 relative z-10">
        {/* Title + Price */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl text-text-primary mb-2">{game.name}</h1>
            <div className="flex items-center gap-3">
              <Badge variant={isPreorder ? "preorder" : "available"}>
                {isPreorder ? "Sắp ra mắt" : "Sẵn có"}
              </Badge>
              <span className="text-xs text-text-muted bg-bg-surface px-2 py-1 rounded-sm">{game.genre}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3">
              {discount > 0 && (
                <>
                  <span className="text-text-muted text-sm line-through">{String(formatPrice(game.originalPrice))}</span>
                  <Badge variant="discount">-{discount}%</Badge>
                </>
              )}
            </div>
            <p className="font-display text-3xl text-accent mt-1">{String(formatPrice(game.salePrice))}</p>
          </div>
        </div>

        {/* Description */}
        <div className="max-w-3xl mb-8">
          <h2 className="font-display text-xl text-text-primary mb-3">Mô tả</h2>
          <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">{game.description}</p>
        </div>

        {/* Media Gallery */}
        {game.media.length > 1 && (
          <div className="mb-8">
            <h2 className="font-display text-xl text-text-primary mb-3">Thư viện ảnh</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {game.media.map((m) => (
                <img
                  key={m.id}
                  src={m.presignedUrl || "/placeholder.svg"}
                  alt=""
                  className="w-full aspect-video object-cover rounded-sm cursor-pointer hover:opacity-90 transition-opacity"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        )}

        {/* Purchase Guide */}
        <div className="bg-bg-surface border border-border rounded-sm p-6 mb-8">
          <h2 className="font-display text-xl text-text-primary mb-6">Cách mua hàng</h2>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-0">
            {[
              { icon: ShoppingCart, step: "Bước 1", text: "Chọn game" },
              { icon: CreditCard, step: "Bước 2", text: "Thanh toán & cung cấp tài khoản Xbox" },
              { icon: Gamepad2, step: "Bước 3", text: "Nhân viên cài đặt trong 15-30 phút" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">{item.step}</p>
                    <p className="text-sm text-text-primary">{item.text}</p>
                  </div>
                </div>
                {i < 2 && <ArrowRight className="w-5 h-5 text-text-muted mx-2 hidden md:block" />}
              </div>
            ))}
          </div>
        </div>

        {/* Preorder / Buy CTA */}
        <div className="mb-12">
          {isPreorder ? (
            <div className="bg-preorder/10 border border-preorder/30 rounded-sm p-6">
              <h3 className="font-display text-lg text-text-primary mb-2">Đặt trước ngay</h3>
              {game.releaseDate && (
                <p className="text-text-secondary text-sm mb-1">
                  {days > 0
                    ? `Còn ${days} ngày đến ngày phát hành`
                    : `Phát hành: ${formatDate(game.releaseDate)}`}
                </p>
              )}
              <p className="text-text-muted text-xs mb-4">
                Game sẽ được cài đặt vào tài khoản của bạn đúng ngày phát hành {game.releaseDate ? formatDate(game.releaseDate) : ""}
              </p>
              <Button variant="primary">Đặt trước</Button>
            </div>
          ) : (
            <Button variant="primary" className="text-base">
              Mua ngay
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
}


