import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle, AlertCircle, ArrowLeft, ShoppingCart, Upload, Banknote, X } from "lucide-react";
import Container from "../components/layout/Container";
import { MoxicLoader, PageLoader } from "../components/shared/MoxicLoader";
import ConfirmationContent from "../components/checkout/ConfirmationContent";
import GiftLinkCard from "../components/gift/GiftLinkCard";
import QRDisplay from "../components/checkout/QRDisplay";
import { getOrder, uploadPaymentProof } from "../lib/api";

export default function ConfirmationPage() {
  const { orderCode } = useParams<{ orderCode: string }>();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderCode],
    queryFn: () => getOrder(orderCode!),
    enabled: !!orderCode,
    retry: 1,
    // While unpaid, poll so the page flips to "đã nhận tiền" as soon as the bank webhook confirms it.
    refetchInterval: (q) => (q.state.data && ["Pending", "AwaitingConfirmation"].includes(q.state.data.status) ? 5000 : false),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setUploadError("File quá lớn (tối đa 50MB)");
        return;
      }
      
      setSelectedFile(file);
      setUploadError("");
    }
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
      setUploadError(err?.response?.data?.error || "Upload thất bại, vui lòng thử lại");
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1714] py-12">
        <Container className="mt-12">
          <PageLoader label="Đang tải thông tin đơn hàng..." />
        </Container>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#1a1714] py-12">
        <Container className="mt-20">
          <div className="text-center py-24 bg-[#252019] border border-[#3d352a] max-w-[500px] mx-auto">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-60" />
            <h2 className="font-display text-xl text-[#ede6db] mb-2">Không tìm thấy đơn hàng</h2>
            <p className="text-[#7a6f63] text-sm mb-6">Mã đơn hàng không tồn tại hoặc đã bị xóa.</p>
            <Link to="/games" className="inline-flex items-center gap-1 text-[#c9a96e] hover:text-[#d4b87a] text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Quay lại cửa hàng
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  const isPending = order.status === "Pending";
  const isAwaitingConfirmation = order.status === "AwaitingConfirmation";
  const isPaid = ["Verifying", "Installing", "Completed"].includes(order.status);
  const paymentConfig = order.paymentConfig;
  const hasBankInfo = paymentConfig?.bankName && paymentConfig?.bankAccountNumber;

  return (
    <div className="min-h-screen bg-[#1a1714] py-8 md:py-12">
      <Container className="mt-8 mb-20">
        <div className="max-w-[600px] mx-auto">
          {/* Success header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl text-[#ede6db] mb-2">
              Đặt hàng thành công!
            </h1>
            <p className="text-[#7a6f63] text-sm">
              {isPaid
                ? "Moxic đã nhận được thanh toán của bạn 🎉"
                : isAwaitingConfirmation
                ? "Đã nhận được ảnh xác nhận, vui lòng chờ admin duyệt."
                : order.autoConfirm
                ? "Quét mã QR bên dưới để thanh toán — hệ thống tự xác nhận khi tiền về."
                : "Vui lòng chuyển khoản và xác nhận thanh toán bên dưới."}
            </p>
          </div>

          {/* Order content */}
          <div className="space-y-5">
            {order.isGift && order.giftToken && (
              <GiftLinkCard token={order.giftToken} recipientName={order.giftRecipientName} claimedAt={order.giftClaimedAt} />
            )}
            <ConfirmationContent
              orderCode={order.orderCode}
              items={order.items}
              totalAmount={order.totalAmount}
              createdAt={order.createdAt}
              subtotalAmount={order.subtotalAmount}
              discountAmount={order.discountAmount}
              couponCode={order.couponCode}
            />

            {isPaid && (
              <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 px-4 py-4 animate-[popIn_0.4s_ease-out]">
                <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
                <div>
                  <p className="font-semibold text-green-300">Đã nhận thanh toán</p>
                  <p className="text-sm text-[#b5a898]">Moxic đang chuẩn bị cài game vào tài khoản Xbox của bạn — thường trong 15–30 phút. Bạn sẽ nhận thông báo khi xong.</p>
                </div>
              </div>
            )}

            {/* Bank info + QR */}
            {paymentConfig && !isPaid && order.status !== "Cancelled" && (
              <>
                {/* Bank account info */}
                {hasBankInfo && (
                  <div className="bg-[#252019] border border-[#3d352a] p-5">
                    <h3 className="text-xs font-semibold text-[#c9a96e] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Banknote className="w-4 h-4" /> Thông tin chuyển khoản
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#7a6f63]">Ngân hàng</span>
                        <span className="text-[#ede6db] font-medium">{paymentConfig.bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7a6f63]">Số tài khoản</span>
                        <span className="text-[#ede6db] font-mono font-medium">{paymentConfig.bankAccountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7a6f63]">Chủ tài khoản</span>
                        <span className="text-[#ede6db] font-medium">{paymentConfig.bankAccountHolder}</span>
                      </div>
                    </div>
                  </div>
                )}

                <QRDisplay
                  bankQrUrl={order.dynamicQrUrl ?? paymentConfig.bankQrUrl}
                  cryptoQrUrl={paymentConfig.cryptoQrUrl}
                  transferContent={order.transferContent || order.orderCode}
                  autoConfirm={order.autoConfirm && !!order.dynamicQrUrl}
                  amount={order.totalAmount}
                  discounted={(order.discountAmount ?? 0) > 0}
                />
              </>
            )}

            {/* Upload section — only when Pending */}
            {isPending && (
              <div className="bg-[#252019] border border-[#3d352a] p-5">
                <h3 className="text-sm font-semibold text-[#ede6db] mb-1">Xác nhận thanh toán</h3>
                {order.autoConfirm && (
                  <p className="text-xs text-[#7a6f63] mb-3">
                    Chuyển đúng số tiền và nội dung thì <b className="text-[#b5a898]">không cần gửi ảnh</b> — trang này tự cập nhật trong khoảng 1 phút. Chỉ gửi ảnh nếu chuyển sai nội dung.
                  </p>
                )}

                {!uploaded ? (
                  <>
                    {/* File input */}
                    <div className="border-2 border-dashed border-[#3d352a] p-6 text-center hover:border-[#c9a96e]/50 transition-colors cursor-pointer"
                      onClick={() => document.getElementById("proof-upload")?.click()}>
                      {selectedFile ? (
                        <div className="relative inline-block">
                          <img loading="lazy" decoding="async"
                            src={URL.createObjectURL(selectedFile)}
                            alt="Preview"
                            className="max-h-[200px] mx-auto rounded"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-[#7a6f63] mx-auto mb-2" />
                          <p className="text-sm text-[#7a6f63]">Click để chọn ảnh chuyển khoản</p>
                          <p className="text-xs text-[#5a4f43] mt-1">Chấp nhận mọi định dạng ảnh (tối đa 50MB)</p>
                        </div>
                      )}
                      <input
                        id="proof-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </div>

                    {uploadError && (
                      <p className="text-xs text-red-400 mt-2">{uploadError}</p>
                    )}

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <button
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                        className="flex-1 bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {uploading ? (
                          <MoxicLoader size="sm" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {uploading ? "Đang tải lên..." : "Tôi đã chuyển khoản"}
                      </button>
                      <button
                        onClick={() => navigate("/games")}
                        className="flex-1 bg-transparent border border-[#3d352a] hover:bg-[#2d261e] text-[#7a6f63] hover:text-[#ede6db] py-2.5 text-sm transition-colors"
                      >
                        Chuyển sau - chờ tư vấn
                      </button>
                    </div>
                  </>
                ) : (
                  /* Upload success state */
                  <div className="text-center py-4">
                    <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-[#ede6db] font-medium">Đã gửi ảnh xác nhận</p>
                    <p className="text-xs text-[#7a6f63] mt-1">Vui lòng chờ admin duyệt đơn hàng.</p>
                  </div>
                )}
              </div>
            )}

            {/* Already submitted state */}
            {isAwaitingConfirmation && order.paymentProofUrl && (
              <div className="bg-[#252019] border border-[#3d352a] p-5">
                <h3 className="text-sm font-semibold text-[#ede6db] mb-3">Ảnh chuyển khoản đã gửi</h3>
                <img loading="lazy" decoding="async"
                  src={order.paymentProofUrl}
                  alt="Payment proof"
                  className="max-h-[300px] mx-auto rounded border border-[#3d352a]"
                />
              </div>
            )}

            {/* Note */}
            <div className="bg-[#2d261e]/50 border border-[#3d352a]/50 px-5 py-4">
              <p className="text-xs text-[#7a6f63] leading-relaxed">
                Sau khi chuyển khoản, vui lòng upload ảnh xác nhận hoặc chọn "Chuyển sau" để được tư vấn. 
                Thời gian cài game: 15-30 phút từ khi xác nhận.
              </p>
            </div>

            {/* Continue shopping */}
            <div className="text-center pt-4">
              <Link
                to="/games"
                className="inline-flex items-center gap-2 bg-[#c9a96e] hover:bg-[#d4b87a] text-[#1a1714] px-8 py-3 text-sm font-semibold transition-colors"
              >
                <ShoppingCart className="w-4 h-4" /> Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

