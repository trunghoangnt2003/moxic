import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

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
  const isEdit = !!id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [originalPrice, setOriginalPrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [genre, setGenre] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("Available");
  const [releaseDate, setReleaseDate] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    if (id) {
      fetch(`/api/admin/games/${id}`)
        .then(r => r.json())
        .then(g => {
          setName(g.name);
          setDescription(g.description);
          setOriginalPrice(g.originalPrice);
          setSalePrice(g.salePrice);
          setGenre(g.genre);
          setTags(g.tags);
          setStatus(g.status);
          setReleaseDate(g.releaseDate?.split("T")[0] || "");
          setMedia(g.media || []);
        });
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name, description, originalPrice, salePrice, genre, tags, status, releaseDate: releaseDate || null };

    if (isEdit) {
      await fetch(`/api/admin/games/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
    } else {
      const res = await fetch("/api/admin/games", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const data = await res.json();
      navigate(`/games/${data.id}/edit`);
      return;
    }
    navigate("/games");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/admin/games/${id}/media`, { method: "POST", body: formData });
    const data = await res.json();
    setMedia([...media, { ...data, presignedUrl: data.presignedUrl }]);
  };

  const handleDeleteMedia = async (mediaId: string) => {
    await fetch(`/api/admin/games/${id}/media/${mediaId}`, { method: "DELETE" });
    setMedia(media.filter(m => m.id !== mediaId));
  };

  const handleSetPrimary = async (mediaId: string) => {
    await fetch(`/api/admin/games/${id}/media/${mediaId}/primary`, { method: "PUT" });
    setMedia(media.map(m => ({ ...m, isPrimary: m.id === mediaId })));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? "Edit Game" : "New Game"}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <input placeholder="Game Name" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-[#2a2a2a] border border-gray-700 rounded p-3 text-white text-sm" required />

        <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)}
          className="w-full bg-[#2a2a2a] border border-gray-700 rounded p-3 text-white text-sm h-24" required />

        <div className="grid grid-cols-2 gap-4">
          <input type="number" placeholder="Original Price" value={originalPrice} onChange={e => setOriginalPrice(Number(e.target.value))}
            className="bg-[#2a2a2a] border border-gray-700 rounded p-3 text-white text-sm" required />
          <input type="number" placeholder="Sale Price" value={salePrice} onChange={e => setSalePrice(Number(e.target.value))}
            className="bg-[#2a2a2a] border border-gray-700 rounded p-3 text-white text-sm" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input placeholder="Genre (e.g. Action, RPG)" value={genre} onChange={e => setGenre(e.target.value)}
            className="bg-[#2a2a2a] border border-gray-700 rounded p-3 text-white text-sm" />
          <input placeholder="Tags (comma-separated: Hot, Sắp ra mắt)" value={tags} onChange={e => setTags(e.target.value)}
            className="bg-[#2a2a2a] border border-gray-700 rounded p-3 text-white text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="bg-[#2a2a2a] border border-gray-700 rounded p-3 text-white text-sm">
            <option value="Available">Available</option>
            <option value="Preorder">Preorder</option>
          </select>
          <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)}
            className="bg-[#2a2a2a] border border-gray-700 rounded p-3 text-white text-sm" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded text-sm">
            {isEdit ? "Update Game" : "Create Game"}
          </button>
          <button type="button" onClick={() => navigate("/games")} className="text-gray-500 hover:text-white text-sm">
            Cancel
          </button>
        </div>
      </form>

      {isEdit && (
        <div className="mt-8 max-w-2xl">
          <h2 className="text-lg font-semibold text-white mb-3">Game Media</h2>
          <label className="block bg-[#2a2a2a] border border-dashed border-gray-600 rounded p-4 text-center cursor-pointer hover:border-orange-500 mb-4">
            <span className="text-gray-400 text-sm">Upload Image (jpg, png, webp — max 5MB)</span>
            <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleUpload} className="hidden" />
          </label>

          <div className="grid grid-cols-4 gap-3">
            {media.map(m => (
              <div key={m.id} className="bg-[#2a2a2a] rounded border border-gray-700 overflow-hidden">
                {m.presignedUrl && <img src={m.presignedUrl} className="w-full h-32 object-cover" alt="" />}
                <div className="p-2 flex items-center justify-between">
                  <button onClick={() => handleSetPrimary(m.id)}
                    className={`text-xs px-2 py-1 rounded ${m.isPrimary ? "bg-orange-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                    {m.isPrimary ? "Primary" : "Set"}
                  </button>
                  <button onClick={() => handleDeleteMedia(m.id)} className="text-red-400 text-xs">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
