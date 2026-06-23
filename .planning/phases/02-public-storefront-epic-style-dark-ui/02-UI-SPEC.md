# UI-SPEC: Phase 2 — Public Storefront

**Design Contract for Frontend Developers**
**Version:** 1.0
**Date:** 2026-06-24
**Status:** Approved ✓
**Validation:** ui-ux-pro-max design system + Gaming Bold typography verified

---

## 1. Design Tokens & Theme

### 1.1 Color Palette

```
--color-bg-base:          #121212   /* Page background */
--color-bg-surface:       #1a1a1a   /* Cards, navbar, dropdowns */
--color-bg-surface-hover: #252525   /* Card hover, active states */
--color-bg-elevated:      #2a2a2a   /* Inputs, search bars, borders */
--color-border:           #2a2a2a   /* Dividers, card borders */
--color-border-hover:     #3a3a3a   /* Border on hover/focus */

--color-text-primary:     #ffffff   /* Titles, headings */
--color-text-secondary:   #a0a0a0   /* Descriptions, sub-text (15:1 contrast) */
--color-text-muted:       #666666   /* Labels, metadata, timestamps */
--color-text-placeholder: #555555   /* Input placeholders */

--color-accent:           #f97316   /* orange-500 — CTA buttons, brand highlights */
--color-accent-hover:     #ea580c   /* orange-600 */
--color-accent-muted:     #fdba74   /* orange-300 — secondary accent */
--color-discount:         #3b82f6   /* blue-500 — discount badge -20% */
--color-preorder:         #6366f1   /* indigo-500 — preorder badge */
--color-success:          #22c55e   /* green-500 — "Sẵn có" badge */
--color-danger:           #ef4444   /* red-500 — error states */

--color-overlay:          rgba(0,0,0,0.6)  /* Hero gradient */
--color-hero-sidebar-active: rgba(255,255,255,0.1)  /* Carousel sidebar active */
```

### 1.2 Typography

```css
/* Google Fonts: Russo One (headings) + Chakra Petch (body) */
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=Russo+One&display=swap');
```

| Usage | Font | Weight | Size | Line Height | Color |
|-------|------|--------|------|-------------|-------|
| Page title (H1) | Russo One | 400 | 32px | 1.2 | white |
| Section title (H2) | Russo One | 400 | 24px | 1.2 | white |
| Game card title | Chakra Petch | 600 (bold) | 14px | 1.4 | white |
| Body text | Chakra Petch | 400 | 14px | 1.5 | text-secondary |
| Description | Chakra Petch | 400 | 13px | 1.6 | text-secondary |
| Price | Chakra Petch | 600 | 18px | 1 | accent |
| Badge text | Chakra Petch | 600 | 11px | 1 | white |
| Button text | Chakra Petch | 600 | 14px | 1 | white |
| Nav link | Chakra Petch | 500 | 14px | 1 | text-secondary |

### 1.3 Spacing Scale

| Token | PX | Usage |
|-------|----|-------|
| space-1 | 4px | Tiny gaps |
| space-2 | 8px | Icon padding, inner card padding |
| space-3 | 12px | Button padding |
| space-4 | 16px | Card padding, section margin |
| space-5 | 20px | Input padding |
| space-6 | 24px | Grid gaps, between sections |
| space-8 | 32px | Section top/bottom |
| space-10 | 40px | Hero bottom padding |
| space-12 | 48px | Between major sections |
| space-16 | 64px | Page top spacing |

### 1.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | 4px | Cards, images |
| radius-md | 8px | Buttons, inputs, search bar |
| radius-lg | 12px | Modals, dropdowns |

### 1.5 Shadows

```css
--shadow-card: 0 2px 8px rgba(0,0,0,0.3);
--shadow-elevated: 0 4px 16px rgba(0,0,0,0.4);
--shadow-hero-overlay: linear-gradient(#000000 0%, transparent 50%);
```

