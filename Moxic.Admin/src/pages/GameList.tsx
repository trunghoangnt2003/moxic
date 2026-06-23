import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
}

export default function GameList() {
  const [games, setGames] = useState<Game[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/admin/games${search ? `?search=${search}` : ""}`)
      .then(r => r.json())
      .then(setGames);
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this game?")) return;
    await fetch(`/api/admin/games/${id}`, { method: "DELETE" });
    setGames(games.filter(g => g.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Games</h1>
        <Link to="/games/new" className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded text-sm">
          + New Game
        </Link>
      </div>

      <input
        type="text" placeholder="Search games..."
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full bg-[#2a2a2a] border border-gray-700 rounded p-3 mb-4 text-white text-sm"
      />

      <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-left">
              <th className="p-3">Name</th>
              <th className="p-3">Genre</th>
              <th className="p-3">Price</th>
              <th className="p-3">Status</th>
              <th className="p-3">Tags</th>
              <th className="p-3">Images</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map(g => (
              <tr key={g.id} className="border-b border-gray-800 hover:bg-[#252525]">
                <td className="p-3 text-white">{g.name}</td>
                <td className="p-3 text-gray-400">{g.genre}</td>
                <td className="p-3">
                  <span className="text-gray-500 line-through mr-2">{g.originalPrice.toLocaleString()}đ</span>
                  <span className="text-orange-400">{g.salePrice.toLocaleString()}đ</span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${g.status === "Preorder" ? "bg-blue-900 text-blue-300" : "bg-green-900 text-green-300"}`}>
                    {g.status}
                  </span>
                </td>
                <td className="p-3 text-gray-400">{g.tags}</td>
                <td className="p-3 text-gray-400">{g.imageCount}</td>
                <td className="p-3 flex gap-2">
                  <Link to={`/games/${g.id}/edit`} className="text-blue-400 hover:text-blue-300 text-xs">Edit</Link>
                  <button onClick={() => handleDelete(g.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {games.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-600">No games yet. Create your first game!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
