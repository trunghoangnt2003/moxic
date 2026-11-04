import { type ReactNode } from "react";
import { useInAccountFrame } from "../account/AccountLayout";

export default function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  // Inside the account frame the column already sets width and gutters: drop the page's own width, centring and top margin.
  if (useInAccountFrame()) {
    const flat = className.replace(/(^|\s)(max-w-\S+|mx-auto|mt-\S+|mb-\S+)(?=\s|$)/g, " ");
    return <div className={flat}>{children}</div>;
  }
  return <div className={`max-w-[1200px] mx-auto px-4 ${className}`}>{children}</div>;
}
