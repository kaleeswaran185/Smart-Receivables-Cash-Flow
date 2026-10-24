# Baaki (बाकी) - Smart Receivables & Cash Flow Assistant for Small Businesses

> **Never let overdue invoices choke your business.** A proactive, GST-compliant receivables and cash flow management platform designed specifically for Indian MSMEs, manufacturers, and traders.

---

## 🌐 Live Deployment & Links

| Service | Platform | URL |
|---|---|---|
| **Frontend Web App** | Vercel | `https://baaki-receivables.vercel.app` *(Configurable)* |
| **Backend REST API** | Render | `https://smart-receivables-cash-flow.onrender.com` |
| **API Health Check** | Render | `https://smart-receivables-cash-flow.onrender.com/api/health` |
| **Product Walkthrough Video** | YouTube | `https://youtu.be/placeholder-demo` *(Demo)* |

---

## 🔑 Instant Demo Access & Authentication Architecture

Baaki runs in **zero-friction demo mode** by default. Opening the app lands immediately on the Executive Dashboard with pre-seeded, realistic Indian business data (Sharma Packaging Solutions Pvt Ltd). No manual credentials or login screen required.

| Parameter | Configuration | Details |
|---|---|---|
| **Demo Session** | Automated & Silent | App starts by silently requesting a Bearer token via `POST /api/auth/demo-login` kept in memory and `sessionStorage`. |
| **Token Auto-Refresh** | Automatic on 401 | On any 401 response (e.g. server restart), the API client transparently refreshes the session once and retries the request. |
| **Backend Environment** | `DEMO_MODE=true` | Required in production for silent demo authentication. Logs a clear warning if false. |
| **Security Secret** | `AUTH_SECRET` | Cryptographic secret for signing session HMAC tokens. Strictly required in production from env. |
| **Reset Demo Cooldown** | 60 seconds | Rate-limited against abuse (with explicit confirmation bypass for testing). |
| **Public Pay Links** | Fully Public | Zero authentication required at `/pay/:token` for customer payment settlement. |

---

## 📸 Application Screenshots (Desktop 1280px & Mobile 360px)

Every view in Baaki is tested against both desktop (1280px) and mobile phone (360px) viewports with strict accessibility standards (zero horizontal overflow, 48px+ touch targets, and status always shown with text + color, never color alone).

| Screen | Desktop View (1280px) | Mobile View (360px) |
|---|---|---|
| **Executive Dashboard** | [dashboard_1280.png](docs/screenshots/dashboard_1280.png) | [dashboard_360.png](docs/screenshots/dashboard_360.png) |
| **Chase-First Priority** | [chase_first_1280.png](docs/screenshots/chase_first_1280.png) | [chase_first_360.png](docs/screenshots/chase_first_360.png) |
| **Today's Follow-ups** | [followups_1280.png](docs/screenshots/followups_1280.png) | [followups_360.png](docs/screenshots/followups_360.png) |
| **13-Week Cash Forecast** | [forecast_1280.png](docs/screenshots/forecast_1280.png) | [forecast_360.png](docs/screenshots/forecast_360.png) |
| **Public Pay Portal** | [pay_page_1280.png](docs/screenshots/pay_page_1280.png) | [pay_page_360.png](docs/screenshots/pay_page_360.png) |
| **Merchant Inbox** | [inbox_1280.png](docs/screenshots/inbox_1280.png) | [inbox_360.png](docs/screenshots/inbox_360.png) |
| **Invoice Ledger & Detail** | [invoice_1280.png](docs/screenshots/invoice_1280.png) | [invoice_360.png](docs/screenshots/invoice_360.png) |
| **Demand Letter Preview** | [demand_letter_print_1280.png](docs/screenshots/demand_letter_print_1280.png) | [demand_letter_print_360.png](docs/screenshots/demand_letter_print_360.png) |

---

## 📌 Problem Statement & Context

