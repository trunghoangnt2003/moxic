import type { GameListItem, GameDetail, SystemRequirement } from "../types/game";

/* ───────── helpers ───────── */
function ss(id: string, n: number): GameDetail["media"] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${id}-ss-${i + 1}`,
    objectKey: `${id}/ss-${i + 1}.jpg`,
    isPrimary: i === 0,
    displayOrder: i + 1,
    presignedUrl: `https://picsum.photos/seed/${id}-ss-${i + 1}/1280/720`,
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

const T1_MIN: SystemRequirement = {
  os: "Windows 10 64-bit",
  processor: "Intel Core i5-8400 / AMD Ryzen 3 3300X",
  memory: "12 GB RAM",
  graphics: "NVIDIA GeForce GTX 1060 6GB / AMD Radeon RX 580",
  storage: "100 GB SSD",
};
const T1_REC: SystemRequirement = {
  os: "Windows 11 64-bit",
  processor: "Intel Core i7-8700K / AMD Ryzen 5 3600X",
  memory: "16 GB RAM",
  graphics: "NVIDIA GeForce RTX 2070 / AMD Radeon RX 6700 XT",
  storage: "100 GB SSD",
};

const T2_MIN: SystemRequirement = {
  os: "Windows 10 64-bit",
  processor: "Intel Core i5-7400 / AMD Ryzen 3 1200",
  memory: "8 GB RAM",
  graphics: "NVIDIA GeForce GTX 960 / AMD Radeon R9 380",
  storage: "60 GB HDD",
};
const T2_REC: SystemRequirement = {
  os: "Windows 11 64-bit",
  processor: "Intel Core i7-6700K / AMD Ryzen 5 2600X",
  memory: "12 GB RAM",
  graphics: "NVIDIA GeForce GTX 1660 Ti / AMD Radeon RX 5600 XT",
  storage: "60 GB SSD",
};

const T3_MIN: SystemRequirement = {
  os: "Windows 10 64-bit",
  processor: "Intel Core i3-6100 / AMD Ryzen 3 2200G",
  memory: "6 GB RAM",
  graphics: "NVIDIA GeForce GTX 950 / AMD Radeon R7 370",
  storage: "20 GB HDD",
};
const T3_REC: SystemRequirement = {
  os: "Windows 10 64-bit",
  processor: "Intel Core i5-7400 / AMD Ryzen 3 3200G",
  memory: "8 GB RAM",
  graphics: "NVIDIA GeForce GTX 1050 Ti / AMD Radeon RX 470",
  storage: "20 GB SSD",
};

const SPORTS_MIN: SystemRequirement = {
  os: "Windows 10 64-bit",
  processor: "Intel Core i5-6600K / AMD Ryzen 3 1300X",
  memory: "8 GB RAM",
  graphics: "NVIDIA GeForce GTX 960 / AMD Radeon R9 380",
  storage: "50 GB HDD",
};
const SPORTS_REC: SystemRequirement = {
  os: "Windows 11 64-bit",
  processor: "Intel Core i7-7700 / AMD Ryzen 5 2600",
  memory: "12 GB RAM",
  graphics: "NVIDIA GeForce GTX 1660 / AMD Radeon RX 590",
  storage: "50 GB SSD",
};

interface SeedEntry {
  id: string;
  name: string;
  originalPrice: number;
  salePrice: number;
  genre: string;
  tags: string;
  status: "Available" | "Preorder";
  releaseDate?: string;
  coverImageUrl: string;
  description: string;
  screenshots: number;
  ratings: RatingsTuple;
  spec: "t1" | "t2" | "t3" | "sports";
  relatedIds: string[];
}

/* eslint-disable */
const reqSpec = {
  t1: { minimum: T1_MIN, recommended: T1_REC },
  t2: { minimum: T2_MIN, recommended: T2_REC },
  t3: { minimum: T3_MIN, recommended: T3_REC },
  sports: { minimum: SPORTS_MIN, recommended: SPORTS_REC },
} as const;

