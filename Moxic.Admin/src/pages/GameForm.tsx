import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Upload,
  Trash2,
  Star,
  Image,
  Loader2,
  Plus,
  Check,
} from "lucide-react";

interface MediaItem {
  id: string;
  objectKey: string;
  isPrimary: boolean;
  displayOrder: number;
  presignedUrl?: string;
}

export default function GameForm() {
  const { id } = useParams();
  const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

  const [gameId, setGameId] = useState<string | null>(id || null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [originalPrice, setOriginalPrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [genre, setGenre] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("Available");
  const [releaseDate, setReleaseDate] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [created, setCreated] = useState(false);

  // Load game data for edit mode
  useEffect(() => {
    if (id) {
      fetch(`/api/admin/games/${id}`)
        .then((r) => r.json())
        .then((g) => {
          setName(g.name);
          setDescription(g.description);
          setOriginalPrice(g.originalPrice);
          setSalePrice(g.salePrice);
          setGenre(g.genre);
          setTags(g.tags);
          setStatus(g.status);
          setReleaseDate(g.releaseDate?.split("T")[0] || "");
          setMedia(g.media || []);
          setGameId(id);
        });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = {
      name, description, originalPrice, salePrice,
      genre, tags, status,
      releaseDate: releaseDate || null,
    };

    try {
      if (gameId) {
        // Update existing
        await fetch(`/api/admin/games/${gameId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        navigate("/games");
      } else {
        // Create new
        const res = await fetch("/api/admin/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setGameId(data.id);
        setCreated(true);
        // Update URL silently so refresh works
        window.history.replaceState(null, "", `/games/${data.id}/edit`);
        // Load empty media list
        setMedia([]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !gameId) return;
    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/admin/games/${gameId}/media`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setMedia((prev) => [...prev, { ...data, presignedUrl: data.presignedUrl }]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!gameId) return;
    await fetch(`/api/admin/games/${gameId}/media/${mediaId}`, { method: "DELETE" });
    setMedia((prev) => prev.filter((m) => m.id !== mediaId));
  };

  const handleSetPrimary = async (mediaId: string) => {
    if (!gameId) return;
    await fetch(`/api/admin/games/${gameId}/media/${mediaId}/primary`, {
      method: "PUT",
    });
    setMedia((prev) =>
      prev.map((m) => ({ ...m, isPrimary: m.id === mediaId }))
    );
  };

  const canUploadMedia = !!gameId;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/games")}
          className="p-1.5 rounded text-steam-muted hover:text-steam-text hover:bg-steam-surface-2 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">
            {gameId ? "Edit Game" : "New Game"}
          </h1>
          <p className="text-xs text-steam-muted mt-0.5">
            {gameId ? "Update details and manage media" : "Add a new game to the catalog"}
          </p>
        </div>
      </div>

      {/* Success banner */}
      {created && (
        <div className="flex items-center gap-2 bg-steam-green/10 border border-steam-green/30 rounded px-4 py-2.5 text-sm text-steam-green">
          <Check size={16} />
          Game created! Now add screenshots and cover art below.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form fields */}
        <div className="lg:col-span-2 space-y-5">
          {/* Basic info */}
          <div className="bg-steam-surface border border-steam-border rounded-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">
              Basic Info
            </h2>

            <div>
              <label className="block text-xs text-steam-muted mb-1.5 font-medium">Game Name</label>
              <input
                placeholder="e.g. Halo Infinite"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full steam-input"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-steam-muted mb-1.5 font-medium">Description</label>
              <textarea
                placeholder="Game description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full steam-input h-28 resize-none"
                required
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-steam-surface border border-steam-border rounded-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">
              Pricing & Classification
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-steam-muted mb-1.5 font-medium">Original Price (₫)</label>
                <input
                  type="number" placeholder="0"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(Number(e.target.value))}
                  className="w-full steam-input font-mono" required
                />
              </div>
              <div>
                <label className="block text-xs text-steam-muted mb-1.5 font-medium">Sale Price (₫)</label>
                <input
                  type="number" placeholder="0"
                  value={salePrice}
                  onChange={(e) => setSalePrice(Number(e.target.value))}
                  className="w-full steam-input font-mono" required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-steam-muted mb-1.5 font-medium">Genre</label>
                <input
                  placeholder="e.g. Action, RPG"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full steam-input"
                />
              </div>
              <div>
                <label className="block text-xs text-steam-muted mb-1.5 font-medium">Tags</label>
                <input
                  placeholder="Hot, Sắp ra mắt"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full steam-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-steam-muted mb-1.5 font-medium">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full steam-input"
                >
                  <option value="Available">Available</option>
                  <option value="Preorder">Preorder</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-steam-muted mb-1.5 font-medium">Release Date</label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full steam-input"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {gameId ? "Update Game" : "Create Game"}
            </button>
            <button
              onClick={() => navigate("/games")}
              className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Media section — visible after game is created or in edit mode */}
        <div className="space-y-4">
          <div className="bg-steam-surface border border-steam-border rounded-sm p-5">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest mb-4">
              Media
            </h2>

            {canUploadMedia ? (
              <>
                {/* Upload button */}
                <label className="flex flex-col items-center justify-center gap-2 bg-steam-surface-3 border-2 border-dashed border-steam-border rounded-sm p-6 cursor-pointer hover:border-steam-blue/50 hover:bg-steam-blue/5 transition-all">
                  {uploading ? (
                    <Loader2 size={22} className="text-steam-blue animate-spin" />
                  ) : (
                    <>
                      <Upload size={22} className="text-steam-muted" />
                      <span className="text-xs text-steam-muted text-center leading-relaxed">
                        Click to upload<br />
                        <span className="text-steam-muted/50">JPG, PNG, WebP — 5MB max</span>
                      </span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>

                {/* Media grid */}
                <div className="mt-4 space-y-3">
                  {media.map((m) => (
                    <div
                      key={m.id}
                      className="bg-steam-surface-3 border border-steam-border rounded-sm overflow-hidden card-hover"
                    >
                      {m.presignedUrl && (
                        <div className="aspect-video bg-steam-bg">
                          <img
                            src={m.presignedUrl}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between px-3 py-2">
                        <button
                          onClick={() => handleSetPrimary(m.id)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            m.isPrimary
                              ? "bg-steam-gold/15 text-steam-gold"
                              : "bg-steam-surface text-steam-muted hover:text-steam-gold border border-steam-border"
                          }`}
                        >
                          <Star size={11} fill={m.isPrimary ? "currentColor" : "none"} />
                          {m.isPrimary ? "Primary" : "Set"}
                        </button>
                        <button
                          onClick={() => handleDeleteMedia(m.id)}
                          className="p-1 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {media.length === 0 && (
                    <div className="text-center py-6">
                      <Image size={24} className="mx-auto mb-2 text-steam-border" />
                      <p className="text-xs text-steam-muted">No images yet</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Plus size={28} className="mx-auto mb-3 text-steam-border" />
                <p className="text-xs text-steam-muted leading-relaxed">
                  Create the game first<br />
                  <span className="text-steam-muted/50">then add images here</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
