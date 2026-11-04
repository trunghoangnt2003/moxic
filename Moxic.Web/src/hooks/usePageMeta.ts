import { useEffect } from "react";

const DEFAULT_TITLE = "Moxic GameStore — Game Xbox chính hãng giá rẻ";

/** Sets the tab title + meta description for the current page (crawlers get server-rendered tags). */
export function usePageMeta(title?: string | null, description?: string | null) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} | Moxic GameStore`;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const prev = meta?.content;
    if (meta && description) meta.content = description;
    return () => {
      document.title = DEFAULT_TITLE;
      if (meta && prev != null) meta.content = prev;
    };
  }, [title, description]);
}
