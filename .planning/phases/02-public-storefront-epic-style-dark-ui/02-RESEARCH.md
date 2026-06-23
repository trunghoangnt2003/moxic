# Phase 2 Research: Public Storefront — Epic-Style Dark UI

## Scope
R2: CAT-01 to CAT-06, UI-01, UI-02, UI-04

## Key Technical Decisions

### Project Setup
- **Create new React app:** `Moxic.Web` (separate from `Moxic.Admin`)
- **Stack:** React 19 + Vite + TypeScript + Tailwind CSS 4
- **Vite proxy:** `/api` → `http://localhost:5000` (same pattern as admin)
- **Package deps:** react-router-dom, @tanstack/react-query, lucide-react, swiper

### Component Architecture

```
src/
  components/
    layout/        — Navbar, Footer, Container
    home/          — HeroCarousel, FeaturedGrid, CategorySection
    games/         — GameCard, GameGrid, GameFilters
    game-detail/   — GameHero, GameInfo, PurchaseGuide, MediaGallery
    preorder/      — PreorderCountdown, PreorderCard
    shared/        — Skeleton, Badge, Button, SearchInput
  hooks/           — useGames, useGameDetail, useCarousel
  pages/           — HomePage, GamesPage, GameDetailPage, PreorderPage
  types/           — Game.ts, Media.ts
  lib/             — api.ts (axios/fetch wrapper)
```

### State Management
- **TanStack Query:** All API data (game list with pagination, game detail)
- **Local state:** Carousel active index, search input, filter selections
- **No global store needed** — Phase 2 is read-only browsing

### Carousel Implementation
- **Swiper.js** recommended over custom — handles touch, autoplay, a11y, SSR
- Package: `swiper` (vanilla JS, works with React via refs)
- Configuration: autoplay delay 5000ms, loop, pagination false, navigation false (sidebar is navigation)
- Alternative: Custom with `useState` + `useEffect` + `setInterval` if bundle size concerns

### Image Handling
- Presigned URLs from MinIO via API (1h expiry)
- On 403 error: re-fetch game data to get fresh URL
- Lazy loading: `<img loading="lazy" />`
- Aspect ratio containers: `aspect-w-16 aspect-h-9` or `aspect-ratio` CSS
- Placeholder: skeleton with `animate-pulse` bg-gray-800

### Performance
- React.lazy + Suspense for route-based code splitting (HomePage, GamesPage, GameDetailPage)
- Image lazy loading
- TanStack Query caching (staleTime: 5 min for game list)
- Reduced motion: `prefers-reduced-motion` media query

### Font Loading
- Google Fonts: Russo One + Chakra Petch
- Preload in `<head>` via index.html
- `font-display: swap` to prevent FOIT (flash of invisible text)
- Fallback: system-ui sans-serif

### Accessibility
- Skip-to-content link
- ARIA labels on icon buttons
- Focus management for carousel
- Color contrast: white text on dark backgrounds (15:1+ ratio ✓)
- Keyboard navigation for game grid and carousel

## Key Dependencies
- react 19, react-dom 19
- react-router-dom v7
- @tanstack/react-query v5
- lucide-react
- swiper (carousel)
- tailwindcss v4 + @tailwindcss/vite

---
*Research completed: 2026-06-24*
