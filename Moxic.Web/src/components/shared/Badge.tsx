import type { ReactNode } from "react";

interface BadgeProps {
  variant: "discount" | "preorder" | "available" | "hot";
  children: ReactNode;
}

const variants = {
  discount: "bg-discount text-white",
  preorder: "bg-preorder text-white",
  available: "bg-success text-white",
  hot: "bg-danger text-white",
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-block px-2 py-0.5  text-[11px] font-semibold ${variants[variant]}`}>
      {children}
    </span>
  );
}
