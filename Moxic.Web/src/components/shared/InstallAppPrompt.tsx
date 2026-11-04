import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { isIos, isStandalone, promptInstall, useCanInstall } from "../../lib/pwa";

const KEY = "moxic.installPrompt";
const SNOOZE_DAYS = 14;
const QUIET = ["/checkout", "/confirmation", "/login", "/register", "/verify-email"];

function snoozed() {
  try {
    const v = Number(localStorage.getItem(KEY) || 0);
    return Date.now() - v < SNOOZE_DAYS * 86_400_000;
  } catch {
    return true;
  }
}

/** Mobile-first "Cài app Moxic" banner: native prompt on Android/Chrome, how-to sheet on iOS Safari. */
export default function InstallAppPrompt() {
  const canInstall = useCanInstall();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const ios = isIos();

  useEffect(() => {
    if (isStandalone() || snoozed()) return;
    if (!canInstall && !ios) return;
    const t = window.setTimeout(() => setVisible(true), 25_000); // let people browse first
    return () => window.clearTimeout(t);
  }, [canInstall, ios]);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
    setIosHelp(false);
  };

  if (!visible || QUIET.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="fixed inset-x-2 bottom-[calc(0.5rem+var(--sab))] sm:left-auto sm:right-4 sm:bottom-4 sm:w-[380px] z-[45] animate-[popIn_0.35s_ease-out]">
      <div className="relative bg-bg-surface/95 backdrop-blur-md border border-accent/30 shadow-2xl shadow-black/60 p-4">
        <button type="button" onClick={dismiss} aria-label="Đóng" className="absolute top-2 right-2 p-1 text-text-muted hover:text-white cursor-pointer">
          <X className="w-4 h-4" />
        </button>
        {!iosHelp ? (
          <div className="flex items-center gap-3 pr-5">
            <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold leading-tight">Cài app Moxic</p>
              <p className="text-xs text-text-muted">Mở nhanh từ màn hình chính, nhận thông báo flash sale & đơn hàng.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (ios) {
                  setIosHelp(true);
                  return;
                }
                const ok = await promptInstall();
                if (ok) setVisible(false);
                else dismiss();
              }}
              className="h-10 px-3 shrink-0 inline-flex items-center gap-1.5 bg-accent text-bg-base text-sm font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" /> Cài
            </button>
          </div>
        ) : (
          <div className="pr-5 space-y-2 text-sm">
            <p className="font-display font-bold">Thêm Moxic vào màn hình chính</p>
            <p className="flex items-center gap-2 text-text-secondary">
              1. Nhấn <Share className="w-4 h-4 text-sky-400" /> <b>Chia sẻ</b> ở thanh dưới Safari
            </p>
            <p className="flex items-center gap-2 text-text-secondary">
              2. Chọn <SquarePlus className="w-4 h-4" /> <b>Thêm vào MH chính</b>
            </p>
            <p className="text-xs text-text-muted">Mở app từ màn hình chính để bật thông báo trên iPhone.</p>
          </div>
        )}
      </div>
    </div>
  );
}
