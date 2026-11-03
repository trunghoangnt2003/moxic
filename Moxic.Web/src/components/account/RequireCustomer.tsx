import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useMe } from "../../hooks/useAccount";
import { PageLoader } from "../shared/MoxicLoader";

/** Route guard for /account/*: guests are sent to /login with a redirect back. */
export default function RequireCustomer() {
  const location = useLocation();
  const { data: me, isLoading } = useMe();

  if (isLoading) return <PageLoader />;

  if (!me) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  return <Outlet />;
}
