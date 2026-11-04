import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, Clock, MessageCircleMore, ShieldCheck, ShoppingCart, Smartphone, Upload, X, XCircle } from "lucide-react";
import Container from "../components/layout/Container";
import { MoxicLoader, PageLoader } from "../components/shared/MoxicLoader";
import ConfirmationContent from "../components/checkout/ConfirmationContent";
import CheckoutSteps from "../components/checkout/CheckoutSteps";
import GiftLinkCard from "../components/gift/GiftLinkCard";
import LiveOrderTracker from "../components/account/LiveOrderTracker";
import SavedCallout from "../components/shared/SavedCallout";
import QRDisplay from "../components/checkout/QRDisplay";
import { getOrder, uploadPaymentProof } from "../lib/api";
import { useChatUi } from "../lib/chatApi";

import { t } from "../lib/i18n";
/** Payment + live status page for an order (QR while unpaid, live install tracker once paid). */
export default function ConfirmationPage() {
  const { orderCode } = useParams<{ orderCode: string }>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderCode],
    queryFn: () => getOrder(orderCode!),
    enabled: !!orderCode,
    retry: 1,
    // Poll until finished so the page flips by itself when the bank webhook confirms payment, and while installing.
    refetchInterval: (q) => (q.state.data && !["Completed", "Cancelled"].includes(q.state.data.status) ? 5000 : false),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return setUploadError(t("File quá lớn (tối đa 50MB)"));
    setSelectedFile(file);
    setUploadError("");
  };

  const handleUpload = async () => {
    if (!selectedFile || !orderCode) return;
    setUploading(true);
    setUploadError("");
    try {
      await uploadPaymentProof(orderCode, selectedFile);
      setUploaded(true);
      setSelectedFile(null);
    } catch (err: any) {
      setUploadError(t(err?.response?.data?.error ?? "") || t("Upload thất bại, vui lòng thử lại"));
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <PageLoader label={t("Đang tải đơn hàng")} />;

  if (error || !order) {
    return (
      <Container className="py-20">
        <div className="text-center py-16 bg-bg-surface border border-white/10 max-w-[500px] mx-auto px-6">
          <AlertCircle className="w-14 h-14 text-negative mx-auto mb-4 opacity-70" />
          <h2 className="font-display text-xl text-text-primary mb-2">{t("Không tìm thấy đơn hàng")}</h2>
          <p className="text-text-muted text-sm mb-6">{t("Mã đơn hàng không tồn tại hoặc đã bị xóa.")}</p>
          <Link to="/games" className="inline-flex items-center gap-1 text-accent hover:text-accent-hover text-sm">
            <ArrowLeft className="w-4 h-4" /> {t("Quay lại cửa hàng")}
          </Link>
        </div>
      </Container>
    );
  }

  const isPending = order.status === "Pending";
  const isAwaiting = order.status === "AwaitingConfirmation";
  const isPaid = ["Verifying", "Installing", "Completed"].includes(order.status);
  const isCancelled = order.status === "Cancelled";
  const unpaid = isPending || isAwaiting;
  const paymentConfig = order.paymentConfig;
  const auto = !!order.autoConfirm && !!order.dynamicQrUrl;
  const step: 0 | 1 | 2 | 3 = isPaid || order.status === "ActionRequired" ? 3 : 2;

  const header = isCancelled
    ? { icon: <XCircle className="w-7 h-7 text-negative" />, tone: "bg-negative/15", title: t("Đơn hàng đã hủy"), sub: t("Liên hệ Moxic nếu bạn đã chuyển khoản hoặc cần hỗ trợ.") }
    : isPaid
      ? { icon: <CheckCircle2 className="w-7 h-7 text-positive" />, tone: "bg-positive/15", title: t("Thanh toán thành công 🎉"), sub: t("Moxic đang cài game vào tài khoản Xbox của bạn, theo dõi trực tiếp bên dưới.") }
      : isAwaiting
        ? { icon: <Clock className="w-7 h-7 text-info" />, tone: "bg-info/15", title: t("Đang kiểm tra thanh toán"), sub: t("Moxic đã nhận ảnh chuyển khoản của bạn và đang đối soát.") }
        : { icon: <Smartphone className="w-7 h-7 text-accent" />, tone: "bg-accent/15", title: t("Thanh toán đơn hàng"), sub: auto ? t("Quét mã QR bằng app ngân hàng, đơn tự xác nhận ngay khi tiền về.") : t("Chuyển khoản theo thông tin bên dưới để hoàn tất đơn.") };

  return (
    <Container className="py-8 md:py-12 mb-16">
      <div className="max-w-5xl mx-auto">
        <CheckoutSteps current={step} />

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <span className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center ${header.tone}`}>{header.icon}</span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary leading-tight">{header.title}</h1>
            <p className="text-sm text-text-secondary mt-1">{header.sub}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          {/* Main column */}
          <div className="space-y-5 min-w-0">
            {order.isGift && order.giftToken && <GiftLinkCard token={order.giftToken} recipientName={order.giftRecipientName} claimedAt={order.giftClaimedAt} />}

            {(isPaid || order.status === "ActionRequired") && <LiveOrderTracker order={order} />}

            {/* Payment */}
            {paymentConfig && unpaid && (
              <section className="border border-white/10 bg-bg-surface overflow-hidden">
                {isPending && auto && (
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-accent/10 border-b border-accent/20 text-sm" aria-live="polite">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                    </span>
                    <span className="text-text-primary font-medium">{t("Đang chờ tiền về…")}</span>
                    <span className="text-text-muted text-xs hidden sm:inline">{t("trang tự cập nhật, không cần tải lại")}</span>
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  <ol className="grid grid-cols-3 gap-2 mb-5 text-center">
                    {[t("Mở app ngân hàng"), t("Quét mã QR"), auto ? t("Xong, tự xác nhận") : t("Gửi ảnh chuyển khoản")].map((s, i) => (
                      <li key={s} className="px-2 py-2.5 bg-white/[0.03] border border-white/5">
                        <span className="block text-[10px] font-bold text-accent">{t("BƯỚC {0}", [i + 1])}</span>
                        <span className="block text-xs text-text-secondary mt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>

                  <QRDisplay
                    bankQrUrl={order.dynamicQrUrl ?? paymentConfig.bankQrUrl}
                    cryptoQrUrl={paymentConfig.cryptoQrUrl}
                    transferContent={order.transferContent || order.orderCode}
                    autoConfirm={auto}
                    amount={order.totalAmount}
                    discounted={(order.discountAmount ?? 0) > 0}
                  />

                  {paymentConfig.bankName && paymentConfig.bankAccountNumber && (
                    <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      {[
                        [t("Ngân hàng"), paymentConfig.bankName],
                        [t("Số tài khoản"), paymentConfig.bankAccountNumber],
                        [t("Chủ tài khoản"), paymentConfig.bankAccountHolder],
                      ].map(([k, v]) => (
                        <div key={k} className="px-3 py-2 bg-white/[0.03] border border-white/5">
                          <dt className="text-[11px] text-text-muted">{k}</dt>
                          <dd className={`text-text-primary font-medium truncate ${k === "Số tài khoản" ? "font-mono" : ""}`}>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </section>
            )}

            {/* Manual proof: the main path without auto-confirm, a fallback with it */}
            {isPending && (
              <section className="border border-white/10 bg-bg-surface">
                {auto && !showUpload ? (
                  <button type="button" onClick={() => setShowUpload(true)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm text-text-muted hover:text-text-primary cursor-pointer">
                    <span>{t("Đã chuyển hơn 10 phút mà chưa được xác nhận? Gửi ảnh chuyển khoản")}</span>
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  </button>
                ) : (
                  <div className="p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-text-primary mb-3">{t("Gửi ảnh chuyển khoản")}</h3>
                    {!uploaded ? (
                      <>
                        <label className="block border-2 border-dashed border-white/10 hover:border-accent/50 p-6 text-center transition-colors cursor-pointer">
                          {selectedFile ? (
                            <span className="relative inline-block">
                              <img src={URL.createObjectURL(selectedFile)} alt={t("Ảnh đã chọn")} className="max-h-[200px] mx-auto" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedFile(null);
                                }}
                                aria-label={t("Bỏ ảnh")}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-negative rounded-full flex items-center justify-center cursor-pointer"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </span>
                          ) : (
                            <span className="block">
                              <Upload className="w-7 h-7 text-text-muted mx-auto mb-2" />
                              <span className="block text-sm text-text-secondary">{t("Chọn ảnh chụp màn hình chuyển khoản")}</span>
                              <span className="block text-xs text-text-muted mt-1">{t("Mọi định dạng ảnh, tối đa 50MB")}</span>
                            </span>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                        {uploadError && <p className="text-xs text-negative mt-2">{uploadError}</p>}
                        <button
                          type="button"
                          onClick={handleUpload}
                          disabled={!selectedFile || uploading}
                          className="mt-3 w-full h-11 bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {uploading ? <MoxicLoader size="sm" /> : <Upload className="w-4 h-4" />}
                          {uploading ? t("Đang tải lên…") : t("Gửi ảnh xác nhận")}
                        </button>
                      </>
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-positive">
                        <CheckCircle2 className="w-5 h-5" /> {t("Đã gửi ảnh, Moxic sẽ kiểm tra và xác nhận sớm.")}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            {isAwaiting && order.paymentProofUrl && (
              <section className="border border-white/10 bg-bg-surface p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-3">{t("Ảnh chuyển khoản đã gửi")}</h3>
                <img src={order.paymentProofUrl} alt={t("Ảnh chuyển khoản")} className="max-h-[300px] mx-auto border border-white/10" />
              </section>
            )}

            {!isCancelled && (order.savedAmount ?? 0) > 0 && <SavedCallout amount={order.savedAmount!} suffix={t("với đơn này")} share={isPaid} />}
          </div>

          {/* Summary column */}
          <aside className="space-y-4 lg:sticky lg:top-[calc(4.5rem+var(--sat))]">
            <ConfirmationContent
              orderCode={order.orderCode}
              items={order.items}
              totalAmount={order.totalAmount}
              createdAt={order.createdAt}
              subtotalAmount={order.subtotalAmount}
              discountAmount={order.discountAmount}
              couponCode={order.couponCode}
            />
            <div className="border border-white/10 bg-bg-surface p-4 space-y-2.5 text-sm">
              <p className="flex items-center gap-2 text-text-secondary">
                <ShieldCheck className="w-4 h-4 text-positive shrink-0" /> {t("Game chính hãng, cài vào tài khoản của bạn")}
              </p>
              <p className="flex items-center gap-2 text-text-secondary">
                <Clock className="w-4 h-4 text-accent shrink-0" /> {t("Thường xong 15 đến 30 phút sau khi nhận tiền")}
              </p>
              <button type="button" onClick={() => useChatUi.getState().openChat(order.orderCode)} className="flex items-center gap-2 text-accent hover:underline cursor-pointer">
                <MessageCircleMore className="w-4 h-4 shrink-0" /> {t("Cần hỗ trợ? Chat với Moxic về đơn này")}
              </button>
            </div>
            <Link to="/games" className="flex items-center justify-center gap-2 h-11 border border-white/15 text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-white/30">
              <ShoppingCart className="w-4 h-4" /> {t("Tiếp tục mua sắm")}
            </Link>
          </aside>
        </div>
      </div>
    </Container>
  );
}