Indian small and medium enterprises (MSMEs) operate on razor-thin cash flow margins. While Section 43B(h) of the Income Tax Act mandates 45-day settlement for MSME dues, business owners face recurring working capital bottlenecks:
1. **Blindspot Shortfalls**: Business owners rarely know when a cash deficit will occur until their bank account is depleted and cheques bounce.
2. **Awkward & Ineffective Chasing**: Manual phone calls or haphazard WhatsApp messages strain customer relationships and lack disciplined escalation.
3. **Complex Indian GST & TDS Realities**: Reconciling payments with 1%, 2%, or 10% TDS deductions (Section 194C/J) creates administrative chaos and unapplied balances.
4. **Dispute & Promise Tracking Gaps**: When a customer disputes an item or promises to pay on the 15th, reminders must pause and resume automatically rather than continuing blindly.

**Baaki (बाकी)** solves this with a predictive, automated cash flow forecasting engine, an intelligent "Chase-First" priority ladder, GST-compliant billing, and bank statement auto-matching.

---

## 🚀 Core Features

### 1. 13-Week Cash Forecast & Safety Buffer Shortfall Detection
- Calculates cumulative weekly cash flow: $\text{Week } N \text{ Closing} = \text{Week } N+1 \text{ Opening}$.
- Integrates customer payment delay behavior into expected collection dates ($\text{Due Date} + \text{Customer Avg Delay}$).
- Alerts business owners weeks in advance of the first week dipping below their custom **Safety Buffer** (₹5,00,000.00).
- **Planned Demo Shortage**: **Week 3 (2026-11-05 to 2026-11-11)** dips **₹76,887.60** below the safety buffer.
- **Smallest Gap-Covering Set**: Dynamically returns the smallest set (at most 3 invoices, ranked by priority) capable of bridging the deficit:
  - Top Recommendation: `#INV-2026-1030` — Gurugram Retail Ventures [DEMO] (Balance: ₹6,10,650 vs Shortfall: ₹76,887.60; covers 100% of the deficit).
- **Interactive What-If Scenarios**: Simulate what happens if a major customer delays by 30 days, a supplier payment is postponed, or a big customer pays early.

### 2. Intelligent "Chase-First" Priority Scoring (0–100)
- Prioritizes overdue invoices using a multi-factor weighting algorithm:
  - Outstanding balance magnitude (realistic distribution: largest invoice is 17.1% of receivables, well under 33.3%).
  - Days overdue past credit period.
  - Customer reliability rating (Grade A, B, C).
  - Immediate impact on resolving the impending cash shortage.
- **Strict Scoring Invariants**:
  - Scoring never saturates: exactly **1 invoice at 100** (`INV-2026-1030`), with top 5 scores completely distinct (`100, 86, 78, 75, 67`).
  - Generates clear, human-readable explanations (e.g., *"₹6,10,650 Overdue 30 days (Grade C customer). Collecting this covers the Week 3 cash deficit (₹76,887.60 below safety buffer)."*).

### 3. Multi-Channel Escalation Ladder (-3 to +45 Days)
- **6-Stage Progressive Ladder**:
  - `-3 Days`: Friendly pre-due reminder.
  - `Day 0`: Due today courtesy notification.
  - `+7 Days`: Gentle overdue follow-up.
  - `+15 Days`: Firm overdue notice.
  - `+30 Days`: Urgent credit hold warning.
  - `+45 Days`: Formal Payment Demand Letter.
- Direct communication triggers: WhatsApp (`wa.me` pre-filled templates), Email (`mailto:`), and SMS (`sms:`).
- **Automatic State Freezing**:
  - Reminders pause immediately when an invoice is disputed.
  - Reminders pause upon a Promise to Pay and automatically resume if the promised date lapses without payment.
  - Partial payments maintain invoice tracking on remaining balance.
  - Idempotent: The same reminder stage cannot be sent twice for an invoice.

