import type { GameListItem, GameDetail, GameReview, SystemRequirement, GenreTag } from "../types/game";

/* ──── helpers ──────── */
function ss(id: string, n: number): GameDetail["media"] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${id}-ss-${i}`,
    objectKey: `${id}/ss-${i}.jpg`,
    isPrimary: i === 0,
    displayOrder: i + 1,
    presignedUrl: `https://picsum.photos/seed/${id}-ss-${i}/1280/720`,
  }));
}

type RatingsTuple = [number, number, number];

function buildRatings(t: RatingsTuple) {
  return [
    { source: "Metacritic", score: t[0], maxScore: 100, label: "Đánh giá chung" },
    { source: "OpenCritic", score: t[1], maxScore: 100, label: "Nhà phê bình" },
    { source: "Xbox Store", score: t[2], maxScore: 100, label: "Người dùng" },
  ];
}

function gt(name: string): GenreTag { return { id: name.toLowerCase().replace(/\s+/g, "-"), name }; }

/* ──── Seed reviews ──────── */
const reviewUsers = [
  "Minh Anh", "Hoàng Long", "Thu Trang", "Đức Huy", "Phương Linh",
  "Tuấn Kiệt", "Bảo Ngọc", "Thanh Tùng", "Mai Chi", "Quốc Bình"
];

const reviewContents = [
  "Lần đầu mua trên Moxic, hơi lo nhưng cài game nhanh và uy tín. Sẽ ủng hộ dài dài!",
  "Mua game thứ 3 rồi, giá rẻ hơn Store nhiều. Anh chủ support nhiệt tình lắm ạ.",
  "Đặt GTA VI pre-order, giá tốt nhất mình tìm được. Chờ ngày ra mắt thôi!",
  "Cài game trong 20 phút, không phải lo gì. Store uy tín, recommend cho ae.",
  "So sánh giá thì Moxic rẻ hơn hẳn, quan trọng là uy tín. Mua đi đừng ngại!",
  "Hơi nghi ngờ vì giá rẻ quá, nhưng anh chủ tư vấn kỹ và cài game thành công.",
  "Đã mua Elden Ring bản Deluxe, giá chỉ bằng nửa Store. Anh chủ support tận tình.",
  "Lần 3 mua ở đây rồi, chưa bao giờ thất vọng. Cài nhanh - gọn - uy tín.",
  "Pre-order game mới nhất, giá ưu đãi hơn hẳn bên ngoài. Tin tưởng Moxic!",
  "Được bạn giới thiệu, thử mua 1 lần. Từ đó thành khách quen luôn. 5 sao nhé!"
];

function buildSeedReviews(gameId: string, count: number): GameReview[] {
  const reviews: GameReview[] = [];
  for (let i = 0; i < count; i++) {
    const ui = Math.floor(Math.random() * reviewUsers.length);
    const ci = Math.floor(Math.random() * reviewContents.length);
    const rating = Math.random() < 0.7 ? 5 : 4;
    const daysAgo = Math.floor(Math.random() * 60) + 1;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    reviews.push({
      id: `${gameId}-review-${i}`,
      userName: reviewUsers[ui],
      avatarUrl: `https://i.pravatar.cc/40?u=review-${gameId}-${i}`,
      rating,
      content: reviewContents[ci],
      createdAt: d.toISOString(),
    });
  }
  return reviews;
}

