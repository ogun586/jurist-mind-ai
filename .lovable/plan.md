## JuristMind — Lawyer Digital Identity Rebuild

A scoped, realistic plan to rebuild "Connect with Lawyers" as a trust-first, SEO-aware digital identity system on the existing Vite + React + Supabase stack.

### Important constraint upfront
This project is Vite + React (SPA), not Next.js / Remix. True SSR is **not** possible without migrating the whole stack. I will deliver the closest practical equivalent:
- `react-helmet-async` for dynamic per-profile `<title>`, meta, OG, and JSON-LD (LegalService schema)
- A Supabase Edge Function `lawyers-sitemap` that streams `sitemap.xml` from the DB
- A public, unauthenticated lawyer profile route so Googlebot (which executes JS) can index it
- Note this limitation honestly: non-JS social crawlers (LinkedIn, Slack) will see only the static index.html head

If full SSR is required for indexing guarantees, that's a separate stack migration.

---

### Phase 1 — Backend schema (single migration)

Extend existing tables instead of duplicating:

`lawyers` table additions:
- `is_verified boolean default false` (mirror of verification_status='verified' for fast filtering)
- `address_json jsonb` — `{ street, city, state, postal_code, country, lat, lng }`
- already has: `firm_logo_url`, `brand_accent_color`, `bio_structured`, `slug`, `country_id_ref`

New tables:
- `lawyer_schedules` — weekly availability slots (`day_of_week`, `start_time`, `end_time`, `mode` office|virtual)
- `consultations` — `lawyer_id`, `client_id`, `status` (requested|scheduled|completed|cancelled), `scheduled_at`
- `lawyer_reviews` — gated by trigger: only insert allowed when matching `consultations.status = 'completed'`
- `client_intake_files` — metadata for files in private `client-intake` storage bucket; RLS so only the assigned lawyer + uploader can read

Slug trigger already exists (`generate_lawyer_slug`) — extend to lock slug after `is_verified = true`.

Storage:
- Reuse existing private `lawyer-credentials` bucket
- New private `client-intake` bucket with strict RLS

All new tables get GRANTs + RLS policies in the same migration.

---

### Phase 2 — SEO layer

- Install `react-helmet-async`, wrap `<App>` in `<HelmetProvider>`
- `LawyerProfilePage`: emit `<Helmet>` with title `{Name} | {Specialization} in {City} | JuristMind`, meta description from `bio_structured.about`, canonical, OG tags, and JSON-LD `LegalService` (name, address, areaServed, knowsAbout, aggregateRating)
- Make `/lawyers/:slug` accessible without auth (currently behind app shell)
- Edge function `lawyers-sitemap`: returns `sitemap.xml` listing every verified lawyer; expose via `public/sitemap.xml` redirect or direct edge URL referenced from robots.txt

---

### Phase 3 — Smart bridge features

- Schedules UI on lawyer profile (read) + dashboard (edit own)
- Availability badge derived from `lawyer_schedules` + current time → Available / Busy / Offline
- Consultation request flow: client submits → lawyer accepts → on completion, review becomes possible
- Reviews: replace/augment existing `lawyer_ratings` with `lawyer_reviews` gated by completed consultation (DB trigger enforces)
- Intake vault: upload component on profile → file lands in `client-intake/{lawyer_id}/{consultation_id}/`; RLS restricts read to uploader + lawyer

---

### Phase 4 — UI polish

- Apply `brand_accent_color` to CTAs/badges only (already partially done)
- Sticky mobile action bar on profile (Message / Call / Book)
- Skeleton shimmer states already exist — extend to schedule + reviews sections
- Multi-country registration: `RegisterLawyerDialog` already uses `useCountryId` — verify it works for every active country in `countries` table and surface country prominently

---

### Phase 5 — Directory page

- Country filter in search bar uses `countries` table (active only)
- Cards link to public `/lawyers/{slug}` (no auth)
- "Register as a lawyer" CTA visible to any signed-in user without a lawyer profile, regardless of country

---

### Technical details

Files to create:
- `supabase/migrations/<ts>_lawyer_identity.sql` (schema + RLS + GRANTs + bucket)
- `supabase/functions/lawyers-sitemap/index.ts`
- `supabase/functions/manage-consultations/index.ts`
- `src/components/lawyers/LawyerSchedule.tsx`
- `src/components/lawyers/ConsultationRequest.tsx`
- `src/components/lawyers/ReviewForm.tsx` (gated)
- `src/components/lawyers/IntakeVault.tsx`
- `src/components/lawyers/StickyMobileActions.tsx`

Files to edit:
- `src/main.tsx` — add `HelmetProvider`
- `src/App.tsx` — make `/lawyers/:slug` public route
- `src/components/lawyers/LawyerProfilePage.tsx` — Helmet + JSON-LD + new sections + sticky bar
- `src/pages/LawyersDirectory.tsx` — country filter from `countries` table
- `src/components/lawyers/RegisterLawyerDialog.tsx` — confirm country-scoped registration works for all countries
- `public/robots.txt` — reference sitemap edge URL
- `package.json` — add `react-helmet-async`

---

### Open questions before I build

1. **SSR limitation acceptable?** — Vite SPA + Helmet works for Googlebot but not for LinkedIn/Slack previews. Migrating to Next.js is out of scope. Confirm we proceed with the Helmet approach.
2. **Reviews migration** — Keep existing `lawyer_ratings` (open) alongside new gated `lawyer_reviews`, or replace entirely (and drop existing ratings data)?
3. **Consultations scope** — Full booking flow (calendar picker, time slots, accept/decline) or v1 = simple request form + lawyer marks completed?
4. **Phase order** — Build all phases now in one large delivery, or ship Phase 1 (schema) + Phase 2 (SEO) first and Phase 3 (consultations/reviews/intake) in a second pass?
