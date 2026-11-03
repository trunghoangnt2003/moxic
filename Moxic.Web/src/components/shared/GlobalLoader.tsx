import { useState, useEffect } from "react";
import { MoxicLoader } from "./MoxicLoader";

export default function GlobalLoader() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Start fading out after 1.5 seconds
    const timer1 = setTimeout(() => setIsFadingOut(true), 1500);
    // Remove from DOM after transition finishes (add 500ms for transition)
    const timer2 = setTimeout(() => setIsVisible(false), 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-bg-base transition-opacity duration-500 ease-in-out ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <MoxicLoader size="lg" label="moxic.co" />
    </div>
  );
}