const entries: SeedEntry[] = [
  {
    id: "elden-ring", name: "ELDEN RING", originalPrice: 1499000, salePrice: 749000,
    genre: "Action RPG", tags: "hot,bestseller", status: "Available",
    coverImageUrl: "https://images7.alphacoders.com/439/439636.jpg",
    description: "ELDEN RING là game hành động nhập vai phiêu lưu trong thế giới Vòng Địa Ngục rộng lớn. Người chơi sẽ khám phá những vùng đất bí ẩn, chiến đấu với các boss khổng lồ và khám phá những câu chuyện sâu sắc.\n\nTính năng chính:\n• Thế giới mở rộng lớn với 6 khu vực chính\n• Hệ thống chiến đấu đa dạng với hơn 100 loại vũ khí\n• Tùy biến nhân vật với hàng trăm bộ trang bị\n• Chế độ co-op và PvP trực tuyến\n• Đồ họa thế hệ mới với ray tracing",
    screenshots: 5, ratings: [96, 94, 88], spec: "t1",
    relatedIds: ["cyberpunk-2077", "lies-of-p", "diablo-4", "starfield"],
  },
  {
    id: "cyberpunk-2077", name: "Cyberpunk 2077", originalPrice: 1499000, salePrice: 599000,
    genre: "Open World", tags: "hot,rpg", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/cyberpunk-cover/400/500",
    description: "Cyberpunk 2077 là game nhập vai thế giới mở lấy bối cảnh Night City — một thành phố tương lai nơi công nghệ và con người hòa quyện. Bạn vào vai V, một lính đánh thuê đang tìm kiếm cỗ máy bất tử duy nhất.\n\nTính năng chính:\n• Thế giới mở Night City rộng lớn với 6 quận\n• Hệ thống tùy biến nhân vật sâu sắc\n• Cốt truyện phi tuyến tính với nhiều kết thúc\n• Bản mở rộng Phantom Liberty đi kèm\n• Hỗ trợ DLSS 3.5 và ray tracing",
    screenshots: 5, ratings: [86, 85, 78], spec: "t1",
    relatedIds: ["starfield", "elden-ring", "assassins-creed-shadows", "gta-vi"],
  },
  {
    id: "ea-fc-26", name: "EA SPORTS FC 26", originalPrice: 1499000, salePrice: 1049000,
    genre: "Sports", tags: "sports", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/eafc26-cover/400/500",
    description: "EA SPORTS FC 26 mang đến trải nghiệm bóng đá chân thực nhất với công nghệ HyperMotion V và cơ chế vật lý hoàn toàn mới.\n\nTính năng chính:\n• HyperMotion V — công nghệ mô phỏng vận động chân thực\n• Ultimate Team với hàng ngàn thẻ cầu thủ\n• Career Mode cải tiến với chiến thuật đa dạng\n• Các giải đấu chính thức: Premier League, La Liga, V-League\n• Chế độ Online Seasons và Clubs",
    screenshots: 4, ratings: [82, 80, 75], spec: "sports",
    relatedIds: ["forza-motorsport", "cod-black-ops-6", "halo-infinite"],
  },
  {
    id: "cod-black-ops-6", name: "Call of Duty: Black Ops 6", originalPrice: 1799000, salePrice: 899000,
    genre: "FPS", tags: "hot,action", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/codbo6-cover/400/500",
    description: "Black Ops 6 là phần mới nhất trong series bắn súng huyền thoại. Với chiến dịch campaign đậm chất điện ảnh, multiplayer đỉnh cao và chế độ Zombies hấp dẫn.\n\nTính năng chính:\n• Chiến dịch campaign với cốt truyện gián điệp gay cấn\n• Multiplayer 6v6 với 16 bản đồ mới\n• Chế độ Zombies với vòng chiến vô tận\n• Hệ thống vũ khí với hơn 50 loại súng\n• Omnimovement — cơ chế di chuyển cách mạng",
    screenshots: 5, ratings: [88, 86, 82], spec: "t1",
    relatedIds: ["halo-infinite", "stalker-2", "cyberpunk-2077"],
  },
  {
    id: "assassins-creed-shadows", name: "Assassin's Creed Shadows", originalPrice: 1499000, salePrice: 1199000,
    genre: "Action RPG", tags: "new,rpg", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/acshadows-cover/400/500",
    description: "Assassin's Creed Shadows đưa người chơi đến Nhật Bản thời phong kiến với hai nhân vật chính: Naoe, một sát thủ Shinobi và Yasuke, một Samurai người Châu Phi.\n\nTính năng chính:\n• Hai nhân vật chính với lối chơi khác biệt\n• Thế giới mở Nhật Bản thế kỷ 16\n• Hệ thống parkour và ám sát cải tiến\n• Xây dựng căn cứ và tuyển mộ sát thủ\n• Đồ họa thế hệ mới với thời tiết động",
    screenshots: 5, ratings: [84, 82, 76], spec: "t1",
    relatedIds: ["elden-ring", "cyberpunk-2077", "dragon-age-dreadwolf", "indiana-jones"],
  },
  {
    id: "halo-infinite", name: "Halo Infinite", originalPrice: 999000, salePrice: 499000,
    genre: "FPS", tags: "action", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/halo-cover/400/500",
    description: "Halo Infinite tiếp nối câu chuyện của Master Chief trong cuộc chiến chống lại Banished. Với thế giới mở Zeta Halo và lối chơi bắn súng đặc trưng.\n\nTính năng chính:\n• Thế giới mở Zeta Halo rộng lớn\n• Multiplayer miễn phí với nhiều chế độ\n• Hệ thống vũ khí và phương tiện đa dạng\n• Chế độ Forge — tạo bản đồ và chế độ chơi\n• Hỗ trợ cross-play và cross-progression",
    screenshots: 4, ratings: [81, 80, 77], spec: "t2",
    relatedIds: ["cod-black-ops-6", "stalker-2", "starfield"],
  },
  {
    id: "forza-motorsport", name: "Forza Motorsport", originalPrice: 1299000, salePrice: 649000,
    genre: "Racing", tags: "racing", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/forza-cover/400/500",
    description: "Forza Motorsport là tựa game đua xe chân thực nhất trên Xbox. Với hơn 500 chiếc xe và 20 trường đua, mang đến trải nghiệm đua xe đỉnh cao.\n\nTính năng chính:\n• Hơn 500 xe từ các hãng nổi tiếng\n• 20 trường đua với điều kiện thời tiết động\n• Hệ thống nâng cấp và tùy biến xe sâu sắc\n• Ray tracing trên track và trong garage\n• Chế độ Career và Multiplayer",
    screenshots: 5, ratings: [84, 83, 80], spec: "t2",
    relatedIds: ["msfs-2024", "ea-fc-26", "cyberpunk-2077"],
  },
  {
    id: "starfield", name: "Starfield", originalPrice: 1499000, salePrice: 599000,
    genre: "Open World", tags: "rpg,space", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/starfield-cover/400/500",
    description: "Starfield là game nhập vai không gian từ Bethesda Game Studios. Khám phá hơn 1000 hành tinh, xây dựng tàu vũ trụ và khám phá bí ẩn của vũ trụ.\n\nTính năng chính:\n• Hơn 1000 hành tinh để khám phá\n• Hệ thống xây dựng và tùy biến tàu vũ trụ\n• Cốt truyện chính với nhiều nhánh lựa chọn\n• Hệ thống kỹ năng và perk đa dạng\n• Đồ họa không gian tuyệt đẹp",
    screenshots: 5, ratings: [83, 81, 74], spec: "t2",
    relatedIds: ["cyberpunk-2077", "elden-ring", "halo-infinite"],
  },
  {
    id: "gears-of-war-eday", name: "Gears of War: E-Day", originalPrice: 1499000, salePrice: 0,
    genre: "Action", tags: "preorder", status: "Preorder", releaseDate: "2026-10-15",
    coverImageUrl: "https://picsum.photos/seed/gearseday-cover/400/500",
    description: "Gears of War: E-Day là phần tiền truyện kể về ngày đầu tiên của cuộc chiến Locust Horde tấn công.\n\nTính năng chính:\n• Cốt truyện tiền truyện đầy cảm xúc\n• Gameplay bắn súng góc nhìn thứ ba đặc trưng\n• Đồ họa Unreal Engine 5 thế hệ mới\n• Chế độ co-op campaign\n• Hệ thống vũ khí Lancer, Gnasher và nhiều hơn",
    screenshots: 4, ratings: [92, 90, 85], spec: "t1",
    relatedIds: ["halo-infinite", "cod-black-ops-6", "fable-4", "avowed"],
  },
  {
    id: "gta-vi", name: "Grand Theft Auto VI", originalPrice: 1799000, salePrice: 1499000,
    genre: "Open World", tags: "preorder,hot", status: "Preorder", releaseDate: "2026-12-31",
    coverImageUrl: "https://picsum.photos/seed/gtavi-cover/400/500",
    description: "Grand Theft Auto VI đưa người chơi trở lại Vice City với hai nhân vật chính Lucia và Jason. Một câu chuyện tội phạm hoành tráng nhất từ trước đến nay.\n\nTính năng chính:\n• Thế giới mở Vice City và vùng lân cận rộng nhất từ trước đến nay\n• Hai nhân vật chính với cốt truyện đan xen\n• Hệ thống giao thông, vũ khí và hoạt động đa dạng\n• Chế độ Online mới với nhiều tính năng đột phá\n• Đồ họa RAGE Engine thế hệ mới",
    screenshots: 5, ratings: [97, 95, 90], spec: "t1",
    relatedIds: ["cyberpunk-2077", "assassins-creed-shadows", "elden-ring"],
  },
  {
    id: "hellblade-2", name: "Senua's Saga: Hellblade II", originalPrice: 999000, salePrice: 499000,
    genre: "Action Adventure", tags: "story", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/hellblade2-cover/400/500",
    description: "Senua's Saga: Hellblade II tiếp tục hành trình của Senua trong thế giới Bắc Âu rùng rợn.\n\nTính năng chính:\n• Cốt truyện sâu sắc về sức khỏe tâm thần\n• Đồ họa Unreal Engine 5 chân thực nhất\n• Hệ thống âm thanh 3D sống động\n• Chiến đấu dựa trên nhịp điệu và phán đoán\n• Hoàn toàn không có HUD hoặc loading screen",
    screenshots: 4, ratings: [88, 86, 83], spec: "t2",
    relatedIds: ["indiana-jones", "lies-of-p", "dragon-age-dreadwolf"],
  },
  {
    id: "dragon-age-dreadwolf", name: "Dragon Age: Dreadwolf", originalPrice: 1299000, salePrice: 909000,
    genre: "RPG", tags: "rpg", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/dreadwolf-cover/400/500",
    description: "Dragon Age: Dreadwolf tiếp nối câu chuyện từ Inquisition. Solas, Dreadwolf huyền thoại, đang âm mưu phá hủy thế giới Thedas.\n\nTính năng chính:\n• Thế giới Thedas rộng lớn với nhiều vùng đất mới\n• Hệ thống đồng đội và quan hệ sâu sắc\n• Tùy biến nhân vật với 4 class chính\n• Cốt truyện phi tuyến tính với hậu quả từ các phần trước\n• Chiến đấu thời gian thực kết hợp chiến thuật",
    screenshots: 4, ratings: [85, 83, 78], spec: "t2",
    relatedIds: ["avowed", "elden-ring", "diablo-4", "lies-of-p"],
  },
  {
    id: "avowed", name: "Avowed", originalPrice: 1499000, salePrice: 0,
    genre: "RPG", tags: "preorder", status: "Preorder", releaseDate: "2026-08-20",
    coverImageUrl: "https://picsum.photos/seed/avowed-cover/400/500",
    description: "Avowed là game nhập vai góc nhìn thứ nhất từ Obsidian Entertainment, lấy bối cảnh thế giới Living Lands.\n\nTính năng chính:\n• Thế giới mở Living Lands với hệ sinh thái đa dạng\n• Chiến đấu kết hợp vũ khí và phép thuật\n• Hệ thống kỹ năng và lối chơi đa dạng\n• Nhiều lựa chọn ảnh hưởng đến cốt truyện\n• Đồng đội với câu chuyện riêng",
    screenshots: 4, ratings: [87, 85, 80], spec: "t2",
    relatedIds: ["dragon-age-dreadwolf", "fable-4", "elden-ring", "starfield"],
  },
  {
    id: "fable-4", name: "Fable", originalPrice: 1499000, salePrice: 0,
    genre: "Action RPG", tags: "preorder", status: "Preorder", releaseDate: "2026-11-05",
    coverImageUrl: "https://picsum.photos/seed/fable4-cover/400/500",
    description: "Fable trở lại với phần mới nhất trên Xbox Series X|S.\n\nTính năng chính:\n• Thế giới Albion mở rộng và sống động\n• Hệ thống lựa chọn ảnh hưởng đến ngoại hình\n• Chiến đấu kết hợp kiếm, phép và súng\n• Hệ thống hài hước đặc trưng của series\n• Xây dựng nhà cửa và tương tác xã hội",
    screenshots: 4, ratings: [90, 88, 84], spec: "t2",
    relatedIds: ["avowed", "gears-of-war-eday", "dragon-age-dreadwolf", "gta-vi"],
  },
  {
    id: "dead-as-disco", name: "Dead as Disco", originalPrice: 499000, salePrice: 399000,
    genre: "Indie", tags: "indie,discount", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/deadasdisco-cover/400/500",
    description: "Dead as Disco là game bắn súng roguelike đầy màu sắc với phong cách disco retro.\n\nTính năng chính:\n• Roguelike với hệ thống vũ khí ngẫu nhiên\n• Phong cách disco neon độc đáo\n• Nhạc nền EDO sôi động\n• Chế độ co-op 4 người chơi\n• Hàng trăm item và upgrade",
    screenshots: 3, ratings: [76, 74, 72], spec: "t3",
    relatedIds: ["hollow-knight-silksong", "lies-of-p", "hellblade-2"],
  },
  {
    id: "msfs-2024", name: "Microsoft Flight Simulator 2024", originalPrice: 1499000, salePrice: 1049000,
    genre: "Simulation", tags: "simulation", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/msfs2024-cover/400/500",
    description: "Microsoft Flight Simulator 2024 mang đến trải nghiệm bay chân thực nhất.\n\nTính năng chính:\n• Toàn bộ Trái Đất với dữ liệu vệ tinh\n• Hơn 100 máy bay chi tiết\n• Thời tiết thực theo giờ\n• Hệ thống điều khiển chuyên sâu\n• Chế độ nhiệm vụ và thử thách bay",
    screenshots: 4, ratings: [91, 89, 85], spec: "t1",
    relatedIds: ["forza-motorsport", "cyberpunk-2077", "starfield"],
  },
  {
    id: "hollow-knight-silksong", name: "Hollow Knight: Silksong", originalPrice: 499000, salePrice: 0,
    genre: "Action", tags: "preorder,indie", status: "Preorder", releaseDate: "2026-07-15",
    coverImageUrl: "https://picsum.photos/seed/silksong-cover/400/500",
    description: "Hollow Knight: Silksong là phần tiếp theo của Hollow Knight huyền thoại. Bạn vào vai Hornet, chiến đấu qua vương quốc Pharloom đầy thử thách.\n\nTính năng chính:\n• Gameplay platformer metroidvania đỉnh cao\n• Hệ thống chiến đấu nhanh và chính xác\n• Thế giới Pharloom rộng lớn với hơn 150 khu vực\n• Hàng trăm kẻ thù và boss\n• Nhạc nền tuyệt đẹp từ Christopher Larkin",
    screenshots: 4, ratings: [93, 91, 87], spec: "t3",
    relatedIds: ["dead-as-disco", "lies-of-p", "hellblade-2"],
  },
  {
    id: "stalker-2", name: "STALKER 2: Heart of Chornobyl", originalPrice: 1299000, salePrice: 909000,
    genre: "FPS", tags: "horror", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/stalker2-cover/400/500",
    description: "STALKER 2: Heart of Chornobyl là game bắn súng sinh tồn thế giới mở trong vùng cấm Chornobyl.\n\nTính năng chính:\n• Thế giới mở vùng cấm Chornobyl rộng 64km²\n• Hệ thống A-Life 2.0 — kẻ thù và sinh vật hành xử tự nhiên\n• Cốt truyện phi tuyến tính với nhiều kết thúc\n• Hệ thảng thời tiết và ngày đêm động\n• Survival mechanics — đói, ngủ, máu, phóng xạ",
    screenshots: 5, ratings: [82, 80, 76], spec: "t2",
    relatedIds: ["cod-black-ops-6", "halo-infinite", "cyberpunk-2077"],
  },
  {
    id: "indiana-jones", name: "Indiana Jones and the Great Circle", originalPrice: 1499000, salePrice: 1049000,
    genre: "Action Adventure", tags: "adventure", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/indianajones-cover/400/500",
    description: "Indiana Jones and the Great Circle là game hành động phiêu lưu từ MachineGames.\n\nTính năng chính:\n• Cốt truyện điện ảnh giữa các bộ phim gốc\n• Khám phá các địa điểm trên khắp thế giới\n• Chiến đấu tay đôi và sử dụng roi đặc trưng\n• Giải đố và khảo cổ học\n• Đồ họa Unreal Engine 5 đỉnh cao",
    screenshots: 5, ratings: [86, 84, 80], spec: "t2",
    relatedIds: ["hellblade-2", "assassins-creed-shadows", "elden-ring"],
  },
  {
    id: "diablo-4", name: "Diablo IV", originalPrice: 1499000, salePrice: 749000,
    genre: "Action RPG", tags: "rpg,hot", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/diablo4-cover/400/500",
    description: "Diablo IV là game nhập vai hành động kinh dị tối tăm nhất trong series.\n\nTính năng chính:\n• Thế giới mở Sanctuary với 5 vùng đất\n• 5 class nhân vật: Barbarian, Sorcerer, Druid, Rogue, Necromancer\n• Hệ thống chiến đấu nhanh và thỏa mãn\n• Seasonal content mới mỗi quý\n• Chế độ co-op và PvP",
    screenshots: 5, ratings: [87, 85, 78], spec: "t2",
    relatedIds: ["elden-ring", "lies-of-p", "dragon-age-dreadwolf", "avowed"],
  },
  {
    id: "mortal-kombat-1", name: "Mortal Kombat 1", originalPrice: 1299000, salePrice: 649000,
    genre: "Fighting", tags: "fighting", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/mk1-cover/400/500",
    description: "Mortal Kombat 1 khởi động lại vũ trụ MK với Liu Kang làm Thần Sấm.\n\nTính năng chính:\n• Hệ thống Kameo Fighter độc đáo\n• 24 nhân vật chính + 16 Kameo\n• Cốt truyện mới từ đầu\n• Fatal Blow và Fatalities mãn nhãn\n• Chế độ Online với rollback netcode",
    screenshots: 4, ratings: [83, 81, 77], spec: "t2",
    relatedIds: ["ea-fc-26", "cod-black-ops-6", "halo-infinite"],
  },
  {
    id: "lies-of-p", name: "Lies of P", originalPrice: 999000, salePrice: 499000,
    genre: "Action RPG", tags: "rpg,soulslike", status: "Available",
    coverImageUrl: "https://picsum.photos/seed/liesofp-cover/400/500",
    description: "Lies of P là game soulslike lấy cảm hứng từ câu chuyện Pinocchio.\n\nTính năng chính:\n• Lối chơi soulslike đầy thử thách\n• Hệ thống vũ khí lắp ghép độc đáo\n• Cốt truyện sâu sắc với nhiều kết thúc\n• Thế giới gothic đẹp đến rợn người\n• Hệ thống nói dối ảnh hưởng đến kết cục",
    screenshots: 5, ratings: [84, 82, 80], spec: "t2",
    relatedIds: ["elden-ring", "hellblade-2", "hollow-knight-silksong", "diablo-4"],
  },
];

/* ───────── public helpers ───────── */

export const seedGames: GameListItem[] = entries.map((e) => ({
  id: e.id,
  name: e.name,
  originalPrice: e.originalPrice,
  salePrice: e.salePrice,
  genre: e.genre,
  tags: e.tags,
  status: e.status,
  releaseDate: e.releaseDate,
  coverImageUrl: e.coverImageUrl,
}));

export function getGameById(id: string): GameListItem | undefined {
  return seedGames.find((g) => g.id === id);
}

export function toGameDetail(game: GameListItem): GameDetail {
  const entry = entries.find((e) => e.id === game.id);
  return {
    id: game.id,
    name: game.name,
    description: entry?.description ?? "",
    originalPrice: game.originalPrice,
    salePrice: game.salePrice,
    genre: game.genre,
    tags: game.tags,
    status: game.status,
    releaseDate: game.releaseDate,
    media: entry ? ss(entry.id, entry.screenshots) : [],
    ratings: entry ? buildRatings(entry.ratings) : [],
    systemRequirements: entry ? reqSpec[entry.spec] : reqSpec.t3,
    relatedGameIds: entry?.relatedIds ?? [],
  };
}