### 4. Public No-Login Pay Portal (`/pay/:token`)
- Customers receive secure, tokenized payment links without requiring an account or login.
- Dynamic UPI deep link (`upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...`) for instant 1-tap mobile payments on PhonePe, Google Pay, and Paytm.
- **"I've Already Paid" Self-Serve Flow**: Customers submit payment claims (mode, UTR/ref, date, notes) that land directly in the merchant's **Inbox** for verification.
- **"Something Is Wrong" Self-Serve Dispute**: Customers raise structured disputes with disputed amounts and reasons, pausing automatic reminders instantly.

### 5. Overpayment & Credit Handling
- Replaces harsh 400 errors with an explicit confirmation step (`overpayment=true` and `OVERPAYMENT_CONFIRMATION_REQUIRED`).
- The UI presents a clear amber warning card showing the exact excess amount and prompts: *"Yes, Confirm Overpayment & Hold Credit"*.
- Excess payments are safely held in the `customer_credits` ledger for future offset.
- Retries with the same reference number are idempotent and will never double-record.

### 6. Bank Statement CSV Import & Reconciliation (SPEC Section 18)
- Accepts standard Indian bank statement CSV exports (HDFC, ICICI, SBI, Axis).
- **Hierarchical Auto-Matching**: Matches credits by invoice number in narration, customer name tokens, or exact balance.
- **TDS Shortfall Detection**: Automatically identifies 1%, 2%, or 10% TDS deductions (Section 194C/J), displays shortfall hints (e.g. `⚡ 2% TDS Shortfall: ₹2,449.00`), and allows 1-click full credit with tax offset.
- **Deterministic SHA-256 Idempotency**: Re-importing overlapping or duplicate statements skips already-staged and already-reconciled rows safely.
- **Strict Invariant**: *"Nothing paid until I confirm"* — previewing is 100% read-only; balances only update upon explicit confirmation.

### 7. GST-Compliant Document Engine
- Generates print-ready **Tax Invoices** (for Regular GST), **Bills of Supply** (for Composition Scheme), and plain invoices.
- Automated compliance note for turnover exceeding ₹5 Crore (informing recipient of standard e-invoicing provisions without false IRN claims).
- **Formal Payment Demand Letter**: Displays exact non-legal disclaimer (*"This letter is from the business regarding outstanding invoices. It is not a notice from the GST department and not a legal notice from a lawyer"*), bank and UPI coordinates, part payment ledger, and zero government/court branding.
- Uses clean CSS `@media print` with browser-native `window.print()` — zero third-party PDF bloat.

### 8. Accessibility & Multilingual Support (English, Hindi, Hinglish)
- Full UI translation between **English**, **Hindi (हिन्दी)**, and **Hinglish**.
- Dynamic font scaling: Normal (16px), Large (18px), and Extra Large (20px).
- Strict accessible design: Status is **always text + color** (never color alone), and interactive targets maintain minimum 48px touch padding.

### 9. Interactive Demo Date Simulator
- Time-travel simulator allowing evaluators to advance the application clock (e.g. +14 days to `2026-11-05`) to observe ageing shifts, reminders advancing, and cash forecasts evolving.
- One-click **Reset Demo** restores initial state in milliseconds (with a 60-second cooldown protection).

---

## 🎬 18-Step End-to-End Demo Story Walkthrough

Follow these 18 steps to experience the complete platform lifecycle:

