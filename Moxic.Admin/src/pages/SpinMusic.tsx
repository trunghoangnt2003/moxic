import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Edit3, Loader2, Music, Trash2, Upload, X } from "lucide-react";
import { apiFetch, apiUrl } from "../lib/api";
import { readApiError } from "../lib/luckySpinAdmin";

interface MusicTrack {
  id: string;
  name: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  isActive: boolean;
  createdAt: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = ["mp3", "ogg", "m4a"];

const fmtMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("vi-VN");
const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, "").slice(0, 100);

export default function SpinMusic() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const load = async () => {
    try {
      const res = await apiFetch(apiUrl("/api/admin/spin-music"));
      if (!res.ok) {
        setError(await readApiError(res, "Không tải được kho nhạc"));
        return;
      }
      setTracks(await res.json());
      setError("");
    } catch {
      setError("Không tải được kho nhạc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pickFile = (f: File | null) => {
    setUploadError("");
    if (!f) {
      setFile(null);
      return;
    }
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    if (!ALLOWED_EXT.includes(ext)) {
      setUploadError("Chỉ hỗ trợ file MP3, OGG hoặc M4A.");
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setUploadError("File nhạc tối đa 10MB.");
      setFile(null);
      return;
    }
    setFile(f);
    if (!name.trim()) setName(baseName(f.name));
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadError("Vui lòng chọn file nhạc.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (name.trim()) fd.append("name", name.trim());
      const res = await apiFetch(apiUrl("/api/admin/spin-music"), { method: "POST", body: fd });
      if (!res.ok) {
        setUploadError(
          res.status === 413 ? "File nhạc tối đa 10MB." : await readApiError(res, "Không tải nhạc lên được")
        );
        return;
      }
      setFile(null);
      setName("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch {
      setUploadError("Không tải nhạc lên được");
    } finally {
      setUploading(false);
    }
  };

  const patch = async (t: MusicTrack, body: { name?: string; isActive?: boolean }) => {
    setBusyId(t.id);
    setError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/spin-music/${t.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readApiError(res, "Không cập nhật được bài nhạc"));
        return false;
      }
      const updated: MusicTrack = await res.json();
      setTracks((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      return true;
    } finally {
      setBusyId(null);
    }
  };

  const saveRename = async (t: MusicTrack) => {
    const trimmed = renameValue.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      setError("Tên bài nhạc phải từ 1 đến 100 ký tự.");
      return;
    }
    if (await patch(t, { name: trimmed })) setRenamingId(null);
  };

  const remove = async (t: MusicTrack) => {
    if (!window.confirm(`Xóa bài nhạc "${t.name}"?`)) return;
    setBusyId(t.id);
    setError("");
    try {
      const res = await apiFetch(apiUrl(`/api/admin/spin-music/${t.id}`), { method: "DELETE" });
      if (!res.ok) {
        setError(await readApiError(res, "Không xóa được bài nhạc"));
        return;
      }
      setTracks((list) => list.filter((x) => x.id !== t.id));
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = tracks.filter((t) => t.isActive).length;

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white font-mono tracking-tight">Kho nhạc</h1>
        <p className="text-xs text-steam-muted mt-0.5">
          Nhạc nền phát khi khách mở hòm Lucky Spin · {activeCount}/{tracks.length} bài đang bật
        </p>
      </div>

      <form onSubmit={upload} className="bg-steam-surface border border-steam-border rounded-sm p-4 md:p-5 space-y-3">
        <h2 className="text-xs font-semibold text-steam-muted uppercase tracking-widest">Tải nhạc lên</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-steam-muted mb-1">File (MP3/OGG/M4A, tối đa 10MB)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".mp3,.ogg,.m4a,audio/mpeg,audio/ogg,audio/mp4"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="w-full steam-input text-xs file:mr-3 file:px-2 file:py-1 file:rounded-sm file:border-0 file:bg-steam-surface-3 file:text-steam-text"
            />
            {file && <p className="text-[11px] text-steam-muted mt-1">{fmtMb(file.size)}</p>}
          </div>
          <div>
            <label className="block text-xs text-steam-muted mb-1">Tên bài</label>
            <input
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mặc định: tên file"
              className="w-full steam-input"
            />
          </div>
        </div>
        {uploadError && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertCircle size={12} className="flex-shrink-0" /> {uploadError}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={uploading || !file}
            className="steam-btn bg-steam-blue text-black hover:bg-steam-blue-hover glow-blue text-xs md:text-sm w-full sm:w-auto justify-center"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Đang tải lên..." : "Tải lên"}
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 flex justify-center text-steam-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="py-12 px-4 text-center text-steam-muted bg-steam-surface border border-steam-border rounded-sm">
          <Music size={28} className="mx-auto mb-2 text-steam-border" />
          <p className="text-sm">Chưa có bài nhạc nào.</p>
          <p className="text-xs mt-1">Mỗi lần khách vào trang mở hòm, một bài đang bật sẽ được chọn ngẫu nhiên.</p>
        </div>
      ) : (
        <div className="bg-steam-surface border border-steam-border rounded-sm divide-y divide-steam-border">
          {tracks.map((t) => (
            <div key={t.id} className={`p-3 md:px-4 space-y-2 ${t.isActive ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-2">
                <Music size={14} className="text-steam-blue flex-shrink-0" />
                {renamingId === t.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      value={renameValue}
                      maxLength={100}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveRename(t);
                        }
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="w-full steam-input py-1 text-sm"
                      aria-label="Tên bài nhạc"
                    />
                    <button
                      onClick={() => saveRename(t)}
                      disabled={busyId === t.id}
                      className="p-1.5 rounded text-steam-green hover:bg-steam-green/10"
                      title="Lưu tên"
                    >
                      {busyId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      className="p-1.5 rounded text-steam-muted hover:text-steam-text"
                      title="Hủy"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-white font-medium truncate flex-1 min-w-0" title={t.name}>
                    {t.name}
                  </p>
                )}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => patch(t, { isActive: !t.isActive })}
                    disabled={busyId === t.id}
                    className={`px-2 py-1 rounded-sm text-[10px] font-semibold border transition-colors ${
                      t.isActive
                        ? "bg-steam-green/10 text-steam-green border-steam-green/30 hover:bg-steam-green/20"
                        : "bg-steam-surface-3 text-steam-muted border-steam-border hover:text-steam-text"
                    }`}
                    title={t.isActive ? "Tắt bài" : "Bật bài"}
                  >
                    {t.isActive ? "BẬT" : "TẮT"}
                  </button>
                  {renamingId !== t.id && (
                    <button
                      onClick={() => {
                        setRenamingId(t.id);
                        setRenameValue(t.name);
                      }}
                      className="p-1.5 rounded text-steam-muted hover:text-steam-blue hover:bg-steam-blue/10 transition-colors"
                      title="Đổi tên"
                    >
                      <Edit3 size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => remove(t)}
                    disabled={busyId === t.id}
                    className="p-1.5 rounded text-steam-muted hover:text-steam-accent hover:bg-steam-accent/10 transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                {t.url ? (
                  <audio controls preload="none" src={t.url} className="w-full sm:max-w-md h-9" />
                ) : (
                  <span className="text-xs text-steam-gold">Không tạo được liên kết phát</span>
                )}
                <span className="text-[11px] text-steam-muted whitespace-nowrap">
                  {fmtMb(t.sizeBytes)} · {fmtDate(t.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
