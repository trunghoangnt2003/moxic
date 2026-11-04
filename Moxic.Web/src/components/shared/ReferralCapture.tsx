import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useMe } from "../../hooks/useAccount";
import { enterReferral } from "../../lib/loyaltyApi";

const KEY = "moxic.ref";

/** Remembers ?ref=CODE from an invite link and applies it once the visitor is signed in. */
export default function ReferralCapture() {
  const [params] = useSearchParams();
  const { data: me } = useMe();
  const ref = params.get("ref");

  useEffect(() => {
    if (!ref || !/^[A-Za-z0-9]{4,16}$/.test(ref)) return;
    try {
      localStorage.setItem(KEY, ref.toUpperCase());
    } catch {
      /* ignore */
    }
  }, [ref]);

  useEffect(() => {
    if (!me) return;
    let code: string | null = null;
    try {
      code = localStorage.getItem(KEY);
    } catch {
      return;
    }
    if (!code) return;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    enterReferral(code)
      .then((r) => toast.success(r.message, { duration: 6000 }))
      .catch(() => {
        /* not eligible (own code, old account, already referred), stay silent */
      });
  }, [me]);

  return null;
}
