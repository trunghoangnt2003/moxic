import { useEffect, useState } from "react";

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

  useEffect(() => {
    fetch("/api/admin/payment-config")
      .then(r => r.json())
      .then(d => {
        if (d.id) {
          setConfig(d);
          setTemplate(d.transferSyntaxTemplate);
        }
      });
  }, []);

  const handleSaveTemplate = async () => {
    setSaving(true);
    await fetch("/api/admin/payment-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transferSyntaxTemplate: template }),
    });
    setSaving(false);
    alert("Saved!");
  };

  const handleUpload = async (type: "bank-qr" | "crypto-qr") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".jpg,.jpeg,.png,.webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("file", file);

      await fetch(`/api/admin/payment-config/${type}`, { method: "POST", body: formData });
      // Refresh
      const res = await fetch("/api/admin/payment-config");
      const d = await res.json();
      setConfig(d);
    };
    input.click();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Payment Configuration</h1>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
          <h2 className="text-white font-semibold mb-3">Bank QR</h2>
          {config?.bankQrPresignedUrl ? (
            <img src={config.bankQrPresignedUrl} className="w-48 h-48 object-contain mb-3 bg-white rounded" alt="Bank QR" />
          ) : (
            <div className="w-48 h-48 bg-[#2a2a2a] rounded mb-3 flex items-center justify-center text-gray-600 text-sm">No QR</div>
          )}
          <button onClick={() => handleUpload("bank-qr")} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm">
            Upload Bank QR
          </button>
        </div>

        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
          <h2 className="text-white font-semibold mb-3">Crypto QR</h2>
          {config?.cryptoQrPresignedUrl ? (
            <img src={config.cryptoQrPresignedUrl} className="w-48 h-48 object-contain mb-3 bg-white rounded" alt="Crypto QR" />
          ) : (
            <div className="w-48 h-48 bg-[#2a2a2a] rounded mb-3 flex items-center justify-center text-gray-600 text-sm">No QR</div>
          )}
          <button onClick={() => handleUpload("crypto-qr")} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm">
            Upload Crypto QR
          </button>
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6 max-w-xl">
        <h2 className="text-white font-semibold mb-3">Transfer Content Template</h2>
        <p className="text-gray-500 text-xs mb-2">Use {'{OrderCode}'} as placeholder for the order code</p>
        <input value={template} onChange={e => setTemplate(e.target.value)}
          className="w-full bg-[#2a2a2a] border border-gray-700 rounded p-3 text-white text-sm mb-3 font-mono" />
        <button onClick={handleSaveTemplate} disabled={saving}
          className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 text-white px-4 py-2 rounded text-sm">
          {saving ? "Saving..." : "Save Template"}
        </button>
      </div>
    </div>
  );
}