---

## 2. Component Library

### 2.1 Button Component

```
┌──────────────────────────────────────────────────────────────────┐
│  Variants:                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Tiết kiệm    │  │ Đăng nhập    │  │ Tải về               │   │
│  │ ngay         │  │              │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│   Hero CTA         Ghost variant     Primary variant              │
│   bg-white         bg-transparent    bg-accent                    │
│   text-black       text-secondary    text-white                   │
│   hover:bg-gray-100 hover:text-white hover:bg-accent-hover        │
│   border-radius:8  border-radius:8   border-radius:8              │
│   px-8 py-3       px-4 py-2         px-6 py-3                    │
└──────────────────────────────────────────────────────────────────┘
```

**States:** default → hover (brightness/color shift) → active (scale 0.98) → disabled (opacity 50%, cursor-not-allowed) → focus (ring-2 ring-accent)

### 2.2 Badge Component

| Variant | BG Color | Text | Radius | Usage |
|---------|----------|------|--------|-------|
| Discount | `#3b82f6` (blue-500) | white `-20%` | radius-sm | Sale badge on cards |
| Preorder | `#6366f1` (indigo-500) | white `Sắp ra mắt` | radius-sm | Preorder game badge |
| Available | `#22c55e` (green-500) | white `Sẵn có` | radius-sm | In-stock badge |
| Hot | `#ef4444` (red-500) | white `Hot` | radius-sm | Featured tag |

### 2.3 Game Card Component

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐                                                │
│  │          │  Game Name (Chakra Petch 600, 14px, white)     │
│  │ Thumbnail│  ─────────────────────────────────────────     │
│  │ 80x80    │  Original Price (text-muted, 12px, line-through)│
│  │ 1:1      │  Sale Price (accent, 18px, bold)               │
│  │ radius-4 │  ┌────────────┐                                │
│  │          │  │  -20%      │ ← Discount badge (blue-500)    │
│  └──────────┘  └────────────┘                                │
│                                                               │
│  Hover: transform: scale(1.02) on thumbnail                  │
│         filter: brightness(1.1)                               │
│         transition: all 0.3s ease                             │
│                                                               │
│  cursor: pointer                                              │
└─────────────────────────────────────────────────────────────┘
```

**Grid variant (for full game grid):** Image full-width above, text below. `aspect-ratio: 3/4` for image.

### 2.4 Navbar Component

```
┌─────────────────────────────────────────────────────────┐
│  ┌──────┐  ┌─────┬──────┬──────────┐   ┌──┐ ┌──────┐  │
│  │MOXIC │  │Store│Hỗ trợ│Phân phối │   │🔍│ │Đăng  │  │
│  │      │  │     │      │          │   │  │ │nhập  │  │
│  │orange│  │     │      │          │   │  │ └──────┘  │
│  │Russo │  │     │      │          │   │  │ ┌────────┐│
│  │One   │  │     │      │          │   │  │ │Tải về  ││
│  └──────┘  └─────┴──────┴──────────┘   └──┘ └────────┘│
│                                    Search   Ghost Primary│
│  Sticky top, z-index: 50                                 │
│  bg-surface, border-bottom: 1px border                   │
│  gap-6 between nav items                                  │
│  Container max-w-[1200px] mx-auto                         │
└─────────────────────────────────────────────────────────┘
```

### 2.5 Search Input

```
┌─────────────────────────────────────────────────┐
│ 🔍  Tìm kiếm game...                             │
└─────────────────────────────────────────────────┘
  bg-elevated, border-radius: 8px
  padding-left: 40px (icon absolute positioned left)
  placeholder: text-placeholder
  focus: border-accent
  Clear button (X) appears when text entered
