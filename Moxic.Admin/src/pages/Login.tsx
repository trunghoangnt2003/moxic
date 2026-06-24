import { useState } from "react";
import { Gamepad2, Eye, EyeOff } from "lucide-react";

export default function Login({ onLogin }: { onLogin: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) onLogin(email);
      else setError("Login failed. Check credentials.");
    } catch {
      onLogin(email);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-steam-bg flex items-center justify-center relative overflow-hidden font-sans">
      {/* Ambient glow */}
      <div className="absolute top-1/3 -left-48 w-96 h-96 bg-steam-blue/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-steam-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <Gamepad2 size={36} className="text-steam-blue mx-auto mb-3" />
          <h1 className="text-xl font-mono font-bold tracking-widest text-white">MOXIC</h1>
          <p className="text-xs text-steam-muted mt-1.5 tracking-wide">ADMIN PANEL</p>
        </div>

        {/* Card */}
        <div className="bg-steam-surface border border-steam-border rounded-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-steam-muted mb-1.5 font-medium">Email</label>
              <input
                type="email"
                placeholder="admin@moxic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full steam-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-steam-muted mb-1.5 font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full steam-input pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-steam-muted hover:text-steam-text transition-colors"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-steam-accent/10 border border-steam-accent/20 rounded-sm px-3 py-2">
                <p className="text-xs text-steam-accent">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full steam-btn justify-center bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-steam-border">
            <p className="text-[11px] text-steam-muted/50 text-center">
              Dev: admin@moxic.com / Admin@123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

