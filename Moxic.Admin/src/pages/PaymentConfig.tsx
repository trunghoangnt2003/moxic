import { useEffect, useState } from "react";
import {
  Upload, Save, QrCode, Banknote, Bitcoin, Loader2, CheckCircle2,
} from "lucide-react";

interface PaymentConfigData {
  id?: number;
  bankBucketName: string;
  bankQrObjectKey: string;
  cryptoBucketName: string | null;
  cryptoQrObjectKey: string | null;
  transferSyntaxTemplate: string;
  updatedAt: string;
  bankQrPresignedUrl?: string | null;
  cryptoQrPresignedUrl?: string | null;
}

export default function PaymentConfig() {
  const [config, setConfig] = useState<PaymentConfigData | null>(null);
  const [template, setTemplate] = useState("MOXIC {OrderCode}");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingBank, setUploadingBank] = useState(false);
  const [uploadingCrypto, setUploadingCrypto] = useState(false);

  useEffect(() => {
    fetch("/api/admin/payment-config")
      .then((r) => r.json())
      .then((d) => {
        if (d.id) {
          setConfig(d);
          setTemplate(d.transferSyntaxTemplate);
        }
      });
  }, []);

  const handleSaveTemplate = async () => {
    setSaving(true);
    setSaved(false);
    await fetch("/api/admin/payment-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transferSyntaxTemplate: template }),
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
        await fetch(`/api/admin/payment-config/${type}`, { method: "POST", body: formData });
        const res = await fetch("/api/admin/payment-config");
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
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-tight">Payment</h1>
        <p className="text-xs text-steam-muted mt-0.5">QR codes &amp; transfer template</p>
      </div>

      {/* QR Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Bank */}
        <div className="bg-steam-surface border border-steam-border rounded-sm p-5 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded bg-steam-blue/10 flex items-center justify-center">
              <Banknote size={16} className="text-steam-blue" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Bank Transfer</h2>
              <p className="text-xs text-steam-muted">Vietcombank QR</p>
            </div>
          </div>

          <div className="flex justify-center mb-4">
            {config?.bankQrPresignedUrl ? (
              <div className="w-40 h-40 bg-white rounded-sm p-1.5 glow-blue">
                <img src={config.bankQrPresignedUrl} className="w-full h-full object-contain" alt="Bank QR" />
              </div>
            ) : (
              <div className="w-40 h-40 bg-steam-surface-3 border border-steam-border rounded-sm flex flex-col items-center justify-center">
                <QrCode size={28} className="text-steam-border mb-1" />
                <span className="text-[11px] text-steam-muted/50">No QR</span>
              </div>
            )}
          </div>

          <button
            onClick={() => handleUpload("bank-qr")}
            disabled={uploadingBank}
            className="w-full steam-btn justify-center bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border hover:border-steam-blue/30"
          >
            {uploadingBank ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadingBank ? "Uploading..." : "Upload Bank QR"}
          </button>
        </div>

        {/* Crypto */}
        <div className="bg-steam-surface border border-steam-border rounded-sm p-5 card-hover">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded bg-steam-gold/10 flex items-center justify-center">
              <Bitcoin size={16} className="text-steam-gold" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Crypto</h2>
              <p className="text-xs text-steam-muted">USDT / BTC / ETH</p>
            </div>
          </div>

          <div className="flex justify-center mb-4">
            {config?.cryptoQrPresignedUrl ? (
              <div className="w-40 h-40 bg-white rounded-sm p-1.5 glow-blue">
                <img src={config.cryptoQrPresignedUrl} className="w-full h-full object-contain" alt="Crypto QR" />
              </div>
            ) : (
              <div className="w-40 h-40 bg-steam-surface-3 border border-steam-border rounded-sm flex flex-col items-center justify-center">
                <QrCode size={28} className="text-steam-border mb-1" />
                <span className="text-[11px] text-steam-muted/50">No QR</span>
              </div>
            )}
          </div>

          <button
            onClick={() => handleUpload("crypto-qr")}
            disabled={uploadingCrypto}
            className="w-full steam-btn justify-center bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border hover:border-steam-gold/30"
          >
            {uploadingCrypto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadingCrypto ? "Uploading..." : "Upload Crypto QR"}
          </button>
        </div>
      </div>

      {/* Template */}
      <div className="bg-steam-surface border border-steam-border rounded-sm p-5 max-w-xl">
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
          {saved ? "Saved!" : saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}
