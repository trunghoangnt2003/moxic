# Phase 2: Public Storefront — Epic-Style Dark UI — Context

**Gathered:** 2026-06-24
**Status:** Ready for planning
**Source:** discuss-phase with ui-ux-pro-max design system validation

<domain>
## Phase Boundary

Build the public-facing React frontend for Moxic GameStore — an Epic Games Store-inspired dark theme website where customers can browse games, view details, search/filter, and see preorder information. This phase delivers the visual identity and browsing experience only (cart/checkout comes in Phase 3).

**Requirements:** CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, UI-01, UI-02, UI-04
</domain>

<design_system>
## Design System Validation (via ui-ux-pro-max)

### Pattern: App Store / Game Store Landing
Screenshot-driven design with dark immersive background. Game covers as hero elements. Sections: hero carousel → featured grid → categories → preorder highlights.

### Colors (Epic Games Store-inspired Dark Theme)

| Role | Hex | Usage |
|------|-----|-------|
| Background | `#121212` | Page background, body |
| Surface | `#1a1a1a` | Cards, nav, dropdowns |
| Surface-hover | `#252525` | Card hover state |
| Border | `#2a2a2a` | Dividers, card borders |
| Text-primary | `#ffffff` | Titles, headings |
| Text-secondary | `#a0a0a0` | Descriptions, sub-text |
| Text-muted | `#666666` | Labels, metadata |
| Accent/Moxic | `#f97316` (orange-500) | CTA buttons, highlights (consistent with admin) |
| CTA-primary | `#ffffff` bg black text | "Tiết kiệm ngay" hero buttons |
| Discount | `#3b82f6` (blue-500) | Discount badge -20% |
| Preorder | `#6366f1` (indigo-500) | Preorder badge |
| Status-sale | `#22c55e` (green-500) | "Hot" tag, sale indicator |

### Typography

- **Headings:** Russo One (Google Font) — bold, gaming feel, used for game titles, hero text, section headers
- **Body:** Chakra Petch (Google Font) — clean, readable, tech/gaming aesthetic
- **Fallback:** system-ui sans-serif

```css
@import url("https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=Russo+One&display=swap");
```

- Heading font-family: `"Russo One", system-ui, sans-serif`
- Body font-family: `"Chakra Petch", system-ui, sans-serif`
- Body font-size: 14px (desktop), 16px (mobile minimum)
- Line-height: 1.5 (body), 1.2 (headings)

### Spacing System
- Base unit: 8px (8, 16, 24, 32, 48, 64, 96)
- Container max-width: 1200px (margin: 0 auto)
- Section gap: 48px-64px
- Card gap: 24px

### Effects
- Border-radius: 4px (cards), 8px (buttons, inputs)
- Transitions: all 0.3s ease (hover effects)
- Hover: brightness(1.1) or scale(1.02) on images, color shift on text
- Box-shadows: subtle `0 2px 8px rgba(0,0,0,0.3)` for depth
</design_system>

<decisions>
## Implementation Decisions

### 1. Layout Architecture

