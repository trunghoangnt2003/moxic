import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import AppLayout from "./components/layout/AppLayout";
import { PageLoader } from "./components/shared/MoxicLoader";
import GlobalLoader from "./components/shared/GlobalLoader";
import RequireCustomer from "./components/account/RequireCustomer";
import { NotFoundPage } from "./components/shared/EmptyStates";
import { Toaster } from "react-hot-toast";

const HomePage = lazy(() => import("./pages/HomePage"));
const GamesPage = lazy(() => import("./pages/GamesPage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const RentPage = lazy(() => import("./pages/RentPage"));
const RentalsPage = lazy(() => import("./pages/RentalsPage"));
const RentalDetailPage = lazy(() => import("./pages/RentalDetailPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const GameDetailPage = lazy(() => import("./pages/GameDetailPage"));
const PreorderPage = lazy(() => import("./pages/PreorderPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ConfirmationPage = lazy(() => import("./pages/ConfirmationPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const LuckySpinGalleryPage = lazy(() => import("./pages/LuckySpinGalleryPage"));
const LuckySpinPage = lazy(() => import("./pages/LuckySpinPage"));
const PointsHistoryPage = lazy(() => import("./pages/PointsHistoryPage"));
const CouponWalletPage = lazy(() => import("./pages/CouponWalletPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const OrderHistoryPage = lazy(() => import("./pages/OrderHistoryPage"));
const OrderHistoryDetailPage = lazy(() => import("./pages/OrderHistoryDetailPage"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 2 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoader />
      <Toaster position="top-right" toastOptions={{
        style: { background: "#18181b", color: "#f4f4f5", border: "1px solid #3f3f46" },
        duration: 4000,
      }} />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/rent" element={<RentPage />} />
              <Route path="/games/:id" element={<GameDetailPage />} />
              <Route path="/preorder" element={<PreorderPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/confirmation/:orderCode" element={<ConfirmationPage />} />
              <Route path="/lucky-spin" element={<LuckySpinGalleryPage />} />
              <Route path="/lucky-spin/:slug" element={<LuckySpinPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route element={<RequireCustomer />}>
                <Route path="/account/orders" element={<OrderHistoryPage />} />
                <Route path="/account/orders/:orderCode" element={<OrderHistoryDetailPage />} />
                <Route path="/account/points" element={<PointsHistoryPage />} />
                <Route path="/account/coupons" element={<CouponWalletPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/account/rentals" element={<RentalsPage />} />
                <Route path="/account/rentals/:code" element={<RentalDetailPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
