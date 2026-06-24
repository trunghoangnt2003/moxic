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
  Monitor,
  AlertCircle,
  Clock,
  X,
  ChevronDown,
} from "lucide-react";

interface MediaItem {
  id: string;
  objectKey: string;
  isPrimary: boolean;
  displayOrder: number;
  presignedUrl?: string;
}

interface SysReq {
  os: string;
  processor: string;
  memory: string;
  graphics: string;
  storage: string;
}

interface Rating {
  source: string;
  score: number;
  maxScore: number;
  label: string;
}

interface QueuedFile {
  file: File;
  previewUrl: string;
}

interface SelectOption {
  id: string;
  name: string;
}

const emptyReq = (): SysReq => ({ os: "", processor: "", memory: "", graphics: "", storage: "" });
const emptyRating = (): Rating => ({ source: "", score: 0, maxScore: 10, label: "" });

function MultiSelect({ options, selected, onChange, placeholder }: {
  options: SelectOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selectedNames = options.filter(o => selected.includes(o.id)).map(o => o.name);
  const unselected = options.filter(o => !selected.includes(o.id));

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div
        className="steam-input flex items-center flex-wrap gap-1 min-h-[34px] cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        {selectedNames.length === 0 ? (
          <span className="text-steam-muted/50 text-sm">{placeholder}</span>
        ) : (
          selectedNames.map(n => (
            <span key={n} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-steam-blue/15 text-steam-blue border border-steam-blue/20">
              {n}
            </span>
          ))
        )}
        <ChevronDown size={14} className="ml-auto text-steam-muted flex-shrink-0" />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-steam-surface-3 border border-steam-border rounded-sm shadow-lg max-h-48 overflow-auto">
          {unselected.length === 0 && selected.length === options.length ? (
            <div className="px-3 py-2 text-xs text-steam-muted">All selected</div>
          ) : (
            options.map(o => (
              <div
                key={o.id}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors` }
                onClick={() => toggle(o.id)}
              >
                <div className="w-3.5 h-3.5 rounded border flex items-center justify-center">
                  {selected.includes(o.id) && <Check size={10} className="text-black" />}
                </div>
                {o.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
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
  const [genreIds, setGenreIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState("Available");
  const [releaseDate, setReleaseDate] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [minReq, setMinReq] = useState<SysReq>(emptyReq());
  const [recReq, setRecReq] = useState<SysReq>(emptyReq());
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [created, setCreated] = useState(false);

  // Reference data
  const [genreOptions, setGenreOptions] = useState<SelectOption[]>([]);
  const [tagOptions, setTagOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/admin/genres")).then(r => r.json()).then(setGenreOptions);
    fetch(apiUrl("/api/admin/tags")).then(r => r.json()).then(setTagOptions);
  }, []);

  useEffect(() => {
    if (id) {
      fetch(apiUrl(`/api/admin/games/${id}`))
        .then((r) => r.json())
        .then((g) => {
          setName(g.name);
          setDescription(g.description);
          setOriginalPrice(g.originalPrice);
          setSalePrice(g.salePrice);
          setGenreIds(g.genres?.map((ge: any) => ge.id) || []);
          setTagIds(g.tags?.map((t: any) => t.id) || []);
          setStatus(g.status);
          setReleaseDate(g.releaseDate?.split("T")[0] || "");
          setIsFeatured(g.isFeatured || false);
          setMedia(g.media || []);
          if (g.systemRequirements) {
            setMinReq(g.systemRequirements.minimum || emptyReq());
            setRecReq(g.systemRequirements.recommended || emptyReq());
          }
          setRatings(g.ratings || []);
          setGameId(id);
        });
    }
    return () => { queuedFiles.forEach((qf) => URL.revokeObjectURL(qf.previewUrl)); };
  }, [id]);

  const buildBody = () => ({
    name, description, originalPrice, salePrice,
    genreIds, tagIds, status,
    releaseDate: releaseDate || null,
    isFeatured,
    systemRequirements: { minimum: minReq, recommended: recReq },
    ratings,
  });

  const uploadToGame = async (targetId: string, qf: QueuedFile) => {
    const formData = new FormData();
    formData.append("file", qf.file);
    const res = await fetch(apiUrl(`/api/admin/games/${targetId}/media`), {
      method: "POST", body: formData,
    });
    if (!res.ok) throw new Error((await res.text()) || "Upload failed");
    return await res.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = buildBody();
    try {
      if (gameId) {
        await fetch(apiUrl(`/api/admin/games/${gameId}`), {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        navigate("/games");
      } else {
        const res = await fetch(apiUrl("/api/admin/games"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error || "Failed to create game");
          return;
        }
        const data = await res.json();
        const newId = data.id;
        setGameId(newId);
        setCreated(true);
        window.history.replaceState(null, "", /games//edit);

        for (const qf of queuedFiles) {
          try {
            const d = await uploadToGame(newId, qf);
            setMedia((prev) => [...prev, { ...d, presignedUrl: d.presignedUrl }]);
          } catch {}
        }
        setQueuedFiles([]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploadError("");
    const file = e.target.files[0];

    if (!gameId) {
      const previewUrl = URL.createObjectURL(file);
      setQueuedFiles((prev) => [...prev, { file, previewUrl }]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const d = await uploadToGame(gameId, { file, previewUrl: "" });
      setMedia((prev) => [...prev, { ...d, presignedUrl: d.presignedUrl }]);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeQueued = (i: number) => {
    const qf = queuedFiles[i];
    URL.revokeObjectURL(qf.previewUrl);
    setQueuedFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!gameId) return;
    await fetch(apiUrl(`/api/admin/games/${gameId}/media/${mediaId}`), { method: "DELETE" });
    setMedia((prev) => prev.filter((m) => m.id !== mediaId));
  };

  const handleSetPrimary = async (mediaId: string) => {
    if (!gameId) return;
    await fetch(apiUrl(`/api/admin/games/${gameId}/media/${mediaId}/primary`), { method: "PUT" });
    setMedia((prev) => prev.map((m) => ({ ...m, isPrimary: m.id === mediaId })));
  };

  const addRating = () => setRatings((prev) => [...prev, emptyRating()]);
  const removeRating = (i: number) => setRatings((prev) => prev.filter((_, idx) => idx !== i));
  const updateRating = (i: number, field: keyof Rating, value: any) =>
    setRatings((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  const updateReq = (setter: React.Dispatch<React.SetStateAction<SysReq>>, field: keyof SysReq, value: string) =>
    setter((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/games")} className="p-1.5 rounded text-steam-muted hover:text-steam-text hover:bg-steam-surface-2 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">{gameId ? "Edit Game" : "New Game"}</h1>
          <p className="text-xs text-steam-muted mt-0.5">{gameId ? "Update details and manage media" : "Add a new game to the catalog"}</p>
        </div>
      </div>

      {created && (
        <div className="flex items-center gap-2 bg-steam-green/10 border border-steam-green/30 rounded px-4 py-2.5 text-sm text-steam-green">
          <Check size={16} /> Game created! Now add screenshots and cover art below.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Basic Info */}
          <div className="bg-steam-surface border border-steam-border rounded-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">Basic Info</h2>
            <div>
              <label className="block text-xs text-steam-muted mb-1.5 font-medium">Game Name</label>
              <input placeholder="e.g. Halo Infinite" value={name} onChange={(e) => setName(e.target.value)} className="w-full steam-input" required />
            </div>
            <div>
              <label className="block text-xs text-steam-muted mb-1.5 font-medium">Description</label>
              <textarea placeholder="Game description..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full steam-input h-28 resize-none" required />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isFeatured" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="rounded border-steam-border bg-steam-surface-3" />
              <label htmlFor="isFeatured" className="text-sm text-steam-text cursor-pointer">Featured on homepage carousel</label>
            </div>
          </div>

          {/* Pricing & Classification */}
          <div className="bg-steam-surface border border-steam-border rounded-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">Pricing & Classification</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-steam-muted mb-1.5 font-medium">Original Price (₫)</label><input type="number" placeholder="0" value={originalPrice} onChange={(e) => setOriginalPrice(Number(e.target.value))} className="w-full steam-input font-mono" required /></div>
              <div><label className="block text-xs text-steam-muted mb-1.5 font-medium">Sale Price (₫)</label><input type="number" placeholder="0" value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value))} className="w-full steam-input font-mono" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-steam-muted mb-1.5 font-medium">Genres</label>
                <MultiSelect options={genreOptions} selected={genreIds} onChange={setGenreIds} placeholder="Select genres..." />
              </div>
              <div>
                <label className="block text-xs text-steam-muted mb-1.5 font-medium">Tags</label>
                <MultiSelect options={tagOptions} selected={tagIds} onChange={setTagIds} placeholder="Select tags..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs text-steam-muted mb-1.5 font-medium">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full steam-input">
                  <option value="Available">Available</option>
                  <option value="Preorder">Preorder</option>
                </select>
              </div>
              <div><label className="block text-xs text-steam-muted mb-1.5 font-medium">Release Date</label><input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="w-full steam-input" /></div>
            </div>
          </div>

          {/* System Requirements */}
          <div className="bg-steam-surface border border-steam-border rounded-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest flex items-center gap-2"><Monitor size={14} /> System Requirements</h2>
            {(["Minimum", "Recommended"] as const).map((label) => {
              const req = label === "Minimum" ? minReq : recReq;
              const setter = label === "Minimum" ? setMinReq : setRecReq;
              return (
                <div key={label}>
                  <h3 className="text-xs font-medium text-steam-text mb-2">{label}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {([["os", "OS"], ["processor", "CPU"], ["memory", "RAM"], ["graphics", "GPU"], ["storage", "Storage"]] as const).map(([field, fieldLabel]) => (
                      <div key={field} className={field === "storage" || field === "graphics" ? "col-span-2" : ""}>
                        <label className="block text-[11px] text-steam-muted mb-1">{fieldLabel}</label>
                        <input value={req[field]} onChange={(e) => updateReq(setter, field, e.target.value)} className="w-full steam-input text-xs" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ratings */}
          <div className="bg-steam-surface border border-steam-border rounded-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest flex items-center gap-2"><Star size={14} /> Ratings</h2>
              <button onClick={addRating} className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border text-xs px-2 py-1"><Plus size={12} /> Add Rating</button>
            </div>
            {ratings.length === 0 && <p className="text-xs text-steam-muted/50 text-center py-4">No ratings added yet</p>}
            {ratings.map((r, i) => (
              <div key={i} className="bg-steam-surface-3 border border-steam-border rounded-sm p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-steam-muted font-medium">Rating #{i + 1}</span>
                  <button onClick={() => removeRating(i)} className="p-1 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"><Trash2 size={12} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[11px] text-steam-muted mb-1">Source</label><input value={r.source} onChange={(e) => updateRating(i, "source", e.target.value)} className="w-full steam-input text-xs" /></div>
                  <div><label className="block text-[11px] text-steam-muted mb-1">Label</label><input value={r.label} onChange={(e) => updateRating(i, "label", e.target.value)} className="w-full steam-input text-xs" /></div>
                  <div><label className="block text-[11px] text-steam-muted mb-1">Score</label><input type="number" min="0" max="100" step="0.1" value={r.score} onChange={(e) => updateRating(i, "score", Number(e.target.value))} className="w-full steam-input text-xs font-mono" /></div>
                  <div><label className="block text-[11px] text-steam-muted mb-1">Max Score</label><input type="number" min="1" max="100" value={r.maxScore} onChange={(e) => updateRating(i, "maxScore", Number(e.target.value))} className="w-full steam-input text-xs font-mono" /></div>
                </div>
              </div>
            ))}
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button onClick={handleSubmit} disabled={saving} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {gameId ? "Update Game" : "Create Game"}
            </button>
            <button onClick={() => navigate("/games")} className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border">Cancel</button>
          </div>
        </div>

        {/* Media */}
        <div className="space-y-4">
          <div className="bg-steam-surface border border-steam-border rounded-sm p-5">
            <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest mb-4">Media</h2>

            <label className="flex flex-col items-center justify-center gap-2 bg-steam-surface-3 border-2 border-dashed border-steam-border rounded-sm p-6 cursor-pointer hover:border-steam-blue/50 hover:bg-steam-blue/5 transition-all">
              {uploading ? <Loader2 size={22} className="text-steam-blue animate-spin" /> : (
                <><Upload size={22} className="text-steam-muted" /><span className="text-xs text-steam-muted text-center leading-relaxed">Click to upload<br /><span className="text-steam-muted/50">JPG, PNG, WebP — 5MB max</span></span></>
              )}
              <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>

            {!gameId && queuedFiles.length === 0 && media.length === 0 && (
              <p className="text-[11px] text-steam-muted/50 text-center mt-2">Images will upload after game is created</p>
            )}

            {uploadError && (
              <div className="flex items-center gap-1.5 mt-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/20">
                <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400">{uploadError}</span>
              </div>
            )}

            {queuedFiles.map((qf, i) => (
              <div key={i} className="mt-3 bg-steam-surface-3 border border-steam-border rounded-sm overflow-hidden">
                <div className="aspect-video bg-steam-bg">
                  <img src={qf.previewUrl} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="inline-flex items-center gap-1 text-xs text-steam-muted"><Clock size={11} /> Pending</span>
                  <button onClick={() => removeQueued(i)} className="p-1 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}

            <div className="mt-3 space-y-3">
              {media.map((m) => (
                <div key={m.id} className="bg-steam-surface-3 border border-steam-border rounded-sm overflow-hidden card-hover">
                  {m.presignedUrl && <div className="aspect-video bg-steam-bg"><img src={m.presignedUrl} className="w-full h-full object-cover" alt="" /></div>}
                  <div className="flex items-center justify-between px-3 py-2">
                    <button onClick={() => handleSetPrimary(m.id)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors">
                      <Star size={11} fill={m.isPrimary ? "currentColor" : "none"} />{m.isPrimary ? "Primary" : "Set"}
                    </button>
                    <button onClick={() => handleDeleteMedia(m.id)} className="p-1 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
