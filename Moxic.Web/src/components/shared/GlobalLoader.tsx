import { useState, useEffect } from "react";

export default function GlobalLoader() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const text = "moxic.co";

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
      <div className="flex space-x-1">
        {text.split("").map((char, index) => (
          <span
            key={index}
            className="inline-block font-display text-4xl md:text-6xl font-bold text-accent drop-shadow-lg"
            style={{
              animation: `bounce-up 0.6s ease-in-out infinite alternate`,
              animationDelay: `${index * 0.1}s`,
            }}
          >
            {char}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes bounce-up {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-20px);
            color: #fff;
          }
        }
      `}</style>
    </div>
  );
}