const T1_MIN: SystemRequirement = { os: "Windows 10 64-bit", processor: "Intel Core i5-8400 / AMD Ryzen 3 3300X", memory: "12 GB RAM", graphics: "NVIDIA GeForce GTX 1060 6GB / AMD Radeon RX 580", storage: "100 GB SSD" };
const T1_REC: SystemRequirement = { os: "Windows 11 64-bit", processor: "Intel Core i7-8700K / AMD Ryzen 5 3600X", memory: "16 GB RAM", graphics: "NVIDIA GeForce RTX 2070 / AMD Radeon RX 6700 XT", storage: "100 GB SSD" };
const T2_MIN: SystemRequirement = { os: "Windows 10 64-bit", processor: "Intel Core i5-7400 / AMD Ryzen 3 1200", memory: "8 GB RAM", graphics: "NVIDIA GeForce GTX 960 / AMD Radeon R9 380", storage: "60 GB HDD" };
const T2_REC: SystemRequirement = { os: "Windows 11 64-bit", processor: "Intel Core i7-6700K / AMD Ryzen 5 2600X", memory: "12 GB RAM", graphics: "NVIDIA GeForce GTX 1660 Ti / AMD Radeon RX 5600 XT", storage: "60 GB SSD" };
const T3_MIN: SystemRequirement = { os: "Windows 10 64-bit", processor: "Intel Core i3-6100 / AMD Ryzen 3 2200G", memory: "6 GB RAM", graphics: "NVIDIA GeForce GTX 950 / AMD Radeon R7 370", storage: "20 GB HDD" };
const T3_REC: SystemRequirement = { os: "Windows 10 64-bit", processor: "Intel Core i5-7400 / AMD Ryzen 3 3200G", memory: "8 GB RAM", graphics: "NVIDIA GeForce GTX 1050 Ti / AMD Radeon RX 470", storage: "20 GB SSD" };
const SPORTS_MIN: SystemRequirement = { os: "Windows 10 64-bit", processor: "Intel Core i5-6600K / AMD Ryzen 3 1300X", memory: "8 GB RAM", graphics: "NVIDIA GeForce GTX 960 / AMD Radeon R9 380", storage: "50 GB HDD" };
const SPORTS_REC: SystemRequirement = { os: "Windows 11 64-bit", processor: "Intel Core i7-7700 / AMD Ryzen 5 2600", memory: "12 GB RAM", graphics: "NVIDIA GeForce GTX 1660 / AMD Radeon RX 590", storage: "50 GB SSD" };

interface SeedEntry {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  genres: GenreTag[];
  tags: GenreTag[];
  status: "Available" | "Preorder";
  releaseDate?: string;
  coverImageUrl: string;
  description: string;
  screenshots: number;
  ratings: RatingsTuple;
  spec: "t1" | "t2" | "t3" | "sports";
  relatedIds: string[];
  purchaseCount: number;
}

const reqSpec = { t1: { minimum: T1_MIN, recommended: T1_REC }, t2: { minimum: T2_MIN, recommended: T2_REC }, t3: { minimum: T3_MIN, recommended: T3_REC }, sports: { minimum: SPORTS_MIN, recommended: SPORTS_REC } } as const;

