# Jungle Lounge Intel — Handoff Document

## Project Overview
Full-stack business intelligence app for a rare exotic plant reselling business (Palmstreet live streams, Miami Beach). Built with Next.js 14, Tailwind CSS v3, Supabase, and Anthropic Claude API.

## Key Details
- **Repo**: https://github.com/jerryfreedman/junglelounge.git
- **Dev server**: `npm run dev -- --port 3005` (runs on user's Mac, NOT the VM)
- **Project folder**: `~/Documents/Claude/Projects/Jungle Lounge/jungle-lounge-intel` (mounted at `/sessions/cool-epic-babbage/mnt/Jungle Lounge/jungle-lounge-intel` in the VM)
- **Login password**: `123456` (hardcoded, stored in localStorage)
- **Supabase URL**: `https://rcphhirifeqltjzgkqxr.supabase.co`
- **VM cannot reach external APIs** — Supabase/Anthropic calls only work when the app runs on the user's Mac

## Important Constraints
- Never use the phrase "Jungle Jam" anywhere — streams are "Jungle Lounge streams"
- Brand palette: Hot pink #F4607A, Flamingo blush #F4849A, Deep jungle green #1A3D1F, Tropical leaf #4A8C3F, Warm wood #8B5E3C, Dark bg #0F2410
- Fonts: Righteous (headings), DM Sans (body) via Google Fonts
- Desktop-first, mobile responsive with hamburger sidebar
- Single user auth, no Supabase Auth — just localStorage
- All env vars in `.env.local` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY)

## Current Status

### Session 1 — COMPLETE ✅
- Next.js 14 + Tailwind v3 initialized
- Login page with password auth
- App shell: navbar, sidebar (8 nav links), mobile hamburger
- All placeholder pages created
- Full brand palette applied throughout
- Pushed to GitHub

### Session 2 — COMPLETE ✅
- **Supabase tables created**: settings, batches, sales, streams, customers, wishlists, wishlist_notifications, email_drafts (SQL in `supabase-setup.sql`)
- **Settings page** (`/settings`): Palmstreet fee % config, saves to Supabase. Currently set to 20% in DB (was 15%, changed during testing).
- **Inventory page** (`/inventory`): Add/edit/delete batches, live cost-per-plant calc, sortable table, color-coded stock status badges (green/yellow/red), aging column (green <14d, yellow 14-30d, red >30d), aging alert banner, low stock warning banner.
- **Sales page** (`/sales`): Log sales with batch linking, live profit preview showing fee/shipping/profit/margin, searchable sortable table, refund modal.
- **Dashboard** (`/dashboard`): 6 metric cards (revenue, profit, margin, sales count, avg price, refunds), date range filter, top 10 plants by profit table.
- All data flows live from Supabase.

### Session 3 — IN PROGRESS 🔨
- **CSVImportModal component created** at `src/components/CSVImportModal.tsx` — full 4-step import flow (upload, map columns, assign costs, review/confirm) with duplicate detection, saved column mapping, and flamingo loading animation
- **NOT YET DONE**:
  - Integrate CSVImportModal into the Sales page (add import button + state management)
  - Build CSV export function (download all sales + batches + P&L summary)
  - Test the import flow end-to-end

### Sessions 4–7 — NOT STARTED ❌

## What to Build Next

### Finish Session 3 — CSV Import & Export
1. In `src/app/sales/page.tsx`:
   - Add `import CSVImportModal from '@/components/CSVImportModal'`
   - Add state: `const [showImport, setShowImport] = useState(false)`
   - Add "Import from Palmstreet" button near the top of the page
   - Add `<CSVImportModal isOpen={showImport} onClose={() => setShowImport(false)} onComplete={loadData} batches={batches} feePct={feePct} />` at the bottom
2. Build CSV export function — button that downloads a CSV with all sales, batches, and P&L summary
3. Test import with sample CSV, test export

### Session 4 — Customer CRM & Wishlist
- See project instructions for full spec
- Tables already created in Supabase (customers, wishlists, wishlist_notifications)
- Build at `src/app/customers/page.tsx` (currently a placeholder)

### Session 5 — Stream Tracker & Inventory Aging
- Build at `src/app/streams/page.tsx` (currently a placeholder)
- streams table already exists in Supabase
- Extend inventory aging alerts

### Session 6 — Pricing Intelligence & Supplier ROI
- Build at `src/app/pricing/page.tsx` (currently a placeholder)
- New supplier ROI section (could be separate page or tab)

### Session 7 — AI Email Generator
- Build at `src/app/emails/page.tsx` (currently a placeholder)
- email_drafts table already exists
- Uses Anthropic Claude API (claude-sonnet-4-6) via API route
- Specific system prompt provided in project instructions — DO NOT MODIFY IT

## File Structure
```
src/
  app/
    layout.tsx          — Root layout with fonts
    page.tsx            — Auth redirect
    login/page.tsx      — Login page
    dashboard/page.tsx  — P&L dashboard
    inventory/page.tsx  — Batch management
    sales/page.tsx      — Sales logging
    settings/page.tsx   — Palmstreet fee config
    streams/page.tsx    — Placeholder
    customers/page.tsx  — Placeholder
    pricing/page.tsx    — Placeholder
    emails/page.tsx     — Placeholder
  components/
    AppShell.tsx        — Protected layout wrapper
    Navbar.tsx          — Top navbar
    Sidebar.tsx         — Left sidebar nav
    Logo.tsx            — SVG flamingo logo
    CSVImportModal.tsx  — CSV import (built, not integrated)
  lib/
    supabase.ts         — Supabase client + TypeScript interfaces
    auth.tsx            — Auth context (may not be in use)
```

## Known Issues
- The Settings page "✓ Settings saved!" confirmation message may not display (the save itself WORKS — confirmed via network requests returning 200 and values persisting across reloads). The fix was simplified to not use `.select().single()` on the update response.
- Palmstreet fee currently set to 20% in the database (should probably be set to 15% for realistic testing).
- The existing test sale in the DB (Monstera Thai Constellation) was created when the fee was at 0%, so its profit numbers may be off.

## Testing Protocol (per project instructions)
After each session:
1. Open localhost:3005 in Chrome
2. Click through every button, form, and page
3. Check browser console for JS errors
4. Fix every bug found
5. Commit and push to GitHub (user pushes from Mac terminal)
6. Immediately begin next session

## Git Workflow
- VM can edit files but user must push from their Mac terminal
- Commands: `cd ~/Documents/Claude/Projects/Jungle\ Lounge/jungle-lounge-intel && git add -A && git commit -m "message" && git push origin main`
