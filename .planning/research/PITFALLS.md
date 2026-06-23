# Pitfalls Research: Moxic GameStore

## 🔴 Critical

### 1. Xbox Password Storage
**Risk:** Customer provides Xbox account password — this is highly sensitive.
**Mitigation:**
- Encrypt at rest using AES-256 (ASP.NET Core Data Protection)
- Only accessible via Admin UI (never exposed in API responses to public)
- Clear privacy notice + promise to delete after installation
- Log access to this field (audit trail)

### 2. Manual Payment Verification
**Risk:** Admin might accidentally mark wrong order as paid (human error)
**Mitigation:**
- Show transfer amount prominently in order detail
- Include order code in transfer content template
- Add confirmation dialog before status change
- Optional: Show expected vs actual transfer amount field

### 3. Order Code Collision
**Risk:** Two orders with same code cause confusion
**Mitigation:**
- Use prefix (DH) + datetime-based sequential number: DH-20260623-001
- Or use GUID short form for order reference
- Validate uniqueness at DB level

## 🟡 Important

### 4. Race Condition: Double Payment
**Risk:** Customer pays twice because QR shown twice
**Mitigation:**
- Once order is created with Pending status, same cart can't create another order
- Show "Order created — awaiting payment" page, not a second QR

### 5. Preorder Date Management
**Risk:** Game releases but admin forgets to process preorders
**Mitigation:**
- Admin dashboard shows preorders needing attention
- Email notification to admin when release date passes
- Order list filter: "Preorders pending installation"

### 6. MinIO Presigned URL Expiry
**Risk:** Images stop loading after URL expires
**Mitigation:**
- Set expiry to 1 hour (reasonable for browsing)
- Frontend retries on 403: refetch new presigned URL
- Or use proxy endpoint that generates URL on-the-fly

### 7. EF Core Migration Issues
**Risk:** Data loss or broken migrations during Code First development
**Mitigation:**
- Use `EnsureCreated` for initial dev, then switch to migrations
- Always version migrations
- Never delete migration files once applied to a shared DB

### 8. SEO for Game Detail Pages
**Risk:** Games not findable on Google
**Mitigation:**
- Use React Helmet for meta tags per game page
- Server-side rendering (SSR) if budget allows (Next.js in future)
- Phase 1: Focus on structured data + meta tags

## 🟢 Minor

### 9. Cart Persistence
**Risk:** Anonymous user loses cart on browser close
**Mitigation:**
- Store cart in localStorage for anonymous users
- Store cart in DB for logged-in users (if registration needed)

### 10. Image Loading UX
**Risk:** Large game covers load slowly
**Mitigation:**
- Use loading="lazy" on images
- Set explicit width/height to prevent layout shift
- Consider WebP format for cover images

### 11. Email Deliverability
**Risk:** Order notifications land in spam
**Mitigation:**
- Use transactional email service (SendGrid, SES)
- Proper SPF/DKIM for custom domain
- Clear "from" name matching business name

### 12. Timezone Handling
**Risk:** Release date mismatch between admin and customer view
**Mitigation:**
- Store all dates in UTC
- Convert to Asia/Saigon (UTC+7) on display
- Use DateTimeOffset for release dates

---
*Research completed: 2026-06-23*
