
import { t, locale } from "./i18n";

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN").format(price) + t("đ");
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return t("Vài giây trước");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("{0} phút trước", [minutes]);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{0} giờ trước", [hours]);
  const days = Math.floor(hours / 24);
  if (days < 7) return t("{0} ngày trước", [days]);
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return t("{0} tuần trước", [weeks]);
  const months = Math.floor(days / 30);
  return t("{0} tháng trước", [months]);
}
