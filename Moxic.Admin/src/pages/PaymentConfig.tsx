import { useEffect, useState } from "react";
import {
  Upload, Save, QrCode, Banknote, Bitcoin, Loader2, CheckCircle2,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";

interface PaymentConfigData {
  id?: number;
  bankBucketName: string;
  bankQrObjectKey: string;
  cryptoBucketName: string | null;
  cryptoQrObjectKey: string | null;
  transferSyntaxTemplate: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankCode?: string | null;
  updatedAt: string;
  bankQrPresignedUrl?: string | null;
  cryptoQrPresignedUrl?: string | null;
}

export default function PaymentConfig() {
  const [config, setConfig] = useState<PaymentConfigData | null>(null);
  const [template, setTemplate] = useState("MOXIC {OrderCode}");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingBank, setUploadingBank] = useState(false);
  const [uploadingCrypto, setUploadingCrypto] = useState(false);

  useEffect(() => {
    apiFetch(apiUrl("/api/admin/payment-config"))
      .then((r) => r.json())
      .then((d) => {
        if (d.id) {
          setConfig(d);
          setTemplate(d.transferSyntaxTemplate);
          setBankName(d.bankName || "");
          setBankAccountNumber(d.bankAccountNumber || "");
          setBankAccountHolder(d.bankAccountHolder || "");
          setBankCode(d.bankCode || "");
        }
      });
  }, []);

  const handleSaveTemplate = async () => {
    setSaving(true);
    setSaved(false);
    await apiFetch(apiUrl("/api/admin/payment-config"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transferSyntaxTemplate: template,
        bankName: bankName,
        bankAccountNumber: bankAccountNumber,
        bankAccountHolder: bankAccountHolder,
        bankCode: bankCode,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleUpload = async (type: "bank-qr" | "crypto-qr") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".jpg,.jpeg,.png,.webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (type === "bank-qr") setUploadingBank(true);
      else setUploadingCrypto(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        await apiFetch(apiUrl(`/api/admin/payment-config/${type}`), { method: "POST", body: formData });
        const res = await apiFetch(apiUrl("/api/admin/payment-config"));
        const d = await res.json();
        setConfig(d);
      } finally {
        setUploadingBank(false);
        setUploadingCrypto(false);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white font-mono tracking-tight">Payment</h1>
        <p className="text-xs text-steam-muted mt-0.5">QR codes, bank info &amp; transfer template</p>
      </div>

      {/* QR Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {/* Bank */}
        <div className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded bg-steam-blue/10 flex items-center justify-center flex-shrink-0">
              <Banknote size={16} className="text-steam-blue" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Bank Transfer</h2>
              <p className="text-xs text-steam-muted truncate">Vietcombank QR</p>
            </div>
          </div>

          <div className="flex justify-center mb-4">
            {config?.bankQrPresignedUrl ? (
              <div className="w-36 h-36 sm:w-40 sm:h-40 bg-white rounded-sm p-1.5 glow-blue">
                <img src={config.bankQrPresignedUrl} className="w-full h-full object-contain" alt="Bank QR" />
              </div>
            ) : (
              <div className="w-36 h-36 sm:w-40 sm:h-40 bg-steam-surface-3 border border-steam-border rounded-sm flex flex-col items-center justify-center">
                <QrCode size={24} className="text-steam-border mb-1" />
                <span className="text-[11px] text-steam-muted/50">No QR</span>
              </div>
            )}
          </div>

          <button
            onClick={() => handleUpload("bank-qr")}
            disabled={uploadingBank}
            className="w-full steam-btn justify-center bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border hover:border-steam-blue/30 text-xs md:text-sm"
          >
            {uploadingBank ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadingBank ? "Uploading..." : "Upload Bank QR"}
          </button>
        </div>

        {/* Crypto */}
        <div className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded bg-steam-gold/10 flex items-center justify-center flex-shrink-0">
              <Bitcoin size={16} className="text-steam-gold" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Crypto</h2>
              <p className="text-xs text-steam-muted truncate">USDT / BTC / ETH</p>
            </div>
          </div>

          <div className="flex justify-center mb-4">
            {config?.cryptoQrPresignedUrl ? (
              <div className="w-36 h-36 sm:w-40 sm:h-40 bg-white rounded-sm p-1.5 glow-blue">
                <img src={config.cryptoQrPresignedUrl} className="w-full h-full object-contain" alt="Crypto QR" />
              </div>
            ) : (
              <div className="w-36 h-36 sm:w-40 sm:h-40 bg-steam-surface-3 border border-steam-border rounded-sm flex flex-col items-center justify-center">
                <QrCode size={24} className="text-steam-border mb-1" />
                <span className="text-[11px] text-steam-muted/50">No QR</span>
              </div>
            )}
          </div>

          <button
            onClick={() => handleUpload("crypto-qr")}
            disabled={uploadingCrypto}
            className="w-full steam-btn justify-center bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border hover:border-steam-gold/30 text-xs md:text-sm"
          >
            {uploadingCrypto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadingCrypto ? "Uploading..." : "Upload Crypto QR"}
          </button>
        </div>
      </div>

      {/* Bank Account Info */}
      <div className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 max-w-xl">
        <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest mb-4">
          Bank Account Info
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-steam-muted mb-1">Bank Name</label>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full steam-input"
              placeholder="e.g. Vietcombank"
            />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Account Number</label>
            <input
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className="w-full steam-input font-mono"
              placeholder="e.g. 0123456789"
            />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Account Holder</label>
            <input
              value={bankAccountHolder}
              onChange={(e) => setBankAccountHolder(e.target.value)}
              className="w-full steam-input"
              placeholder="e.g. NGUYEN VAN A"
            />
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Ngân hàng (để SePay tạo QR riêng cho từng đơn)</label>
            <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full steam-input">
              <option value="">— Không dùng (hiện ảnh QR tĩnh) —</option>
              {VIETQR_BANKS.map(([code, name]) => (
                <option key={code} value={code}>{code} — {name}</option>
              ))}
              {bankCode && !VIETQR_BANKS.some(([c]) => c === bankCode) && <option value={bankCode}>{bankCode}</option>}
            </select>
            <p className="text-[11px] text-steam-muted mt-1">Khi chọn, mỗi đơn có QR điền sẵn số tiền + nội dung. Bấm <b>Save All</b> bên dưới để lưu.</p>
          </div>
        </div>
      </div>

      <BankTransactions />

      {/* Template */}
      <div className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 max-w-xl">
        <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest mb-4">
          Transfer Content Template
        </h2>
        <p className="text-xs text-steam-muted mb-3">
          Use <code className="px-1 py-0.5 bg-steam-surface-3 border border-steam-border rounded text-[11px] text-steam-blue font-mono">{`{OrderCode}`}</code> as placeholder
        </p>
        <input
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="w-full steam-input font-mono mb-4"
        />
        <button
          onClick={handleSaveTemplate}
          disabled={saving}
          className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={14} />
          ) : (
            <Save size={14} />
          )}
          {saved ? "Saved!" : saving ? "Saving..." : "Save All"}
        </button>
      </div>
    </div>
  );
}

const VIETQR_BANKS: [string, string][] = [
  ["VCB", "Vietcombank"], ["MB", "MB Bank"], ["TCB", "Techcombank"], ["ACB", "ACB"], ["BIDV", "BIDV"], ["ICB", "VietinBank"],
  ["VPB", "VPBank"], ["TPB", "TPBank"], ["STB", "Sacombank"], ["VIB", "VIB"], ["HDB", "HDBank"], ["MSB", "MSB"],
  ["OCB", "OCB"], ["SHB", "SHB"], ["VBA", "Agribank"], ["SEAB", "SeABank"], ["LPB", "LPBank"], ["EIB", "Eximbank"],
  ["NAB", "Nam A Bank"], ["BAB", "Bac A Bank"], ["CAKE", "CAKE by VPBank"], ["TIMO", "Timo"], ["VCCB", "Ban Viet"],
];

interface BankTxn {
  id: string;
  amount: number;
  content: string | null;
  gateway: string | null;
  status: string;
  orderCode: string | null;
  note: string | null;
  createdAt: string;
}

const TXN_STATUS: Record<string, { label: string; cls: string }> = {
  Matched: { label: "Tự khớp", cls: "text-green-300 bg-green-500/10 border-green-500/30" },
  Manual: { label: "Gán tay", cls: "text-sky-300 bg-sky-500/10 border-sky-500/30" },
  Underpaid: { label: "Thiếu tiền", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
  AlreadyPaid: { label: "Đơn đã xử lý", cls: "text-orange-300 bg-orange-500/10 border-orange-500/30" },
  Unmatched: { label: "Không khớp", cls: "text-red-300 bg-red-500/10 border-red-500/30" },
};

/** Incoming transfers reported by SePay, with manual assignment for the ones that didn't match an order. */
function BankTransactions() {
  const [data, setData] = useState<{ autoConfirm: boolean; webhookUrl: string; total: number; items: BankTxn[] } | null>(null);
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const load = () =>
    apiFetch(apiUrl("/api/admin/payments/transactions"))
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  useEffect(() => {
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, []);

  const doAssign = async (id: string) => {
    const code = (assign[id] || "").trim();
    if (!code) return;
    const res = await apiFetch(apiUrl(`/api/admin/payments/transactions/${id}/assign`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderCode: code }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "Gán thất bại");
    } else {
      setMsg("Đã gán giao dịch.");
      load();
    }
  };

  if (!data) return null;
  return (
    <div className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">Tự đối soát chuyển khoản (SePay)</h2>
        <span className={`text-[11px] px-2 py-0.5 rounded border ${data.autoConfirm ? "text-green-300 border-green-500/30" : "text-amber-300 border-amber-500/30"}`}>
          {data.autoConfirm ? "● Đang bật" : "Chưa cấu hình Sepay__ApiKey"}
        </span>
      </div>
      <p className="text-[11px] text-steam-muted mb-3">
        Webhook URL: <code className="text-steam-blue select-all">{data.webhookUrl}</code> · Kiểu xác thực: API Key
      </p>
      {msg && <p className="text-xs text-steam-text mb-2">{msg}</p>}
      {data.items.length === 0 ? (
        <p className="text-sm text-steam-muted py-6 text-center">Chưa có giao dịch nào.</p>
      ) : (
        <div className="divide-y divide-steam-border/60">
          {data.items.map((t) => {
            const st = TXN_STATUS[t.status] ?? { label: t.status, cls: "text-steam-muted border-steam-border" };
            return (
              <div key={t.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-mono font-semibold text-white w-28">{t.amount.toLocaleString("vi-VN")}₫</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                <span className="text-xs text-steam-muted">{new Date(t.createdAt).toLocaleString("vi-VN")}</span>
                {t.orderCode && <span className="font-mono text-xs text-steam-blue">{t.orderCode}</span>}
                <span className="basis-full text-xs text-steam-text break-all">
                  {t.gateway ? `${t.gateway} · ` : ""}
                  {t.content}
                  {t.note ? ` — ${t.note}` : ""}
                </span>
                {(t.status === "Unmatched" || t.status === "Underpaid") && (
                  <div className="basis-full flex gap-2">
                    <input
                      value={assign[t.id] ?? ""}
                      onChange={(e) => setAssign({ ...assign, [t.id]: e.target.value.toUpperCase() })}
                      placeholder="MOXIC-20261104-ABCDE"
                      className="steam-input flex-1 font-mono text-xs"
                    />
                    <button type="button" onClick={() => doAssign(t.id)} className="steam-btn bg-steam-blue text-black text-xs">
                      Gán cho đơn
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