const entries: SeedEntry[] = [
  { id: "elden-ring", name: "ELDEN RING", originalPrice: 1499000, salePrice: 749000, genres: [gt("Action RPG")], tags: [gt("Hot"), gt("Bestseller")], status: "Available", coverImageUrl: "https://images7.alphacoders.com/439/439636.jpg", description: "ELDEN RING là game hành động nhập vai phiêu lưu trong thế giới Vòng Địa Ngục rộng lớn...", screenshots: 5, ratings: [96, 94, 88], spec: "t1", relatedIds: ["cyberpunk-2077", "lies-of-p", "diablo-4", "starfield"], purchaseCount: 2847 },
  { id: "cyberpunk-2077", name: "Cyberpunk 2077", originalPrice: 1499000, salePrice: 599000, genres: [gt("Open World")], tags: [gt("Hot"), gt("Bestseller")], status: "Available", coverImageUrl: "https://picsum.photos/seed/cyberpunk-cover/400/500", description: "Cyberpunk 2077 là game nhập vai thế giới mở lấy bối cảnh Night City...", screenshots: 5, ratings: [86, 85, 78], spec: "t1", relatedIds: ["starfield", "elden-ring", "assassins-creed-shadows", "gta-vi"], purchaseCount: 3921 },
  { id: "ea-fc-26", name: "EA SPORTS FC 26", originalPrice: 1499000, salePrice: 1049000, genres: [gt("Sports")], tags: [gt("New")], status: "Available", coverImageUrl: "https://picsum.photos/seed/eafc26-cover/400/500", description: "EA SPORTS FC 26 mang đến trải nghiệm bóng đá chân thực nhất...", screenshots: 4, ratings: [82, 80, 75], spec: "sports", relatedIds: ["forza-motorsport", "cod-black-ops-6", "halo-infinite"], purchaseCount: 1563 },
  { id: "cod-black-ops-6", name: "Call of Duty: Black Ops 6", originalPrice: 1799000, salePrice: 899000, genres: [gt("Shooter")], tags: [gt("Hot"), gt("Bestseller")], status: "Available", coverImageUrl: "https://picsum.photos/seed/codbo6-cover/400/500", description: "Black Ops 6 là phần mới nhất trong series bắn súng huyền thoại...", screenshots: 5, ratings: [88, 86, 82], spec: "t1", relatedIds: ["halo-infinite", "stalker-2", "cyberpunk-2077"], purchaseCount: 2104 },
  { id: "assassins-creed-shadows", name: "Assassin's Creed Shadows", originalPrice: 1499000, salePrice: 1199000, genres: [gt("Action RPG")], tags: [gt("New")], status: "Available", coverImageUrl: "https://picsum.photos/seed/acshadows-cover/400/500", description: "Assassin's Creed Shadows đưa người chơi đến Nhật Bản thời phong kiến...", screenshots: 5, ratings: [84, 82, 76], spec: "t1", relatedIds: ["elden-ring", "cyberpunk-2077", "dragon-age-dreadwolf", "indiana-jones"], purchaseCount: 987 },
  { id: "halo-infinite", name: "Halo Infinite", originalPrice: 999000, salePrice: 499000, genres: [gt("Shooter")], tags: [gt("Sale")], status: "Available", coverImageUrl: "https://picsum.photos/seed/halo-cover/400/500", description: "Halo Infinite tiếp nối câu chuyện của Master Chief...", screenshots: 4, ratings: [81, 80, 77], spec: "t2", relatedIds: ["cod-black-ops-6", "stalker-2", "starfield"], purchaseCount: 1783 },
  { id: "forza-motorsport", name: "Forza Motorsport", originalPrice: 1299000, salePrice: 649000, genres: [gt("Racing")], tags: [gt("Bestseller")], status: "Available", coverImageUrl: "https://picsum.photos/seed/forza-cover/400/500", description: "Forza Motorsport là tựa game đua xe chân thực nhất trên Xbox...", screenshots: 5, ratings: [84, 83, 80], spec: "t2", relatedIds: ["msfs-2024", "ea-fc-26", "cyberpunk-2077"], purchaseCount: 1245 },
  { id: "starfield", name: "Starfield", originalPrice: 1499000, salePrice: 599000, genres: [gt("Open World"), gt("RPG")], tags: [gt("Bestseller")], status: "Available", coverImageUrl: "https://picsum.photos/seed/starfield-cover/400/500", description: "Starfield là game nhập vai không gian từ Bethesda...", screenshots: 5, ratings: [83, 81, 74], spec: "t2", relatedIds: ["cyberpunk-2077", "elden-ring", "halo-infinite"], purchaseCount: 2056 },
  { id: "gears-of-war-eday", name: "Gears of War: E-Day", originalPrice: 1499000, salePrice: 0, genres: [gt("Action"), gt("Shooter")], tags: [gt("Preorder")], status: "Preorder", releaseDate: "2026-10-15", coverImageUrl: "https://picsum.photos/seed/gearseday-cover/400/500", description: "Gears of War: E-Day là phần tiền truyện...", screenshots: 4, ratings: [92, 90, 85], spec: "t1", relatedIds: ["halo-infinite", "cod-black-ops-6", "fable-4", "avowed"], purchaseCount: 647 },
  { id: "gta-vi", name: "Grand Theft Auto VI", originalPrice: 1799000, salePrice: 1499000, genres: [gt("Open World"), gt("Action Adventure")], tags: [gt("Preorder"), gt("Hot")], status: "Preorder", releaseDate: "2026-12-31", coverImageUrl: "https://picsum.photos/seed/gtavi-cover/400/500", description: "Grand Theft Auto VI đưa người chơi trở lại Vice City...", screenshots: 5, ratings: [97, 95, 90], spec: "t1", relatedIds: ["cyberpunk-2077", "assassins-creed-shadows", "elden-ring"], purchaseCount: 4521 },
  { id: "hellblade-2", name: "Senua's Saga: Hellblade II", originalPrice: 999000, salePrice: 499000, genres: [gt("Action Adventure")], tags: [gt("New")], status: "Available", coverImageUrl: "https://picsum.photos/seed/hellblade2-cover/400/500", description: "Senua's Saga: Hellblade II tiếp tục hành trình của Senua...", screenshots: 4, ratings: [88, 86, 83], spec: "t2", relatedIds: ["indiana-jones", "lies-of-p", "dragon-age-dreadwolf"], purchaseCount: 834 },
  { id: "dragon-age-dreadwolf", name: "Dragon Age: Dreadwolf", originalPrice: 1299000, salePrice: 909000, genres: [gt("RPG")], tags: [gt("Bestseller")], status: "Available", coverImageUrl: "https://picsum.photos/seed/dreadwolf-cover/400/500", description: "Dragon Age: Dreadwolf tiếp nối câu chuyện từ Inquisition...", screenshots: 4, ratings: [85, 83, 78], spec: "t2", relatedIds: ["avowed", "elden-ring", "diablo-4", "lies-of-p"], purchaseCount: 1123 },
  { id: "avowed", name: "Avowed", originalPrice: 1499000, salePrice: 0, genres: [gt("RPG")], tags: [gt("Preorder")], status: "Preorder", releaseDate: "2026-08-20", coverImageUrl: "https://picsum.photos/seed/avowed-cover/400/500", description: "Avowed là game nhập vai góc nhìn thứ nhất từ Obsidian...", screenshots: 4, ratings: [87, 85, 80], spec: "t2", relatedIds: ["dragon-age-dreadwolf", "fable-4", "elden-ring", "starfield"], purchaseCount: 456 },
  { id: "fable-4", name: "Fable", originalPrice: 1499000, salePrice: 0, genres: [gt("Action RPG")], tags: [gt("Preorder")], status: "Preorder", releaseDate: "2026-11-05", coverImageUrl: "https://picsum.photos/seed/fable4-cover/400/500", description: "Fable trở lại với phần mới nhất trên Xbox Series X|S...", screenshots: 4, ratings: [90, 88, 84], spec: "t2", relatedIds: ["avowed", "gears-of-war-eday", "dragon-age-dreadwolf", "gta-vi"], purchaseCount: 789 },
  { id: "dead-as-disco", name: "Dead as Disco", originalPrice: 499000, salePrice: 399000, genres: [gt("Indie")], tags: [gt("Sale")], status: "Available", coverImageUrl: "https://picsum.photos/seed/deadasdisco-cover/400/500", description: "Dead as Disco là game bắn súng roguelike đầy màu sắc...", screenshots: 3, ratings: [76, 74, 72], spec: "t3", relatedIds: ["hollow-knight-silksong", "lies-of-p", "hellblade-2"], purchaseCount: 345 },
  { id: "msfs-2024", name: "Microsoft Flight Simulator 2024", originalPrice: 1499000, salePrice: 1049000, genres: [gt("Simulation")], tags: [gt("New")], status: "Available", coverImageUrl: "https://picsum.photos/seed/msfs2024-cover/400/500", description: "Microsoft Flight Simulator 2024 mang đến trải nghiệm bay chân thực nhất...", screenshots: 4, ratings: [91, 89, 85], spec: "t1", relatedIds: ["forza-motorsport", "cyberpunk-2077", "starfield"], purchaseCount: 567 },
  { id: "hollow-knight-silksong", name: "Hollow Knight: Silksong", originalPrice: 499000, salePrice: 0, genres: [gt("Action"), gt("Indie")], tags: [gt("Preorder")], status: "Preorder", releaseDate: "2026-07-15", coverImageUrl: "https://picsum.photos/seed/silksong-cover/400/500", description: "Hollow Knight: Silksong là phần tiếp theo của Hollow Knight huyền thoại...", screenshots: 4, ratings: [93, 91, 87], spec: "t3", relatedIds: ["dead-as-disco", "lies-of-p", "hellblade-2"], purchaseCount: 1234 },
  { id: "stalker-2", name: "STALKER 2: Heart of Chornobyl", originalPrice: 1299000, salePrice: 909000, genres: [gt("Shooter"), gt("Horror")], tags: [gt("Bestseller")], status: "Available", coverImageUrl: "https://picsum.photos/seed/stalker2-cover/400/500", description: "STALKER 2: Heart of Chornobyl là game bắn súng sinh tồn...", screenshots: 5, ratings: [82, 80, 76], spec: "t2", relatedIds: ["cod-black-ops-6", "halo-infinite", "cyberpunk-2077"], purchaseCount: 1987 },
  { id: "indiana-jones", name: "Indiana Jones and the Great Circle", originalPrice: 1499000, salePrice: 1049000, genres: [gt("Action Adventure")], tags: [gt("New")], status: "Available", coverImageUrl: "https://picsum.photos/seed/indianajones-cover/400/500", description: "Indiana Jones and the Great Circle là game hành động phiêu lưu...", screenshots: 5, ratings: [86, 84, 80], spec: "t2", relatedIds: ["hellblade-2", "assassins-creed-shadows", "elden-ring"], purchaseCount: 678 },
  { id: "diablo-4", name: "Diablo IV", originalPrice: 1499000, salePrice: 749000, genres: [gt("Action RPG")], tags: [gt("Hot"), gt("Bestseller")], status: "Available", coverImageUrl: "https://picsum.photos/seed/diablo4-cover/400/500", description: "Diablo IV là game nhập vai hành động kinh dị tối tăm nhất...", screenshots: 5, ratings: [87, 85, 78], spec: "t2", relatedIds: ["elden-ring", "lies-of-p", "dragon-age-dreadwolf", "avowed"], purchaseCount: 2890 },
  { id: "mortal-kombat-1", name: "Mortal Kombat 1", originalPrice: 1299000, salePrice: 649000, genres: [gt("Fighting")], tags: [], status: "Available", coverImageUrl: "https://picsum.photos/seed/mk1-cover/400/500", description: "Mortal Kombat 1 khởi động lại vũ trụ MK...", screenshots: 4, ratings: [83, 81, 77], spec: "t2", relatedIds: ["ea-fc-26", "cod-black-ops-6", "halo-infinite"], purchaseCount: 1456 },
  { id: "lies-of-p", name: "Lies of P", originalPrice: 999000, salePrice: 499000, genres: [gt("Action RPG")], tags: [gt("Bestseller")], status: "Available", coverImageUrl: "https://picsum.photos/seed/liesofp-cover/400/500", description: "Lies of P là game soulslike lấy cảm hứng từ câu chuyện Pinocchio...", screenshots: 5, ratings: [84, 82, 80], spec: "t2", relatedIds: ["elden-ring", "hellblade-2", "hollow-knight-silksong", "diablo-4"], purchaseCount: 1678 },
];

