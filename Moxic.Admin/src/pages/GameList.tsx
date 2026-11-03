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
  BookMarked,
  MessageCircle,
} from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";

interface GenreTag {
  id: string;
  name: string;
}

interface Game {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  genres: GenreTag[];
  tags: GenreTag[];
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
    const params = search ? "?search=" + encodeURIComponent(search) : "";
    apiFetch(apiUrl("/api/admin/games" + params))
      .then((r) => r.json())
      .then(setGames);
  }, [search]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm("Delete \"" + name + "\"?")) return;
    setDeleting(id);
    try {
      await apiFetch(apiUrl("/api/admin/games/" + id), { method: "DELETE" });
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

  const formatPrice = (n: number) => n.toLocaleString() + "\u0111";

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

  const actionButtons = (g: Game) => (
    <div className="flex items-center gap-0.5">
      <button
        onClick={(e) => { e.stopPropagation(); navigate("/games/" + g.id + "/edit"); }}
        className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"
        title="Edit"
      >
        <Edit3 size={13} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); navigate("/games/" + g.id + "/reviews"); }}
        className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"
        title="Reviews"
      >
        <MessageCircle size={13} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleDelete(g.id, g.name); }}
        disabled={deleting === g.id}
        className="p-1.5 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors disabled:opacity-30"
        title="Delete"
      >
        {deleting === g.id ? <AlertCircle size={13} className="animate-pulse" /> : <Trash2 size={13} />}
      </button>
    </div>
  );

  const actionButtonsSmall = (g: Game) => (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => navigate("/games/" + g.id + "/edit")}
        className="p-1 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"
        title="Edit"
      >
        <Edit3 size={11} />
      </button>
      <button
        onClick={() => navigate("/games/" + g.id + "/reviews")}
        className="p-1 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"
        title="Reviews"
      >
        <MessageCircle size={11} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleDelete(g.id, g.name); }}
        disabled={deleting === g.id}
        className="p-1 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors disabled:opacity-30"
        title="Delete"
      >
        {deleting === g.id ? <AlertCircle size={11} className="animate-pulse" /> : <Trash2 size={11} />}
      </button>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">Games</h1>
          <p className="text-xs text-steam-muted mt-0.5 truncate">{totalGames} titles in catalog</p>
        </div>
        <button
          onClick={() => navigate("/games/new")}
          className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue flex-shrink-0 text-xs md:text-sm px-3 md:px-5"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New Game</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        {[
          { label: "Total", value: totalGames, icon: Package, color: "text-steam-blue bg-steam-blue/10" },
          { label: "Active", value: available, icon: Tag, color: "text-steam-green bg-steam-green/10" },
          { label: "Pre-order", value: preorders, icon: Clock, color: "text-steam-blue bg-steam-blue/10" },
          { label: "Avg Disc.", value: discountAvg + "%", icon: Gamepad2, color: "text-steam-gold bg-steam-gold/10" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-steam-surface border border-steam-border rounded-sm p-2.5 md:p-3.5 card-hover cursor-pointer"
          >
            <div className="flex items-center gap-2 md:gap-3">
              <div className={"w-7 h-7 md:w-8 md:h-8 rounded flex items-center justify-center flex-shrink-0 " + s.color}>
                <s.icon size={13} />
              </div>
              <div className="min-w-0">
                <p className="text-sm md:text-base font-bold text-white font-mono tracking-tight">{s.value}</p>
                <p className="text-[10px] md:text-[11px] text-steam-muted truncate">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-steam-surface border border-steam-border rounded-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 md:px-4 py-3 border-b border-steam-border">
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-steam-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-steam-surface-3 border border-steam-border rounded pl-8 pr-3 py-1.5 text-sm text-steam-text placeholder-steam-muted/50 focus:outline-none focus:border-steam-blue/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 bg-steam-surface-3 rounded p-0.5 self-end sm:self-auto">
            <button
              onClick={() => setViewMode("table")}
              className={"p-1.5 rounded transition-colors " + (viewMode === "table" ? "bg-steam-blue/20 text-steam-blue" : "text-steam-muted hover:text-steam-text")}
              title="Table view"
            >
              <Table2 size={14} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={"p-1.5 rounded transition-colors " + (viewMode === "grid" ? "bg-steam-blue/20 text-steam-blue" : "text-steam-muted hover:text-steam-text")}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* Grid view */}
        {viewMode === "grid" ? (
          games.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 p-3 md:p-4">
              {games.map((g) => (
                <div
                  key={g.id}
                  onClick={() => navigate("/games/" + g.id + "/edit")}
                  className="group bg-steam-surface-3 border border-steam-border rounded-sm overflow-hidden card-hover cursor-pointer"
                >
                  <div className="aspect-[16/9] bg-steam-bg flex items-center justify-center overflow-hidden">
                    {g.primaryImage ? (
                      <img src={g.primaryImage} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <Gamepad2 size={24} className="text-steam-border" />
                    )}
                  </div>
                  <div className="p-2 md:p-3 space-y-1 md:space-y-1.5">
                    <p className="text-xs md:text-sm font-semibold text-white truncate leading-tight group-hover:text-steam-blue transition-colors">
                      {g.name}
                    </p>
                    <p className="text-[10px] md:text-[11px] text-steam-muted truncate leading-tight">
                      {g.genres?.length > 0 ? g.genres.map(ge => ge.name).join(", ") : "\u2014"}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div className="flex items-center gap-1 md:gap-1.5">
                        <span className="text-[10px] md:text-[11px] text-steam-muted line-through">{formatPrice(g.originalPrice)}</span>
                        <span className="text-xs md:text-sm font-bold text-steam-gold font-mono">{formatPrice(g.salePrice)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      {statusBadge(g.status)}
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); navigate("/games/" + g.id + "/edit"); }} className="p-1 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"><Edit3 size={11} /></button>
                        <button onClick={(e) => { e.stopPropagation(); navigate("/games/" + g.id + "/reviews"); }} className="p-1 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors" title="Reviews"><MessageCircle size={11} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(g.id, g.name); }} disabled={deleting === g.id} className="p-1 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors disabled:opacity-30" title="Delete">
                          {deleting === g.id ? <AlertCircle size={11} className="animate-pulse" /> : <Trash2 size={11} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 md:py-16 text-center">
              <Package size={28} className="mx-auto mb-3 text-steam-border" />
              <p className="text-sm text-steam-muted">No games yet</p>
              <p className="text-xs text-steam-muted/60 mt-1">Create your first game to get started</p>
            </div>
          )
        ) : (
          /* Table view - desktop */
          <div className="overflow-x-auto">
            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="border-b border-steam-border bg-steam-bg/30">
                  {["Name", "Genres", "Price", "Status", "Tags", "Media", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-steam-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-steam-border">
                {games.map((g) => (
                  <tr key={g.id} className="hover:bg-steam-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate("/games/" + g.id + "/edit")} className="font-medium text-steam-text hover:text-steam-blue transition-colors text-left">{g.name}</button>
                    </td>
                    <td className="px-4 py-3">
                      {g.genres?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {g.genres.map((ge) => (
                            <span key={ge.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-steam-surface-3 text-steam-muted border border-steam-border">
                              <BookMarked size={10} /> {ge.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-steam-muted/40">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-steam-muted line-through text-[11px]">{formatPrice(g.originalPrice)}</span>
                        <span className="text-steam-gold font-semibold font-mono text-sm">{formatPrice(g.salePrice)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(g.status)}</td>
                    <td className="px-4 py-3">
                      {g.tags?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {g.tags.map((t) => (
                            <span key={t.id} className="px-1.5 py-0.5 rounded text-[11px] bg-steam-surface-3 text-steam-muted border border-steam-border">{t.name}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-steam-muted/40">{"\u2014"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-steam-muted text-xs">{g.imageCount}</td>
                    <td className="px-4 py-3 text-right">{actionButtons(g)}</td>
                  </tr>
                ))}
                {games.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-steam-muted"><Package size={28} className="mx-auto mb-2 text-steam-border" /><p className="text-sm">No games yet</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile card list - only shown in table view on small screens */}
        {viewMode === "table" && (
          <div className="block md:hidden divide-y divide-steam-border">
            {games.length > 0 ? games.map((g) => (
              <div key={g.id} className="px-3 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => navigate("/games/" + g.id + "/edit")}
                    className="text-sm font-semibold text-steam-text hover:text-steam-blue transition-colors text-left leading-tight flex-1"
                  >
                    {g.name}
                  </button>
                  {statusBadge(g.status)}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-steam-muted line-through">{formatPrice(g.originalPrice)}</span>
                    <span className="text-steam-gold font-semibold font-mono text-sm">{formatPrice(g.salePrice)}</span>
                  </div>
                  {actionButtonsSmall(g)}
                </div>
                {g.genres?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {g.genres.map((ge) => (
                      <span key={ge.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-steam-surface-3 text-steam-muted border border-steam-border"><BookMarked size={9} /> {ge.name}</span>
                    ))}
                  </div>
                )}
              </div>
            )) : (
              <div className="py-12 text-center">
                <Package size={24} className="mx-auto mb-2 text-steam-border" />
                <p className="text-sm text-steam-muted">No games yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
