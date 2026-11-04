import axios from "axios";
import { EN } from "./i18n.en";

/**
 * Vietnamese is the source language; English lives under /en (its own URLs, so search engines
 * and AI assistants index each language separately).
 *
 * The language is fixed for the life of the page: it comes from the URL, and switching does a
 * full load of the matching URL. That keeps t() a plain function (usable at module scope) and
 * lets the router take "/en" as its basename, so every <Link> and navigate() is prefixed for free.
 */
export type Lang = "vi" | "en";

const EN_PREFIX = /^\/en(?=\/|$)/;

export const lang: Lang = typeof window !== "undefined" && EN_PREFIX.test(window.location.pathname) ? "en" : "vi";
export const basename = lang === "en" ? "/en" : undefined;
/** BCP 47 tag for dates and numbers. Prices stay in VND either way. */
export const locale = lang === "en" ? "en-GB" : "vi-VN";

/**
 * Translate a Vietnamese source string. Placeholders are {0}, {1}… filled from `args`.
 * A string with no English entry falls back to Vietnamese, so nothing ever renders blank.
 */
export function t(vi: string, args?: readonly unknown[]): string {
  const s = lang === "en" ? (EN[vi] ?? vi) : vi;
  if (!args || args.length === 0) return s;
  return s.replace(/\{(\d+)\}/g, (m, i) => (Number(i) < args.length ? String(args[Number(i)] ?? "") : m));
}

/** Path of the current page in the other language (for the switcher and hreflang links). */
export function pathIn(target: Lang, path = typeof window !== "undefined" ? window.location.pathname : "/"): string {
  const bare = path.replace(EN_PREFIX, "") || "/";
  return target === "en" ? (bare === "/" ? "/en" : `/en${bare}`) : bare;
}

export function switchLanguage(target: Lang) {
  if (target === lang) return;
  try {
    localStorage.setItem("moxic.lang", target);
  } catch {
    /* storage unavailable */
  }
  window.location.assign(pathIn(target) + window.location.search + window.location.hash);
}

// Every API call states the language, so the server can answer in it (descriptions, emails, messages).
axios.defaults.headers.common["Accept-Language"] = lang;
if (typeof document !== "undefined") document.documentElement.lang = lang;