- **Grid system:** CSS Grid for game card layouts (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` for responsive grid; `repeat(3, 1fr)` for featured sections)
- **Flexbox:** Used for navigation bar, game list items (horizontal layout), hero section layout
- **Container:** Fixed max-width 1200px, centered (`margin: 0 auto`), background color `#121212` bleeds full-width
- **Responsive:** Desktop-first approach. Breakpoints: 1024px (tablet), 768px (small tablet), 480px (mobile)
- **Spacing:** 8px base unit system — padding/margin use 8, 16, 24, 32, 48px consistently

### 2. Top Navigation Bar

- Two-section layout (left logo+menu, right actions)
- Logo: "MOXIC" text in Russo One, orange-500 color, consistent with admin branding
- Nav links: Store, Hỗ trợ, Phân phối (gap: 24px, flex)
- Right side: Search icon, language toggle (text/ghost variant), "Đăng nhập" (ghost button), "Tải về" (primary button)
- Search input: border-radius 8px, search icon absolutely positioned left, background `#2a2a2a`
- Sticky top, z-index 50

### 3. Hero Section — Carousel Slider (Most Complex Component)

- **Library:** Swiper.js or custom implementation with autoplay (setInterval, 5s)
- **Layout split:** 75-80% main banner (left), 20-25% navigation sidebar (right)
- **Main banner:** `<div>` with `background-image` + `linear-gradient(black 0%, transparent 50%)` overlay for text readability. Content: Title, description, CTA button ("Tiết kiệm ngay" — white bg black text)
- **Sidebar:** `<ul>` of game items. Active item has `background: rgba(255,255,255,0.1)`, border-radius 4px. Inactive items show thumbnail + name only, reduced opacity
- **Carousel logic:** Click sidebar item OR autoplay interval updates main banner content + active state. Data-driven from game list API
- **Transition:** crossfade or slide transition between hero items (300ms)

### 4. Featured/Game Grid Sections

- **"Khám Phá Nội Dung Mới" section:** Left column = feature banner (vertical), Right = CSS Grid repeat(3, 1fr) with 24px gap
- **Game card component:** Flex row (horizontal). Left: thumbnail (1:1 or 3:4 ratio, border-radius 4px). Right: text box with game name (bold) + price
- **Discount display:** Blue discount badge (-20%), original price strikethrough (`text-decoration: line-through`), sale price prominent in orange
- **Game detail page:** Route `/games/:slug`. Shows: hero banner image, title, description, system requirements, purchase guide (3-step visual with numbered steps), screenshots gallery, preorder countdown if applicable
- **Image loading:** Lazy loading with `loading="lazy"`, explicit width/height to prevent layout shift

### 5. Micro-interactions & States

- **Hover effects:** All cards, list items, buttons → `transition: all 0.3s ease` + `filter: brightness(1.1)` or `transform: scale(1.02)` on thumbnail
- **Cursor:** `cursor-pointer` on all interactive elements
- **Loading states:** Skeleton screens for game grid (pulsing gray rectangles matching card dimensions)
- **Empty state:** "No games found" message with search/filter reset option
- **Error state:** "Failed to load games" with retry button
- **Focus states:** Visible outline for keyboard navigation (accessibility)
- **Reduced motion:** `prefers-reduced-motion` media query disables animations

### 6. Preorder Display

- Games with `Status: Preorder` show countdown badge ("Sắp ra mắt" / "Coming Soon") instead of "Available" badge
- "Đặt trước" (Preorder) button instead of "Mua ngay" (Buy Now)
- Release date displayed: "Game sẽ được cài đặt vào tài khoản của bạn đúng ngày phát hành [DD/MM/YYYY]"
- Countdown timer showing days remaining until release

### 7. Dark Mode Standard

- Pure dark theme (no light mode toggle needed — this is a gaming store)
- Text hierarchy: White `#ffffff` for titles → Light gray `#a0a0a0` for descriptions → Muted `#666666` for metadata
- Background: `#121212` base, `#1a1a1a` cards, `#2a2a2a` borders/inputs
- Orange `#f97316` as brand accent (matching admin), blue `#3b82f6` for discounts, green `#22c55e` for status indicators

### 8. Tech Stack for Phase 2

- **Framework:** React 19 + Vite (same as admin — reuse patterns)
- **Routing:** React Router v7 (BrowserRouter, Routes, Route)
- **Styling:** Tailwind CSS 4 (dark theme via custom CSS variables in `index.css`)
- **State/Data:** TanStack Query (React Query) for server state (game list, game detail, carousel data)
- **Icons:** lucide-react (consistent icon set)
- **Carousel:** Swiper.js or custom (user prefers custom for full control)
- **Fonts:** Google Fonts — Russo One + Chakra Petch

### 9. API Integration

- `GET /api/games` — paginated list with presigned image URLs
- `GET /api/games/{id}` — game detail with all media presigned URLs
- `GET /api/games?status=Preorder` — filter for preorder games
- Presigned URL refresh strategy: regenerate on 403 error (URL expired)
- Search implemented client-side via API `?search=` parameter

### 10. Pages & Routes

| Route | Page | Components |
|-------|------|------------|
| `/` | Home | Hero carousel, Featured grid, Categories, Preorder highlights |
| `/games` | Game listing | Search bar, Filter chips, Game grid, Pagination |
| `/games/:id` | Game detail | Hero image, Info, Screenshots, Purchase guide, Preorder info |
| `/preorder` | Preorder section | Filtered preorder games, Release calendar |

</decisions>

<canonical_refs>
## Canonical References

### Phase Plan
- `.planning/ROADMAP.md` — Phase 2 goal: Public Storefront
- `.planning/REQUIREMENTS.md` — CAT-01..06, UI-01..04 requirements

### Backend API (from Phase 1)
- `Moxic.Api/Controllers/GamesController.cs` — Public game endpoints (GET /api/games, GET /api/games/{id})
- `Moxic.Core/Entities/Game.cs` — Game entity (Name, Genre, Tags, Status, ReleaseDate, Media)
- `Moxic.Core/Entities/GameMedia.cs` — Media entity (ObjectKey, IsPrimary, DisplayOrder)

### Admin UI Patterns (reuse patterns)
- `Moxic.Admin/vite.config.ts` — Vite + React + Tailwind CSS 4 setup with API proxy
- `Moxic.Admin/src/App.tsx` — Dark theme layout patterns (bg-[#0f0f0f], text-gray-200, max-w-6xl mx-auto)

### Design Reference
- Epic Games Store (https://store.epicgames.com) — Primary visual reference for layout, spacing, dark theme
</canonical_refs>

<specifics>
## Specific Ideas from User

### Home Page Layout (Exactly as Specified)
1. **Top Nav:** Two-block layout. Left = Logo "MOXIC" (orange) + Store / Hỗ trợ / Phân phối links. Right = Search (icon left, border-radius 8px) + Language + Đăng nhập (ghost) + Tải về (primary)
2. **Hero Carousel:** 75-80% main banner (left) + 20-25% sidebar (right). Background: image + linear-gradient overlay. CTA: "Tiết kiệm ngay" white button. Sidebar: list with active state highlight. Autoplay 5s.
3. **"Khám Phá Nội Dung Mới":** Left = feature banner column. Right = grid repeat(3, 1fr). Each item = thumbnail + name + price. Discount badge blue -20%, original price line-through.
4. **Game card:** Flex row, thumbnail left, text right (name bold, price). Hover: brightness(1.1) or scale(1.02).
5. **All hover effects:** transition: all 0.3s ease
6. **Dark theme:** `#121212` background, white titles, light gray descriptions, no light mode

### Preorder Display
- "Đặt trước" button for preorder games (instead of "Mua ngay")
- Release note: "Game sẽ được cài đặt vào tài khoản của bạn đúng ngày phát hành [DD/MM/YYYY]"

### Purchase Guide
- Game detail page includes 3-step visual guide: "Bước 1: Chọn game → Bước 2: Thanh toán & Cung cấp tài khoản Xbox → Bước 3: Nhân viên vào cài đặt trong 15-30 phút"
</specifics>

<deferred>
## Deferred Ideas

- User registration / account system — Phase 2 uses anonymous browsing only
- Cart + checkout UI — Phase 3
- Game reviews / ratings — Future phase
- Vietnamese language toggle — Future (for now, UI text in Vietnamese as specified)
- SSR / Next.js migration — Not needed in Phase 2, Vite SPA is sufficient

</deferred>

---

*Phase: 02-public-storefront-epic-style-dark-ui*
*Context gathered: 2026-06-24 via discuss-phase*
