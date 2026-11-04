import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import { disablePush, enablePush, getPushState, isIos, isStandalone } from "../../lib/pwa";

/** "Thông báo trên thiết bị này" switch (Web Push). Compact variant for the bell dropdown. */
export default function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<"loading" | "unsupported" | "denied" | "on" | "off">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState("unsupported"));
  }, []);

  if (state === "loading") return null;
  if (state === "unsupported") {
    if (compact) return null;
    return (
      <p className="text-xs text-text-muted">
        {isIos() && !isStandalone() ? "Trên iPhone: thêm Moxic vào màn hình chính rồi mở từ đó để bật thông báo." : "Trình duyệt này chưa hỗ trợ thông báo đẩy."}
      </p>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      if (state === "on") {
        await disablePush();
        setState("off");
        toast.success("Đã tắt thông báo trên thiết bị này");
      } else {
        const r = await enablePush();
        setState(r === "on" ? "on" : r === "denied" ? "denied" : "unsupported");
        if (r === "on") toast.success("Đã bật thông báo — bạn sẽ nhận tin đơn hàng, giảm giá ngay cả khi đóng web");
        else if (r === "denied") toast.error("Bạn đã chặn thông báo. Mở cài đặt trình duyệt để cho phép lại.");
      }
    } catch {
      toast.error("Không bật được thông báo, thử lại sau");
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    if (state === "on") return null;
    return (
      <button type="button" onClick={toggle} disabled={busy || state === "denied"} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-accent hover:bg-white/[0.04] border-t border-white/5 disabled:text-text-muted cursor-pointer">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
        {state === "denied" ? "Thông báo đang bị chặn trong trình duyệt" : "Bật thông báo trên thiết bị này"}
      </button>
    );
  }

  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="flex items-center gap-2 text-sm">
        {state === "on" ? <BellRing className="w-4 h-4 text-accent" /> : <BellOff className="w-4 h-4 text-text-muted" />}
        Thông báo đẩy trên thiết bị này
        {state === "denied" && <span className="text-xs text-rose-300">(đang bị chặn)</span>}
      </span>
      <input type="checkbox" className="sr-only peer" checked={state === "on"} disabled={busy || state === "denied"} onChange={toggle} />
      <span className="relative shrink-0 w-9 h-5 bg-white/10 transition-colors peer-checked:bg-accent after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  );
}