```

### 2.6 Hero Carousel Component

```
┌────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────┐ ┌──────────────────┐  │
│ │  [Hero Background Image]     │ │ [Active Item]    │  │
│ │  + linear-gradient overlay   │ │ ┌──── ┌────────┐  │  │
│ │                              │ │ │Icon │Text    │  │  │
│ │  Title (Russo One, 32px)     │ │ └──── └────────┘  │  │
│ │  Description (14px)          │ │ bg-hero-sidebar   │  │
│ │                              │ │ -active           │  │
│ │  ┌─────────────────────┐    │ │                    │  │
│ │  │ Tiết kiệm ngay      │    │ │ [Inactive Item]    │  │
│ │  └─────────────────────┘    │ │ ┌──── ┌────────┐  │  │
│ │  75% width                  │ │ │Icon │Text    │  │  │
│ └──────────────────────────────┘ │ └──── └────────┘  │  │
│                                   │ opacity: 0.7     │  │
│                                   └──────────────────┘  │
│                                   25% width              │
└────────────────────────────────────────────────────────┘
  Autoplay: 5s (setInterval)
  Transition: crossfade 300ms
  Click sidebar item → switch hero
```

---

## 3. Page Specifications

### 3.1 Home Page (`/`)

**Section order:**
1. **Navbar** — Sticky, z-50
2. **Hero Carousel** — Full-width, 480px height
3. **"Khám Phá Nội Dung Mới"** — 2-column (1fr feature + 3fr grid), 48px top margin
4. **"Game Sắp Ra Mắt"** — Preorder section, horizontal scroll or grid, 48px top margin
5. **Footer** — Simple, bg-surface, border-top

**States:**
- Loading: Hero skeleton (pulsing full-width rectangle) + Grid skeleton (6 pulsing cards)
- Empty: "Chưa có game nào" centered message with illustration
- Error: "Không thể tải dữ liệu" + retry button
- Edge case: No preorder games → hide preorder section entirely

### 3.2 Game Listing Page (`/games`)

**Section order:**
1. **Navbar**
2. **Search bar** — Full-width, space-4 below
3. **Filter chips** — Horizontal scrollable row, genre + status filters
4. **Game Grid** — CSS Grid auto-fill minmax(280px, 1fr), gap-6
5. **Pagination** — "Xem thêm" button centered below grid
6. **Footer**

**Filter active state:** bg-accent/20 text-accent border-accent ring-1 ring-accent
**Filter inactive state:** bg-surface text-secondary border-border
**Active filters show as removable chips above grid**

### 3.3 Game Detail Page (`/games/:id`)

**Section order:**
1. **Navbar**
2. **Hero Section** — Full-width game banner image with gradient overlay
3. **Game Info** — Title, price, status badge, genre chips, tags
4. **Description** — Full text with readable line-length (max 75ch)
5. **Media Gallery** — Grid of images, primary highlighted, click for lightbox
6. **Purchase Guide** — 3 numbered steps with icons and connecting arrows
7. **Preorder Section** — (shown only if preorder) Countdown + "Đặt trước" button + release note
8. **Footer**

**Purchase guide visual:**
```
Bước 1 ──→ Bước 2 ──→ Bước 3
🛒        💳         🎮
Chọn     Thanh toán  Cài đặt
         & cung cấp  trong 15-30
         tài khoản   phút
