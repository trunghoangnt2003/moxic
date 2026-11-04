import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ChevronDown, MessageCircleMore } from "lucide-react";
import Container from "../components/layout/Container";
import { SectionLoader } from "../components/shared/MoxicLoader";
import { usePageMeta } from "../hooks/usePageMeta";
import { useChatUi } from "../lib/chatApi";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

/** "Mua game Xbox ở đâu rẻ và uy tín?", FAQ (content managed in admin). */
export default function FaqPage() {
  usePageMeta("Hỏi đáp: Mua game Xbox ở đâu rẻ và uy tín?", "Giải đáp về mua game Xbox giá rẻ tại Moxic: quy trình, thời gian cài, thanh toán, an toàn tài khoản.");
  const { data, isLoading } = useQuery({
    queryKey: ["seo", "faq"],
    queryFn: async () => (await api.get<{ question: string; answer: string }[]>("/seo/faq")).data,
    staleTime: 10 * 60_000,
  });
  const [open, setOpen] = useState<number | null>(0);

  if (isLoading) return <SectionLoader />;
  return (
    <Container className="mt-8 mb-20 max-w-3xl">
      <p className="text-xs text-accent">Hỏi đáp</p>
      <h1 className="font-display text-3xl md:text-4xl font-extrabold mt-1">Mua game Xbox ở đâu rẻ và uy tín?</h1>
      <p className="text-text-secondary mt-2">
        Những câu hỏi khách hay hỏi trước khi mua game tại Moxic. Muốn so giá ngay? Xem{" "}
        <Link to="/bang-gia-xbox" className="text-accent hover:underline">bảng giá game Xbox hôm nay</Link>.
      </p>

      <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
        {(data ?? []).map((f, i) => (
          <div key={f.question}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className="w-full flex items-center justify-between gap-3 py-4 text-left cursor-pointer"
            >
              <h2 className="font-semibold text-base">{f.question}</h2>
              <ChevronDown className={`w-5 h-5 shrink-0 text-text-muted transition-transform ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="pb-4 text-text-secondary leading-relaxed whitespace-pre-line animate-[fadeIn_0.2s_ease-out]">{f.answer}</p>}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border border-accent/30 bg-accent/5 p-4">
        <MessageCircleMore className="w-6 h-6 text-accent" />
        <p className="flex-1 text-sm">Chưa thấy câu bạn cần? Hỏi Moxic trực tiếp, thường trả lời trong vài phút.</p>
        <button type="button" onClick={() => useChatUi.getState().openChat()} className="h-10 px-4 bg-accent text-bg-base text-sm font-bold cursor-pointer">
          Chat ngay
        </button>
      </div>
    </Container>
  );
}