1. **Owner Authentication**: Visit `/login` and click **"⚡ One-Click Demo Login"** (or sign in with `owner@baaki.app` / `baaki123`).
2. **Dashboard Overview**: Inspect the executive KPIs: Total Outstanding (~₹35.61L across 7 open invoices), Expected This Week, and Overdue totals.
3. **Chase-First Priority**: Scroll to the Chase-First card. Notice invoice `#INV-2026-1030` (Gurugram Retail Ventures) is ranked #1 with Score `100/100`.
4. **13-Week Cash Forecast**: Navigate to `/forecast`. Review the rolling 13-week table where Week $N$ Closing strictly equals Week $N+1$ Opening.
5. **Shortfall Detection**: Observe the alert: **Week 3 (2026-11-05 to 2026-11-11)** is highlighted with a cash shortfall of **₹76,887.60** below the ₹5,00,000 safety buffer.
6. **Gap-Covering Invoices**: Notice the smallest set card recommending `INV-2026-1030` (₹6,10,650 balance vs ₹76,887.60 shortfall), which will eliminate the shortage.
7. **What-If Simulation**: Toggle the simulation buttons (e.g. "What if Gurugram delays by 30 days?") to see the deficit deepen in real-time.
8. **Follow-ups Queue**: Go to `/followups`. Review overdue invoices scheduled on the 6-stage escalation ladder.
9. **Omnichannel Communication**: Click the **WhatsApp** or **Email** button on any reminder card to preview the pre-filled template.
10. **Public Pay Portal**: Navigate to `/pay/pay_inv_2026_1040_40` in a new tab or incognito window (no login required).
11. **Instant UPI Settlement**: View the dynamic UPI QR code and deep link configured with the business VPA (`sharmapackaging@demo`).
12. **Customer Raises Dispute**: On the pay portal, click **"Something is wrong"**, enter *"5 cartons damaged during transit [DEMO TEST]"*, and submit.
13. **Reminder Freeze**: Return to the app. Check `/invoices` — the invoice status is updated to `DISPUTED` and reminders are paused immediately.
14. **Merchant Inbox**: Navigate to `/inbox`. Under the **Disputes** tab, review the customer's claim.
15. **Dispute Resolution**: Click **"Resolve Dispute"**, type resolution notes (*"Issued replacement via express courier"*), and resolve. Reminders automatically resume.
16. **Record Settlement**: Navigate to `/payments` or click **"Record Payment"**. Settle the invoice via UPI with reference `UTR_DEMO_STORY_9999`.
17. **Dashboard Real-Time Update**: Return to `/dashboard`. Total receivables immediately drops by the paid amount.
18. **Time-Travel Simulator**: Go to `/settings`. Change the Demo Date to `2026-11-05` to observe invoices transitioning to higher overdue stages. When done, click **"Reset Demo Data"** to restore clean seed state.

---

## 🛠️ Tech Stack & Architecture

```
baaki/
├── backend/                  # Node.js + Express REST API (ESM)
│   ├── src/
│   │   ├── app.js            # Express application with CORS & routes
│   │   ├── index.js          # Startup guard (enforces AUTH_SECRET in prod) & auto-seed
│   │   ├── db.js             # better-sqlite3 connection with WAL mode & foreign keys
│   │   ├── schema.sql        # Relational schema (13 tables, integer paise math)
│   │   ├── seed.js           # Deterministic realistic Indian MSME seed data
│   │   ├── lib/              # Core business logic
│   │   │   ├── money.js      # Integer-paise math & Indian Lakh/Crore formatting
│   │   │   ├── gst.js        # Mod-36 GSTIN verification & tax component rounding
│   │   │   ├── customerStats.js # Customer grading (A/B/C) algorithm
│   │   │   └── dateUtils.js  # Rolling 13-week date math
│   │   ├── middleware/
│   │   │   └── auth.js       # Authorization Bearer token parser & prod guard
│   │   ├── services/
│   │   │   ├── sharedCashService.js # Single source of truth for forecast, KPIs & chase
│   │   │   ├── chaseService.js      # 0-100 chase scoring & dispute lists
│   │   │   ├── reminderService.js   # 6-stage escalation ladder & templates
│   │   │   └── forecastService.js   # 13-week cash forecasting engine
│   │   └── routes/           # REST endpoints (/auth, /dashboard, /invoices, /payments, etc.)
│   └── test/                 # 80 automated unit, integration, and security tests
├── frontend/                 # React 18 + Vite SPA
│   ├── src/
│   │   ├── components/       # Accessible UI components & ServerWakeupGuard
│   │   ├── context/          # AuthContext & DemoContext
│   │   ├── pages/            # Page controllers (Dashboard, Follow-ups, Forecast, etc.)
│   │   ├── services/api.js   # VITE_API_URL-driven API client (prod-guard against missing URL)
│   │   └── utils/            # Money, date, and i18n dictionaries
│   └── vercel.json           # SPA routing rewrite for Vercel
├── docs/
│   └── screenshots/          # 16 screenshots at 1280px & 360px
├── sample_bank_statement.csv # Realistic sample bank statement CSV
└── render.yaml               # Cloud deployment descriptor for Render (Node 20.18.0)
```