```

---

## 4. Interaction Specifications

### 4.1 Micro-interactions

| Element | Default | Hover | Active | Transition |
|---------|---------|-------|--------|------------|
| Button (primary) | bg-accent | bg-accent-hover | scale(0.98) | 0.3s ease |
| Button (ghost) | transparent | bg-white/10 | scale(0.98) | 0.3s ease |
| Hero CTA | bg-white | bg-gray-100 | scale(0.98) | 0.3s ease |
| Game card thumbnail | 1.0 scale | scale(1.02) brightness(1.1) | scale(0.98) | 0.3s ease |
| Nav link | text-secondary | text-white | — | 0.2s ease |
| Badge | — | brightness(1.2) | — | 0.2s ease |
| Filter chip | inactive bg | bg-white/10 | active state | 0.2s ease |

### 4.2 Loading States

- **Hero skeleton:** Full-width 480px rectangle with `animate-pulse` bg-gray-800
- **Card skeleton:** Matches card dimensions, bg-gray-800 rounded-lg
- **Text skeleton:** Last line 60% width, bg-gray-800 rounded

### 4.3 Empty/Error States

- **Empty games:** "Không tìm thấy game phù hợp" + "Đặt lại bộ lọc" button
- **Empty preorder:** Hide section
- **API error:** "Không thể tải dữ liệu" toast + "Thử lại" button
- **Network offline:** Optional banner in navbar
- **Image 403 (expired URL):** Show fallback placeholder image

### 4.4 Responsive Behavior

| Breakpoint | Width | Layout Changes |
|------------|-------|------------|
| Desktop | ≥1024px | Full layout: hero 75/25, 3-col grid |
| Tablet | 768-1023px | 2-col grid, hero simplified |
| Mobile | 480-767px | 1-col, hamburger nav, hero full-width only |
| Small mobile | <480px | 1-col, compact spacing |

**Mobile nav:** Hamburger menu icon → slide-in drawer with nav links + search

---

## 5. Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | All text ≥ 4.5:1 ratio (white on #121212 = 15:1 ✓) |
| Focus states | `focus-visible:ring-2 focus-visible:ring-accent` on all interactive |
| Keyboard nav | Tab order matches visual order, carousel arrow keys |
| ARIA labels | `aria-label` on icon buttons, `aria-current="page"` on active nav |
| Reduced motion | `@media (prefers-reduced-motion: reduce) { * { transition-duration: 0s !important; } }` |
| Touch targets | Minimum 44x44px on mobile |
| Skip link | "Bỏ qua điều hướng" skip-to-content link as first focusable |

---

## 6. CSS Architecture

### 6.1 Tailwind Config

```js
// tailwind.config.js (or CSS custom properties in index.css)
theme: {
  extend: {
    colors: {
      bg: { base: '#121212', surface: '#1a1a1a', hover: '#252525', elevated: '#2a2a2a' },
      text: { primary: '#ffffff', secondary: '#a0a0a0', muted: '#666666' },
      accent: { DEFAULT: '#f97316', hover: '#ea580c', muted: '#fdba74' },
    },
    fontFamily: {
      display: ['"Russo One"', 'system-ui', 'sans-serif'],
      body: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
    },
    borderRadius: { sm: '4px', md: '8px', lg: '12px' },
  }
}
```

### 6.2 Z-Index Scale

```
z-10:  Dropdowns, overlays
z-20:  Modals
z-30:  Lightbox
z-40:  Toast notifications
z-50:  Navbar (sticky)
```

---

## 7. Anti-Patterns (Do Not Do)

- ❌ No emoji as icons — use lucide-react SVG icons
- ❌ No layout-shifting hover effects — use transform: scale on thumbnails only
- ❌ No flat design without depth — use shadows, gradients, surface colors
- ❌ No text-heavy pages — game store is visual-first
- ❌ No light mode — pure dark theme only
- ❌ No autoplay video in carousel — only static images with transitions
- ❌ No inline styles — all styling through Tailwind utility classes
- ❌ No FOIT — font-display: swap + preload Google Fonts

---

## 8. Dev Handoff Checklist

- [ ] Design tokens implemented as CSS variables in index.css
- [ ] Typography: Russo One + Chakra Petch loaded via Google Fonts
- [ ] All colors match the palette exactly
- [ ] Spacing follows 8px scale
- [ ] Every component has hover, focus, active, disabled states
- [ ] Loading skeletons for all async content
- [ ] Empty + error states for all data-driven sections
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] Touch targets ≥ 44px on mobile
- [ ] prefers-reduced-motion respected
- [ ] All icons from lucide-react (consistent set)
- [ ] cursor-pointer on all interactive elements
