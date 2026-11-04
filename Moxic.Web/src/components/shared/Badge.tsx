import type { ReactNode } from "react";

interface BadgeProps {
  variant: "discount" | "preorder" | "available" | "hot";
  children: ReactNode;
}

const variants = {
  discount: "bg-discount text-on-solid",
  preorder: "bg-preorder text-on-solid",
  available: "bg-success text-on-solid",
  hot: "bg-danger text-on-solid",
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`inline-block px-2 py-0.5  text-[11px] font-semibold ${variants[variant]}`}>
      {children}
    </span>
  );
}
