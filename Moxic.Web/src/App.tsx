import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import AppLayout from "./components/layout/AppLayout";
import { PageLoader } from "./components/shared/MoxicLoader";
import GlobalLoader from "./components/shared/GlobalLoader";
import { NotFoundPage } from "./components/shared/EmptyStates";
import { Toaster } from "react-hot-toast";

const HomePage = lazy(() => import("./pages/HomePage"));
const GamesPage = lazy(() => import("./pages/GamesPage"));
const GameDetailPage = lazy(() => import("./pages/GameDetailPage"));
const PreorderPage = lazy(() => import("./pages/PreorderPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ConfirmationPage = lazy(() => import("./pages/ConfirmationPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const LuckySpinPage = lazy(() => import("./pages/LuckySpinPage"));

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
              <Route path="/games/:id" element={<GameDetailPage />} />
              <Route path="/preorder" element={<PreorderPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/confirmation/:orderCode" element={<ConfirmationPage />} />
              <Route path="/lucky-spin" element={<LuckySpinPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
