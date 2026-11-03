# Social Proof System — Moxic GameStore

**Date:** 2026-06-26
**Status:** Approved

## Overview

Add social proof signals to game detail page: purchase count (from real orders), store ratings & reviews (admin-managed, seeded fake). Builds trust for Vietnamese buyers.

## Data Model

### New Entity: `GameReview`

| Field | Type | Notes |
|-------|------|-------|
| Id | Guid | PK |
| GameId | Guid | FK → Game |
| UserName | string | Vietnamese name |
| AvatarUrl | string? | gravatar/pravatar URL |
| Rating | int | 4 or 5 |
| Content | string | Review content (Vietnamese) |
| CreatedAt | DateTime | UTC |

`Game.cs` gets `List<GameReview> Reviews`.

### DTO: `GameReviewDto`

Same fields minus `GameId`. Embedded in `GameDetailDto`.

### `GameDetailDto` — new fields

| Field | Type | Source |
|-------|------|--------|
| PurchaseCount | int | Count from OrderDetail (all statuses) |
| StoreRating | double | AVG(Review.Rating), fallback 5.0 |
| Reviews | List<GameReviewDto> | Latest 8, desc |

## Backend

### Endpoints

**Existing `GET /api/games/{id}`** — enhanced:
- `.Include(g => g.Reviews)` added
- `PurchaseCount` = `dbContext.OrderDetails.Count(od => od.GameId == id)`
- `StoreRating` = `Reviews.Any() ? Math.Round(Reviews.Average(r => r.Rating), 1) : 5.0`
- Map reviews to DTO, take 8 newest

**New admin endpoints** (`AdminReviewsController` or in existing admin controller):
- `GET /api/admin/games/{gameId}/reviews` — list all reviews for a game
- `POST /api/admin/games/{gameId}/reviews` — create review (body: userName, content, rating)
- `DELETE /api/admin/games/{gameId}/reviews/{id}` — delete review

### Seeder

`ReviewSeeder.cs`:
- Pool of 10 Vietnamese names + pravatar URLs
- Pool of 10 trust-focused Vietnamese review texts
- Each game gets 5-8 reviews (random count)
- Rating: 70% 5★, 30% 4★ (random weighted)
- CreatedAt: random within last 60 days
- Idempotent: skip if `GameReviews.AnyAsync()` for seeded games

## Frontend

### Types (`game.ts`)

Add `GameReview` interface, extend `GameDetail` with `purchaseCount`, `storeRating`, `reviews[]`.

### API

No new calls — existing `getGameDetail` already fetches the enhanced DTO.

### GameDetailPage — new sections

#### 1. Purchase count
Below game name + badges:
```
🔥 2,347 người đã mua
```

Show only if `purchaseCount > 0`.

#### 2. Store Rating + Reviews section
Between system requirements and related games section. Full-width.

```
Section header: ⭐ Đánh giá từ người mua    {storeRating} / 5
```

Grid/flex layout for review cards:
```
[avatar 36px circle] [name]    [★★★★★]    [X ngày trước]
                     [Review content - full width]
```

#### 3. Empty reviews
If `reviews.length === 0`, hide the whole review section. `storeRating` shows "5.0" as a small badge.

### Admin page

New page at `/admin/games/:id/reviews`:
- Table with columns: avatar, name, rating, content, created, actions
- "Add review" button → modal: name input, rating select (4 or 5), content textarea
- Delete button per row
- Reuse existing admin layout

### Utilities

Add `timeAgo(date: string): string` returning Vietnamese:
- "Vài giây trước", "X phút trước", "X giờ trước", "X ngày trước", "X tuần trước", "X tháng trước"

### Seed data details

**Users:**
Minh Anh, Hoàng Long, Thu Trang, Đức Huy, Phương Linh, Tuấn Kiệt, Bảo Ngọc, Thanh Tùng, Mai Chi, Quốc Bình

**Review content (all Vietnamese, trust-focused):**
1. "Lần đầu mua trên Moxic, hơi lo nhưng cài game nhanh và uy tín. Sẽ ủng hộ dài dài!"
2. "Mua game thứ 3 rồi, giá rẻ hơn Store nhiều. Anh chủ support nhiệt tình lắm ạ."
3. "Đặt GTA VI pre-order, giá tốt nhất mình tìm được. Chờ ngày ra mắt thôi!"
4. "Cài game trong 20 phút, không phải lo gì. Store uy tín, recommend cho ae."
5. "So sánh giá thì Moxic rẻ hơn hẳn, quan trọng là uy tín. Mua đi đừng ngại!"
6. "Hơi nghi ngờ vì giá rẻ quá, nhưng anh chủ tư vấn kỹ và cài game thành công."
7. "Đã mua Elden Ring bản Deluxe, giá chỉ bằng nửa Store. Anh chủ support tận tình."
8. "Lần 3 mua ở đây rồi, chưa bao giờ thất vọng. Cài nhanh - gọn - uy tín."
9. "Pre-order game mới nhất, giá ưu đãi hơn hẳn bên ngoài. Tin tưởng Moxic!"
10. "Được bạn giới thiệu, thử mua 1 lần. Từ đó thành khách quen luôn. 5 sao nhé!"

## Implementation Order

1. Add `GameReview` entity + DbContext config + migration
2. Update `GameDetailDto` + endpoint logic
3. Seed reviews for existing games
4. Admin CRUD endpoints
5. Frontend: types, timeAgo util
6. Frontend: purchase count + reviews UI on detail page
7. Admin FE page for reviews
8. Verify end-to-end
