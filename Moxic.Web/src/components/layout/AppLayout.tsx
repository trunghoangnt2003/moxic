import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import DragonBorder from "./DragonBorder";
import Footer from "./Footer";
import FloatingContact from "./FloatingContact";
import AnnouncementModal from "../shared/AnnouncementModal";


export default function AppLayout() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col relative overflow-hidden">
      <DragonBorder />
      <Navbar />
      <main className="flex-1 relative z-10 w-full overflow-x-hidden">
        <Outlet />
      </main>
      <Footer />
      <FloatingContact />
      <AnnouncementModal />
    </div>
  );
}