---

## 🧪 Automated Test Suite (80 of 80 Passing)

The backend features a comprehensive test suite executed using Node.js built-in test runner (`node --test`):

```bash
cd backend
npm test
```

### Test Suite Summary:
```
ℹ tests 80
ℹ suites 13
ℹ pass 80
ℹ fail 0
```

- **Money & GST Precision (T21–T25)**:
  - Integer-paise math only (zero floating-point numbers in money calculations).
  - Exact 3 x ₹333 @5% outputs: intra-state CGST ₹24.98, SGST ₹24.98, round off +₹0.04, total ₹1,049.00; inter-state IGST ₹49.95, round off +₹0.05, total ₹1,049.00.
  - Round-off boundary validation (.49 down, .50 up, negative round-off line).
  - Indian currency words handling paise and Crores.
  - Base-36 Mod-36 GSTIN checksum verification and state code 27 mapping to Maharashtra.
- **Payments & Credits (T26–T28, T44)**:
  - Pending payment does not alter balance; confirmed payment does; rejected payment does not.
  - Self-serve "I've already paid" creates merchant inbox claim without modifying balance.
  - Overpayment confirmation: flags overpayment, creates `customer_credits` record, and network retry does not double-record.
- **Derived State & Ageing (T29–T30)**:
  - Ageing buckets (0, 1, 30, 31, 60, 61, 90, 91 days).
  - Invoice statuses transition accurately as demo date advances.
- **Reminder Escalation Ladder (T31–T33)**:
  - Advancing date +30 days creates only the highest due stage; earlier stages marked skipped.
  - Concurrent POSTs for same stage: UNIQUE constraint ensures exactly one succeeds.
  - Dispute pauses ladder; resolution resumes; promise pauses until date then resumes.
- **Forecast & Chase-First (T34–T38)**:
  - 13 weeks with Week $N$ closing cash strictly equal to Week $N+1$ opening cash.
  - Overdue placed in Week 1; disputed excluded; promise date overrides expected collection date.
  - Dashboard expected this week strictly matches Forecast Week 1 collections.
  - Chase scoring (0–100) never saturates: at most one invoice at 100, top 5 scores distinct.
  - First week below safety buffer highlighted, and smallest gap-covering set computed correctly.
- **Security & Authorization (T39–T43)**:
  - Bearer token authentication required on all private API endpoints.
  - Public pay tokens are 128-bit crypto-random; seeded invoices use fixed constants.
  - 60-second cooldown on demo reset.
  - Input validation, SQL injection safety, XSS escaping, and CORS domain restriction.
  - Clean restart persistence: SQLite data survives restart; missing DB auto-seeds.

---

## ☁️ Production Deployment Guide

### 1. Backend Deployment (Render)
1. Push this repository to GitHub.
2. In Render, create a new service using **Blueprint** (`render.yaml`).
3. Set the required Environment Variables:
   - `AUTH_SECRET`: **Mandatory in production**. A 32+ character random secret (e.g. generated via `openssl rand -hex 32`). The server will **refuse to start** without this.
   - `FRONTEND_URL`: URL of your deployed frontend (e.g., `https://baaki-receivables.vercel.app`).
   - `DEMO_MODE`: Set to `true` to enable 1-click demo login and demo tools.
   - `NODE_ENV`: `production`.
   - `NODE_VERSION`: `20.18.0`.
   - `DATABASE_PATH`: `./baaki.db` (or `/data/baaki.db` if using a mounted persistent disk).

