import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import DragonBorder from "./DragonBorder";
import Footer from "./Footer";
import FloatingContact from "./FloatingContact";
import AnnouncementModal from "../shared/AnnouncementModal";
import PurchaseToast from "../shared/PurchaseToast";
import { CompareBar } from "../games/Compare";
import ReferralCapture from "../shared/ReferralCapture";
import InstallAppPrompt from "../shared/InstallAppPrompt";


export default function AppLayout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col relative overflow-hidden">
      <DragonBorder />
      <Navbar />
      <main className="flex-1 relative z-10 w-full overflow-x-hidden">
        {/* Keyed by path so each page fades in; query-string changes (filters) don't re-animate. */}
        <div key={pathname} className="motion-safe:animate-[pageIn_0.28s_ease-out]">
          <Outlet />
        </div>
      </main>
      <Footer />
      <FloatingContact />
      <AnnouncementModal />
      <PurchaseToast />
      <CompareBar />
      <ReferralCapture />
      <InstallAppPrompt />
    </div>
  );
}
