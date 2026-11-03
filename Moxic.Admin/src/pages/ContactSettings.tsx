import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MessageCircle, Phone, Save } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";

interface ContactSettingsData {
  messengerUrl: string;
  zalo: string;
  phoneNumber: string;
  updatedAt: string | null;
}

export default function ContactSettings() {
  const [messengerUrl, setMessengerUrl] = useState("");
  const [zalo, setZalo] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const apply = (d: ContactSettingsData) => {
    setMessengerUrl(d.messengerUrl ?? "");
    setZalo(d.zalo ?? "");
    setPhoneNumber(d.phoneNumber ?? "");
    setUpdatedAt(d.updatedAt);
  };

  useEffect(() => {
    apiFetch(apiUrl("/api/admin/contact-settings"))
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || "Không tải được cài đặt liên hệ");
          return;
        }
        apply(await res.json());
      })
      .catch(() => setError("Không tải được cài đặt liên hệ"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(apiUrl("/api/admin/contact-settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messengerUrl: messengerUrl.trim(),
          zalo: zalo.trim(),
          phoneNumber: phoneNumber.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Không lưu được cài đặt");
        return;
      }
      apply(await res.json());
      setSuccess("Đã lưu cài đặt liên hệ");
      window.setTimeout(() => setSuccess(""), 2500);
    } catch {
      setError("Không lưu được cài đặt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white font-mono tracking-tight">Contact</h1>
        <p className="text-xs text-steam-muted mt-0.5">Nút liên hệ nổi (Messenger / Zalo / Gọi điện) trên website</p>
      </div>

      <form onSubmit={handleSave} className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 max-w-xl space-y-4">
        {loading ? (
          <div className="py-8 flex justify-center text-steam-muted">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : (
          <>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-steam-muted mb-1">
                <MessageCircle size={12} className="text-[#0099FF]" /> Messenger URL
              </label>
              <input
                value={messengerUrl}
                onChange={(e) => setMessengerUrl(e.target.value)}
                placeholder="https://m.me/tenfanpage"
                maxLength={500}
                className="w-full steam-input"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-steam-muted mb-1">
                <span className="inline-flex items-center justify-center w-3 h-3 rounded-sm bg-[#0068FF] text-[7px] font-black text-white">Z</span> Zalo (link hoặc số điện thoại)
              </label>
              <input
                value={zalo}
                onChange={(e) => setZalo(e.target.value)}
                placeholder="https://zalo.me/0901234567 hoặc 0901234567"
                maxLength={500}
                className="w-full steam-input"
              />
              <p className="text-[11px] text-steam-muted mt-1">
                Nhập link Zalo hoặc số điện thoại — số điện thoại sẽ tự chuyển thành https://zalo.me/{"{số}"}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-steam-muted mb-1">
                <Phone size={12} className="text-emerald-400" /> Số điện thoại
              </label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0901 234 567"
                maxLength={20}
                className="w-full steam-input"
              />
              <p className="text-[11px] text-steam-muted mt-1">Hiển thị nút gọi tel:</p>
            </div>

            <p className="text-[11px] text-steam-gold/90 bg-steam-gold/5 border border-steam-gold/20 rounded-sm px-3 py-2">
              Để trống để ẩn nút tương ứng trên website
            </p>

            {error && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertCircle size={12} className="flex-shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-steam-green/10 border border-steam-green/30 text-xs text-steam-green">
                <CheckCircle2 size={12} /> {success}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-steam-muted">
                {updatedAt ? `Cập nhật: ${new Date(updatedAt).toLocaleString("vi-VN")}` : ""}
              </span>
              <button
                type="submit"
                disabled={saving}
                className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue text-xs md:text-sm"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
