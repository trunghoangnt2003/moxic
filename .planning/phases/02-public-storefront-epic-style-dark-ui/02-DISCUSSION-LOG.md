# Discussion Log: Phase 2 — Public Storefront

**Date:** 2026-06-24
**Status:** Complete

## Areas Discussed

### 1. Design System & Visual Identity
- **Reference:** Epic Games Store dark theme, validated via ui-ux-pro-max skill
- **Key decisions:** Dark palette (#121212 base, #1a1a1a surfaces), Russo One + Chakra Petch typography, orange accent (#f97316) matching admin
- **Anti-patterns noted:** No flat design without depth, no text-heavy pages

### 2. Layout Architecture
- **Reference:** Epic Games Store layout, Flexbox + CSS Grid
- **Key decisions:** Desktop-first responsive, 1200px container, 8px spacing system

### 3. Hero Carousel
- **Reference:** Epic Games Store hero section
- **Key decisions:** 75-80/20-25 split layout, Swiper.js or custom carousel, autoplay 5s, gradient overlay for text readability

### 4. Game Grid & Cards
- **Reference:** Epic Games Store game listing
- **Key decisions:** CSS Grid repeat(3,1fr) for featured sections, flex-row cards, discount badges, hover effects

### 5. Preorder Display
- **Reference:** Preorder game requirements (CAT-06)
- **Key decisions:** "Đặt trước" button, countdown timer, release date note

### 6. Tech Stack
- **Reference:** Phase 1 admin patterns (Vite + React + Tailwind CSS 4)
- **Key decisions:** Same stack as admin, add TanStack Query + lucide-react + Russo One/Chakra Petch fonts

## Deferred Items
- User registration, cart/checkout, reviews — future phases

## Decisions Count: 10 categories, 40+ individual decisions
