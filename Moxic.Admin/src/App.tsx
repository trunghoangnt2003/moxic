import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { useState } from "react";
import GameList from "./pages/GameList";
import GameForm from "./pages/GameForm";
import PaymentConfig from "./pages/PaymentConfig";
import Login from "./pages/Login";

function App() {
  const [user, setUser] = useState<string | null>(
    () => localStorage.getItem("admin_user")
  );

  const handleLogin = (email: string) => {
    localStorage.setItem("admin_user", email);
    setUser(email);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_user");
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0f0f0f] text-gray-200">
        <nav className="bg-[#1a1a1a] border-b border-gray-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-orange-500 font-bold text-xl">Moxic Admin</Link>
            <Link to="/games" className="text-gray-400 hover:text-white text-sm">Games</Link>
            <Link to="/payment-config" className="text-gray-400 hover:text-white text-sm">Payment</Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user}</span>
            <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-red-400">Logout</button>
          </div>
        </nav>
        <main className="p-6 max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/games" />} />
            <Route path="/games" element={<GameList />} />
            <Route path="/games/new" element={<GameForm />} />
            <Route path="/games/:id/edit" element={<GameForm />} />
            <Route path="/payment-config" element={<PaymentConfig />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
