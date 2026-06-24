import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Package,
  Tag,
  Clock,
  AlertCircle,
  LayoutGrid,
  Table2,
  Gamepad2,
} from "lucide-react";

interface Game {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  genre: string;
  tags: string;
  status: string;
  imageCount: number;
  createdAt: string;
  primaryImage?: string;
}

export default function GameList() {
  const [games, setGames] = useState<Game[]>([]);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`/api/admin/games${search ? `?search=${search}` : ""}`)
      .then((r) => r.json())
      .then(setGames);
  }, [search]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/admin/games/${id}`, { method: "DELETE" });
      setGames((prev) => prev.filter((g) => g.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const totalGames = games.length;
  const preorders = games.filter((g) => g.status === "Preorder").length;
  const available = games.filter((g) => g.status === "Available").length;
  const discountAvg =
    games.length > 0
      ? Math.round(
          games.reduce((s, g) => s + (1 - g.salePrice / g.originalPrice) * 100, 0) /
            games.length
        )
      : 0;

  const formatPrice = (n: number) => n.toLocaleString() + "₫";

  const statusBadge = (status: string) => {
    if (status === "Preorder")
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-steam-blue/10 text-steam-blue border border-steam-blue/20">
          <Clock size={10} />
          Preorder
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-steam-green/10 text-steam-green border border-steam-green/20">
        Available
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">Games</h1>
          <p className="text-xs text-steam-muted mt-0.5">{totalGames} titles in catalog</p>
        </div>
        <button
          onClick={() => navigate("/games/new")}
          className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue"
        >
          <Plus size={14} />
          New Game
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: totalGames, icon: Package, color: "text-steam-blue bg-steam-blue/10" },
          { label: "Available", value: available, icon: Tag, color: "text-steam-green bg-steam-green/10" },
          { label: "Pre-orders", value: preorders, icon: Clock, color: "text-steam-blue bg-steam-blue/10" },
          { label: "Avg Discount", value: discountAvg + "%", icon: Gamepad2, color: "text-steam-gold bg-steam-gold/10" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-steam-surface border border-steam-border rounded-sm p-3.5 card-hover cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded flex items-center justify-center ${s.color}`}>
                <s.icon size={15} />
              </div>
              <div>
                <p className="text-base font-bold text-white font-mono tracking-tight">{s.value}</p>
                <p className="text-[11px] text-steam-muted">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-steam-surface border border-steam-border rounded-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-steam-border">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-steam-muted" />
            <input
              type="text"
              placeholder="Search games..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-steam-surface-3 border border-steam-border rounded pl-8 pr-3 py-1.5 text-sm text-steam-text placeholder-steam-muted/50 focus:outline-none focus:border-steam-blue/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 bg-steam-surface-3 rounded p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "table" ? "bg-steam-blue/20 text-steam-blue" : "text-steam-muted hover:text-steam-text"
              }`}
              title="Table view"
            >
              <Table2 size={14} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors ${
                viewMode === "grid" ? "bg-steam-blue/20 text-steam-blue" : "text-steam-muted hover:text-steam-text"
              }`}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* Grid view — Steam library style */}
        {viewMode === "grid" ? (
          games.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
              {games.map((g) => (
                <div
                  key={g.id}
                  onClick={() => navigate(`/games/${g.id}/edit`)}
                  className="group bg-steam-surface-3 border border-steam-border rounded-sm overflow-hidden card-hover cursor-pointer"
                >
                  {/* Cover art placeholder */}
                  <div className="aspect-[16/9] bg-steam-bg flex items-center justify-center overflow-hidden">
                    {g.primaryImage ? (
                      <img src={g.primaryImage} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <Gamepad2 size={32} className="text-steam-border" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3 space-y-1.5">
                    <p className="text-sm font-semibold text-white truncate leading-tight group-hover:text-steam-blue transition-colors">
                      {g.name}
                    </p>
                    <p className="text-[11px] text-steam-muted truncate">{g.genre || "—"}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-steam-muted line-through">
                          {formatPrice(g.originalPrice)}
                        </span>
                        <span className="text-sm font-bold text-steam-gold font-mono">
                          {formatPrice(g.salePrice)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      {statusBadge(g.status)}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/games/${g.id}/edit`); }}
                          className="p-1 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(g.id, g.name); }}
                          disabled={deleting === g.id}
                          className="p-1 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"
                        >
                          {deleting === g.id ? <AlertCircle size={12} className="animate-pulse" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Package size={36} className="mx-auto mb-3 text-steam-border" />
              <p className="text-sm text-steam-muted">No games yet</p>
              <p className="text-xs text-steam-muted/60 mt-1">Create your first game to get started</p>
            </div>
          )
        ) : (
          /* Table view */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-steam-border bg-steam-bg/30">
                  {["Name", "Genre", "Price", "Status", "Tags", "Media", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[11px] font-medium text-steam-muted uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-steam-border">
                {games.map((g) => (
                  <tr
                    key={g.id}
                    className="hover:bg-steam-surface-2/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/games/${g.id}/edit`)}
                        className="font-medium text-steam-text hover:text-steam-blue transition-colors text-left"
                      >
                        {g.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-steam-muted text-xs">{g.genre || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-steam-muted line-through text-[11px]">
                          {formatPrice(g.originalPrice)}
                        </span>
                        <span className="text-steam-gold font-semibold font-mono text-sm">
                          {formatPrice(g.salePrice)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(g.status)}</td>
                    <td className="px-4 py-3">
                      {g.tags ? (
                        <div className="flex flex-wrap gap-1">
                          {g.tags.split(",").map((t) => (
                            <span
                              key={t.trim()}
                              className="px-1.5 py-0.5 rounded text-[11px] bg-steam-surface-3 text-steam-muted border border-steam-border"
                            >
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-steam-muted/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-steam-muted text-xs">{g.imageCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => navigate(`/games/${g.id}/edit`)}
                          className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"
                          title="Edit"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(g.id, g.name)}
                          disabled={deleting === g.id}
                          className="p-1.5 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors disabled:opacity-30"
                          title="Delete"
                        >
                          {deleting === g.id ? (
                            <AlertCircle size={13} className="animate-pulse" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {games.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-steam-muted">
                      <Package size={28} className="mx-auto mb-2 text-steam-border" />
                      <p className="text-sm">No games yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
