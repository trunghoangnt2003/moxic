---
phase: 2
title: "Public Storefront — Epic-Style Dark UI"
mode: mvp
requirements_addressed: [CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, UI-01, UI-02, UI-04]
waves: 4
generated: 2026-06-24
---

# Plan: Phase 2 — Public Storefront

**Goal:** Build React frontend with Epic Games Store-inspired dark theme, game grid, carousel, detail pages, preorder display.

## Wave 1: Project Scaffold + Layout Foundation

### Tasks

**W1.1: Create Moxic.Web React app**
- `npm create vite@latest Moxic.Web -- --template react-ts`
- Install deps: react-router-dom, @tanstack/react-query, lucide-react, swiper
- Install Tailwind CSS 4 + @tailwindcss/vite
- Configure Vite proxy: `/api` → `http://localhost:5000`
- Set up TypeScript path aliases (`@/` → `src/`)
- Import Google Fonts (Russo One + Chakra Petch) in index.html with preload + font-display:swap
- Configure Tailwind: dark theme via CSS variables in index.css

**W1.2: CSS Design System**
- Define CSS custom properties in `index.css`:
  - `--color-bg: #121212`, `--color-surface: #1a1a1a`, `--color-surface-hover: #252525`
  - `--color-border: #2a2a2a`
  - `--color-text: #ffffff`, `--color-text-secondary: #a0a0a0`, `--color-text-muted: #666666`
  - `--color-accent: #f97316` (orange-500)
  - `--color-discount: #3b82f6` (blue-500)
  - `--color-preorder: #6366f1` (indigo-500)
- Spacing: base 8px scale
- Typography: Russo One (headings, font-family: "Russo One", system-ui, sans-serif)
- Chakra Petch (body, font-family: "Chakra Petch", system-ui, sans-serif)
- Container max-width: 1200px, centered

**W1.3: Layout components**
- `Container.tsx` — max-w-[1200px] mx-auto wrapper, bg bleeds full-width
- `Navbar.tsx` — Sticky top, z-50. Left: "MOXIC" logo (Russo One, orange-500) + Store/Hỗ trợ/Phân phối links (gap-6). Right: Search icon + Language ghost + Đăng nhập ghost + Tải về primary button
- `Footer.tsx` — Simple footer with links and copyright
- `AppLayout.tsx` — Navbar + main content + Footer composition

**W1.4: API layer + type definitions**
- `src/types/game.ts`: Game, GameMedia types matching API response
- `src/lib/api.ts`: Fetch wrapper with base URL `/api`
- `src/hooks/useGames.ts`: TanStack Query hook for `GET /api/games` (staleTime: 5min)
- `src/hooks/useGameDetail.ts`: TanStack Query hook for `GET /api/games/{id}`

**W1.5: Routing setup**
- Routes: `/` → HomePage, `/games` → GamesPage, `/games/:id` → GameDetailPage, `/preorder` → PreorderPage
- React.lazy + Suspense for each page component (code splitting)
- Not-found (404) page

### Success Criteria
- [ ] `npm run dev` starts app, proxies `/api` to backend
- [ ] Google Fonts load correctly (Russo One + Chakra Petch)
- [ ] Navbar renders with all sections, sticky behavior works
- [ ] API types match backend responses
- [ ] TanStack Query fetches game list successfully
- [ ] Routes work: Home, Games, Game Detail, Preorder

---

## Wave 2: Home Page — Hero Carousel + Featured Sections

### Tasks

**W2.1: Hero Carousel component**
- Split layout: 75% main banner (left) + 25% sidebar navigation (right)
- Main banner: `<div>` with `background-image: url(hero.jpg)` + `linear-gradient(#000000 0%, transparent 50%)` overlay
- Content overlay: Title (Russo One, white), Description (Chakra Petch, gray-300), CTA button "Tiết kiệm ngay" (white bg, black text, hover: gray-100)
- Sidebar: `<ul>` of game items. Active item: `background: rgba(255,255,255,0.1)`, border-radius 4px. Inactive: reduced opacity, thumbnail + name only
- Autoplay: 5s interval via Swiper.js or custom `useEffect` + `setInterval`
- Manual control: Click sidebar item to switch hero
- Transition: crossfade 300ms between slides

**W2.2: Featured/Game Grid section "Khám Phá Nội Dung Mới"**
- Two-column layout: Left = feature banner (vertical, 1 column), Right = CSS Grid `repeat(3, 1fr)` gap-6
- Each grid item: flex row. Left: thumbnail (1:1 ratio, border-radius 4px, 80x80). Right: game name (bold, white) + price (orange-500)
- Discount badge (blue-500, -20% text) + original price strikethrough (text-muted, line-through)
- Hover: `transform: scale(1.02)` + `filter: brightness(1.1)` on thumbnail

**W2.3: Category/Section components**
- Section header with title + "Xem tất cả" link
- GameCard component (reusable): thumbnail, name, price, discount badge, status badge
- Grid variants: 3-col (featured), auto-fill (full listing)

**W2.4: Preorder section on home page**
- Section: "Game Sắp Ra Mắt" — filtered games with status=Preorder
- Cards show: preorder badge (indigo-500), release date, countdown timer
- "Đặt trước" button instead of "Mua ngay"
- Note: "Game sẽ được cài đặt vào tài khoản của bạn đúng ngày phát hành [DD/MM/YYYY]"