export const seedGames: GameListItem[] = entries.map((e) => ({
  id: e.id, name: e.name, originalPrice: e.originalPrice, salePrice: e.salePrice,
  genres: e.genres, tags: e.tags, status: e.status, releaseDate: e.releaseDate,
  coverImageUrl: e.coverImageUrl,
}));

export function getGameById(id: string): GameListItem | undefined {
  return seedGames.find((g) => g.id === id);
}

export function toGameDetail(game: GameListItem): GameDetail {
  const entry = entries.find((e) => e.id === game.id);
  const reviews = entry ? buildSeedReviews(entry.id, 5 + Math.floor(Math.random() * 4)) : [];
  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 5.0;
  return {
    id: game.id, name: game.name, description: entry?.description ?? "",
    originalPrice: game.originalPrice, salePrice: game.salePrice,
    genres: game.genres, tags: game.tags, status: game.status, releaseDate: game.releaseDate,
    media: entry ? ss(entry.id, entry.screenshots) : [],
    ratings: entry ? buildRatings(entry.ratings) : [],
    systemRequirements: entry ? reqSpec[entry.spec] : reqSpec.t3,
    relatedGameIds: entry?.relatedIds ?? [],
    purchaseCount: entry?.purchaseCount ?? 0,
    storeRating: avgRating,
    reviews,
  };
}
