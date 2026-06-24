import { useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Tag,
  AlertCircle,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface TagItem {
  id: string;
  name: string;
}

export default function TagList() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => fetch(apiUrl("/api/admin/tags").then(r => r.json()).then(setTags);
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving("new");
    setError("");
    try {
      const res = await fetch(apiUrl("/api/admin/tags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to create");
        return;
      }
      setNewName("");
      setAdding(false);
      await load();
    } finally { setSaving(null); }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(id);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/admin/tags/"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to update");
        return;
      }
      setEditingId(null);
      await load();
    } finally { setSaving(null); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete tag ${name}?`)) return;
    setError("");
    try {
      const res = await fetch(apiUrl("/api/admin/tags/"), { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to delete");
        return;
      }
      await load();
    } catch { setError("Failed to delete"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-tight">Tags</h1>
          <p className="text-xs text-steam-muted mt-0.5">{tags.length} tags</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue">
            <Plus size={14} /> Add Tag
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {adding && (
        <div className="bg-steam-surface border border-steam-border rounded-sm p-3">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              placeholder="Tag name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1 steam-input text-sm"
            />
            <button onClick={handleCreate} disabled={saving === "new"} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover">
              {saving === "new" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button onClick={() => { setAdding(false); setNewName(""); }} className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div className="bg-steam-surface border border-steam-border rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-steam-border bg-steam-bg/30">
              <th className="text-left px-4 py-3 text-[11px] font-medium text-steam-muted uppercase tracking-wider">Name</th>
              <th className="text-right px-4 py-3 text-[11px] font-medium text-steam-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-steam-border">
            {tags.map((t) => (
              <tr key={t.id} className="hover:bg-steam-surface-2/50 transition-colors">
                <td className="px-4 py-3">
                  {editingId === t.id ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleUpdate(t.id)} className="steam-input text-sm flex-1" />
                      <button onClick={() => handleUpdate(t.id)} disabled={saving === t.id} className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover px-2 py-1">
                        {saving === t.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      </button>
                      <button onClick={() => { setEditingId(null); }} className="steam-btn bg-steam-surface-3 text-steam-muted hover:text-steam-text border border-steam-border px-2 py-1">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-steam-text">{t.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-0.5">
                    <button onClick={() => { setEditingId(t.id); setEditName(t.name); }} className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors" title="Edit">
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tags.length === 0 && (
              <tr><td colSpan={2} className="px-4 py-12 text-center text-steam-muted"><Tag size={28} className="mx-auto mb-2 text-steam-border" /><p className="text-sm">No tags yet</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
