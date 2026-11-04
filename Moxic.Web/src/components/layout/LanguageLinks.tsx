import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { basename, pathIn } from "../../lib/i18n";

const ORIGIN = "https://moxic.co";

function setLink(rel: string, href: string, hreflang?: string) {
  const sel = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(sel);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (hreflang) el.hreflang = hreflang;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** canonical + hreflang alternates for the current page, kept in step with client-side navigation. */
export default function LanguageLinks() {
  const { pathname } = useLocation(); // router path, without the /en basename
  useEffect(() => {
    const full = (basename ?? "") + (pathname === "/" && basename ? "" : pathname);
    setLink("canonical", ORIGIN + full);
    setLink("alternate", ORIGIN + pathIn("vi", full), "vi");
    setLink("alternate", ORIGIN + pathIn("en", full), "en");
    setLink("alternate", ORIGIN + pathIn("vi", full), "x-default");
  }, [pathname]);
  return null;
}