#### Cold-Start & Ephemeral Disk Notes:
- **Render Free-Tier Spin-Down**: Free instances sleep after 15 minutes of inactivity. When a user opens the frontend, Baaki displays an animated **"Waking up the server..."** overlay that polls `/api/health` with exponential backoff for up to 60 seconds until the backend is fully awake.
- **Ephemeral Storage**: Render free-tier container filesystems reset upon redeployment or spin-down. Baaki automatically detects a missing database file on boot and runs `schema.sql` and `seed.js` to initialize fresh demo data in milliseconds. For permanent persistent storage, mount a Render Persistent Disk at `/data` and set `DATABASE_PATH=/data/baaki.db`.

### 2. Frontend Deployment (Vercel)
1. In Vercel, import your repository and set the **Root Directory** to `baaki/frontend`.
2. Framework Preset: **Vite**.
3. Set the Environment Variable:
   - `VITE_API_URL`: The full URL of your deployed Render backend (e.g. `https://baaki-api.onrender.com/api`).
4. **Important Build-Time Note**:
   > ⚠️ **Vite Environment Variable Baking**: Vite statically replaces `import.meta.env.VITE_API_URL` into client-side JavaScript bundles during `npm run build`. Changing `VITE_API_URL` requires a redeployment on Vercel. In production builds, Baaki checks for `VITE_API_URL` and displays a visible configuration error banner if it was omitted, preventing silent failed network requests.
5. Client-side SPA routing rewrites are pre-configured in `frontend/vercel.json`.

---

## 🔒 Security & Privacy Hardening

- **Authorization Bearer Tokens**: All API requests use `Authorization: Bearer <token>` headers instead of cross-site cookies, preventing third-party cookie blocking between Vercel and Render.
- **No Production Fallback Secrets**: Production crashes immediately on boot if `AUTH_SECRET` is not explicitly provided in the environment.
- **Demo Mode Isolation**: Demo login is disabled unless `DEMO_MODE=true`. Reset demo endpoint has a 60-second cooldown rate limit.
- **128-bit Cryptographic Pay Tokens**: Invoices created at runtime use `crypto.randomBytes(16).toString('hex')`.
- **Fictional Demo Data**: All phone numbers use reserved demo blocks (`+91 99999 1000X`), PANs use invalid character `Z` at position 4, and UPI IDs use `@demo` handle.
- **Database Safety**: WAL mode, foreign keys, and integer-paise math.

---

## 🌐 Multi-Language Localisation (English, हिन्दी, தமிழ்)

Baaki supports complete multi-language localisation across English, Hindi (हिन्दी), and Tamil (தமிழ்):
- **True Trilingual Support**: All screens, navigation, forms, notifications, error states, and cash forecast scenario alerts are fully translated into natural, idiomatic Hindi and Tamil suited for small-business owners.
- **Canonical Terminology**: Standardized against Indian business usage in [docs/TRANSLATION_GLOSSARY.md](docs/TRANSLATION_GLOSSARY.md).
- **Self-Hosted Typography**: Packaged with `@fontsource/noto-sans-devanagari` and `@fontsource/noto-sans-tamil` with line-height safeguards to avoid clipping Devanagari matras and Tamil diacritics.
- **Customer Preferred Language**: Customers have a `preferred_language` preference, automatically adapting WhatsApp, SMS, and email follow-up dispatch templates.
- **Review Notice**: *Translations were generated following standard MSME accounting terminology. For production deployments in regional markets, translations should be reviewed and verified by a native speaker.*

---

## 📄 License
MIT License. Built for Indian Small Businesses and MSMEs.
