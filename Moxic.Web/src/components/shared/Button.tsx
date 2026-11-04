import type { ReactNode } from "react";

interface ButtonProps {
  variant?: "primary" | "ghost" | "hero";
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function Button({ variant = "primary", children, onClick, className = "" }: ButtonProps) {
  const base = " text-sm font-semibold transition duration-300 cursor-pointer";
  const styles = {
    primary: "bg-accent hover:bg-accent-hover text-on-accent px-6 py-3",
    ghost: "bg-transparent hover:bg-white/10 text-text-secondary hover:text-text-primary px-4 py-2",
    hero: "bg-white hover:bg-text-primary text-on-accent px-8 py-3",
  };

  return (
    <button className={`${base} ${styles[variant]} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}