### Success Criteria
- [ ] Hero carousel displays 3+ games, autoplay works, sidebar nav works
- [ ] Game grid renders from API data with correct pricing display
- [ ] Discount badges, strikethrough prices render correctly
- [ ] Preorder section shows games with "Đặt trước" button
- [ ] All hover effects work with smooth transitions
- [ ] Game card click navigates to game detail page

---

## Wave 3: Game Listing — Search, Filter, Grid

### Tasks

**W3.1: Search bar component**
- Input with search icon (lucide-react Search, absolute positioned left)
- Border-radius 8px, background `#2a2a2a`, placeholder "Tìm kiếm game..."
- Debounced input (300ms) — updates TanStack Query search parameter
- Clear button appears when text entered

**W3.2: Filter chips**
- Genre filter buttons (Action, RPG, Sports, etc.) — extracted from API genre values
- Status filter: "Tất cả" / "Sẵn có" / "Đặt trước"
- Active filter: orange-500 border/bg, inactive: surface color
- Active filters displayed as removable chips above grid

**W3.3: Game grid with pagination**
- CSS Grid `repeat(auto-fill, minmax(280px, 1fr))` gap-6
- GameCard in grid variant (vertical: image full-width top, text below)
- Pagination: "Xem thêm" (Load More) button at bottom, or numbered pagination
- Shows "Đang tải..." (Loading...) skeleton while fetching

**W3.4: Skeleton loading states**
- GameCardSkeleton: pulsing gray rectangles matching card dimensions (aspect-ratio)
- HeroSkeleton: full-width pulsing banner
- FilterSkeleton: pill-shaped pulsing chips
- Use `animate-pulse` with bg-gray-800

**W3.5: Empty/Error states**
- Empty: "Không tìm thấy game phù hợp" with illustration + reset filters button
- Error: "Không thể tải dữ liệu" with retry button
- Network: offline indicator in Navbar (optional enhancement)

### Success Criteria
- [ ] Search input filters games with debounce
- [ ] Genre/status filters work, active state visible
- [ ] Game grid renders with correct responsive columns
- [ ] Pagination/load more loads next page
- [ ] Skeleton loaders display during API fetch
- [ ] Empty and error states render correctly

---

## Wave 4: Game Detail Page + Preorder Display

### Tasks

**W4.1: Game detail hero**
- Full-width hero image (primary media, presigned URL)
- Overlay gradient for text readability
- Game title (Russo One, white, large), genre badge, tags
- Price display: original (strikethrough) + sale price (orange, large)
- Status badge: "Sẵn có" (green) or "Sắp ra mắt" (indigo)

**W4.2: Game information section**
- Description (full text from API)
- System requirements (text from Description or structured if available)
- Genre, tags displayed as chips
- Media gallery: grid of images from GameMedia, click to enlarge (lightbox or modal)
- Primary image highlighted / larger

**W4.3: Purchase guide (3-step visual)**
- Numbered steps display:
  - "Bước 1: Chọn game" — icon + text
  - "Bước 2: Thanh toán & Cung cấp tài khoản Xbox" — icon + text
  - "Bước 3: Nhân viên vào cài đặt trong 15-30 phút" — icon + text
- Visual: icons (lucide-react: ShoppingCart, CreditCard, Gamepad2), separated by arrows
- Styled as a highlighted info section with border/accent

**W4.4: Preorder section on detail page**
- If game.Status === "Preorder":
  - Show "Đặt trước" button (indigo-500, large, full-width on mobile)
  - Release date countdown: "Còn X ngày" or "Phát hành: DD/MM/YYYY"
  - Preorder note: "Game sẽ được cài đặt vào tài khoản của bạn đúng ngày phát hành [DD/MM/YYYY]"
  - "Mua ngay" button only shows for Available games

**W4.5: Responsive design pass**
- Mobile (480px): single column, hamburger menu, full-width cards
- Tablet (768px): 2-column grid, collapsed nav
- Desktop (1024px+): full layout as designed
- Touch targets: minimum 44x44px for all buttons/taps
- Test all pages at 375px, 768px, 1024px, 1440px

### Success Criteria
- [ ] Game detail loads with hero image + presigned URL
- [ ] Description, genre, tags display correctly
- [ ] Media gallery shows all game images with lightbox
- [ ] Purchase guide renders 3 steps with icons
- [ ] Preorder game shows "Đặt trước" button + countdown + release note
- [ ] Available game shows "Mua ngay" button (link to cart, implemented in Phase 3)
- [ ] Responsive: all pages work on mobile/tablet/desktop
- [ ] Touch targets ≥ 44px on mobile

---

## Cross-cutting Constraints

- Dark theme only (no light mode toggle)
- All images via presigned URLs with lazy loading
- Transitions: 300ms ease for all hover effects
- cursor-pointer on all interactive elements
- prefers-reduced-motion disables animations
- Google Fonts loaded with font-display:swap to prevent FOIT
- API calls proxied via Vite in dev, direct to backend URL in production
- All user-facing text in Vietnamese
