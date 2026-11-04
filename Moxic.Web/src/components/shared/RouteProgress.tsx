import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavPending } from "../../lib/navPending";
import MoxicWave from "./MoxicWave";

import { t } from "../../lib/i18n";
/** Shows the MOXIC wave + a top progress bar while a page change is waiting on its code/data. */
export default function RouteProgress() {
  const { pathname } = useLocation(); // the location actually rendered
  const target = useNavPending((s) => s.target);
  const clear = useNavPending((s) => s.clear);
  const [visible, setVisible] = useState(false);

  // Done as soon as the new page is on screen.
  useEffect(() => {
    if (target && target === pathname) clear();
  }, [pathname, target, clear]);

  // Only show for slow changes (no flash on instant ones); never hang forever.
  useEffect(() => {
    if (!target) {
      setVisible(false);
      return;
    }
    const show = window.setTimeout(() => setVisible(true), 120);
    const giveUp = window.setTimeout(clear, 15_000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(giveUp);
    };
  }, [target, clear]);

  if (!target || !visible) return null;
  return (
    <>
      <div className="fixed top-[var(--sat)] inset-x-0 z-[120] h-[3px] overflow-hidden pointer-events-none">
        <div className="h-full w-full origin-left bg-gradient-to-r from-transparent via-accent to-highlight" style={{ animation: "route-progress 1.1s ease-in-out infinite" }} />
      </div>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-bg-base/55 backdrop-blur-[3px] animate-[fadeIn_0.2s_ease-out] pointer-events-none">
        <MoxicWave width={240} label={t("Đang mở trang")} />
      </div>
    </>
  );
}
