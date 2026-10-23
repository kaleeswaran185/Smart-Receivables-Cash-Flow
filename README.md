# Baaki (बाकी) - Smart Receivables & Cash Flow Assistant for Small Businesses

> **Never let overdue invoices choke your business.** A proactive, GST-compliant receivables and cash flow management platform designed specifically for Indian MSMEs, manufacturers, and traders.

---

## 🌐 Live Deployment & Links

| Service | Platform | URL |
|---|---|---|
| **Frontend Web App** | Vercel | `https://baaki-receivables.vercel.app` *(Placeholder)* |
| **Backend REST API** | Render | `https://baaki-api.onrender.com` *(Placeholder)* |
| **API Health Check** | Render | `https://baaki-api.onrender.com/api/health` *(Placeholder)* |
| **Product Walkthrough Video** | YouTube | `https://youtu.be/placeholder-demo` *(Placeholder)* |

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
- Alerts business owners weeks in advance of the first week dipping below their custom **Safety Buffer** (e.g. ₹5,00,000).
- Dynamically identifies and ranks specific outstanding invoices that can bridge the cash gap.
- **Interactive What-If Scenarios**: Simulate what happens if a major customer delays by 30 days, a supplier payment is postponed, or a big customer pays early.

### 2. Intelligent "Chase-First" Priority Scoring (0–100)
- Prioritizes overdue invoices not by raw amount alone, but using a multi-factor weighting algorithm:
  - Outstanding balance magnitude.
  - Days overdue past credit period.
  - Customer reliability rating (Grade A, B, C).
  - Immediate impact on resolving the impending cash shortage.
- Generates human-readable actionable explanations (e.g., *"🔥 Chase First: High balance overdue 38 days; collecting this resolves Week 3 cash deficit"*).

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

### 4. Public No-Login Pay Portal (`/pay/:token`)
- Customers receive secure, tokenized payment links without requiring an account or login.
- Dynamic UPI deep link (`upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...`) for instant 1-tap mobile payments on PhonePe, Google Pay, and Paytm.
- **"I've Already Paid" Self-Serve Flow**: Customers submit payment claims (mode, UTR/ref, date, notes) that land directly in the merchant's **Inbox** for verification.
- **"Something Is Wrong" Self-Serve Dispute**: Customers raise structured disputes with disputed amounts and reasons, pausing automatic reminders instantly.

### 5. Bank Statement CSV Import & Reconciliation (SPEC Section 18)
- Accepts standard Indian bank statement CSV exports (HDFC, ICICI, SBI, Axis).
- **Hierarchical Auto-Matching**: Matches credits by invoice number in narration, customer name tokens, or exact balance.
- **TDS Shortfall Detection**: Automatically identifies 1%, 2%, or 10% TDS deductions (Section 194C/J), displays shortfall hints (e.g. `⚡ 2% TDS Shortfall: ₹2,449.00`), and allows 1-click full credit with tax offset.
- **Deterministic SHA-256 Idempotency**: Re-importing overlapping or duplicate statements skips already-staged and already-reconciled rows safely.
- **Strict Invariant**: *"Nothing paid until I confirm"* — previewing is 100% read-only; balances only update upon explicit confirmation.

### 6. GST-Compliant Document Engine
- Generates print-ready **Tax Invoices** (for Regular GST), **Bills of Supply** (for Composition Scheme), and plain invoices.
- Automated compliance note for turnover exceeding ₹5 Crore (informing recipient of standard e-invoicing provisions without false IRN claims).
- **Formal Payment Demand Letter**: Displays exact non-legal disclaimer (*"This letter is from the business regarding outstanding invoices. It is not a notice from the GST department and not a legal notice from a lawyer"*), bank and UPI coordinates, part payment ledger, and zero government/court branding.
- Uses clean CSS `@media print` with browser-native `window.print()` — zero third-party PDF bloat.

### 7. Accessibility & Multilingual Support (English, Hindi, Hinglish)
- Full UI translation between **English**, **Hindi (हिन्दी)**, and **Hinglish**.
- Dynamic font scaling: Normal (16px), Large (18px), and Extra Large (20px).
- Strict accessible design: Status is **always text + color** (never color alone), and interactive targets maintain minimum 48px touch padding.

### 8. Interactive Demo Date Simulator
- Time-travel simulator allowing evaluators and business owners to test how ageing buckets, cash forecasts, and escalation queues respond as days advance without altering system clock.
- One-click **Reset Demo** restores initial state in milliseconds.

---

## 🛠️ Tech Stack & Architecture

```
baaki/
├── backend/                  # Node.js + Express REST API
│   ├── src/
│   │   ├── app.js            # Express application with CORS & routes
│   │   ├── index.js          # Server entrypoint with auto-seed logic
│   │   ├── db.js             # better-sqlite3 database connection (WAL mode)
│   │   ├── schema.sql        # Full relational schema (13 tables, integer paise)
│   │   ├── seed.js           # Deterministic realistic Indian MSME seed data
│   │   ├── lib/              # Core business logic
│   │   │   ├── money.js      # Rupees <-> Paise & Indian Lakh/Crore formatting
│   │   │   ├── gst.js        # Base-36 Mod-36 GSTIN checksum & invoice math
│   │   │   ├── customerStats.js # Customer grading (A/B/C) algorithm
│   │   │   ├── forecast.js   # 13-week cash forecasting engine
│   │   │   ├── chasePriority.js # 0-100 priority scoring engine
│   │   │   ├── reminderEngine.js# 6-stage reminder ladder & templates
│   │   │   └── bankMatcher.js# Bank statement CSV parser & match engine
│   │   └── routes/           # Express REST endpoints
│   └── test/                 # 42 automated unit and integration tests
├── frontend/                 # React 18 + Vite SPA
│   ├── src/
│   │   ├── components/       # Reusable accessible UI components
│   │   ├── context/          # DemoContext (demo date, settings, language)
│   │   ├── pages/            # Page controllers (Dashboard, Invoices, etc.)
│   │   ├── services/api.js   # VITE_API_URL-driven API client (no hardcoded ports)
│   │   └── utils/            # Money, formatting, and i18n dictionaries
│   └── vercel.json           # SPA routing rewrite for Vercel
├── sample_bank_statement.csv # Realistic sample bank statement CSV
└── render.yaml               # Cloud deployment descriptor for Render
```

---

## 💾 Database Schema & Financial Precision

All monetary figures are stored as **64-bit INTEGER paise** ($₹1.00 = 100\text{ paise}$) in SQLite with foreign keys enforced and WAL (Write-Ahead Logging) enabled.

### Core Tables:
1. `business`: Profile, GSTIN, registration type, bank details, UPI ID, turnover.
2. `customers`: Customer directory, GSTIN, state code, credit limits, credit period.
3. `invoices`: Invoice headers, status, taxable/CGST/SGST/IGST/round-off totals, payment tokens.
4. `invoice_items`: Line items with HSN/SAC, qty, rate, discount, GST rates (0%, 3%, 5%, 12%, 18%, 28%, 40%).
5. `payments`: Settlement records, modes (UPI, NEFT, RTGS, CHEQUE, CASH), UTR references.
6. `expenses`: Recurring and operational expenses categorized for cash forecast.
7. `reminders`: Scheduled and sent reminder queue with stages, channels, and templates.
8. `disputes`: Customer-raised and merchant-logged disputes with amounts and resolution statuses.
9. `promises`: Structured promise-to-pay commitments with promised dates and amounts.
10. `documents`: Generated document registry and metadata.
11. `settings`: Key-value application state (demo date, safety buffer, language, text size).
12. `inbox_items`: Unverified payment claims and customer dispute submissions.
13. `bank_transactions`: Bank statement imports with SHA-256 hashes, match confidence, and TDS rates.

---

## 🧪 Automated Test Suite (42 of 42 Passing)

The backend features a comprehensive test suite executed using Node.js built-in test runner:

```bash
npm test (inside backend/)
```

### Coverage Overview:
- **SPEC Tests 1–8**: Intra-state (CGST+SGST), Inter-state (IGST), Round-off lines, Discounts, Composition Scheme Bill of Supply, 0% GST, Invalid GSTIN format, and Mod-36 check-digit verification.
- **SPEC Tests 9–11**: Backend total recalculation (ignoring tampered client inputs), partial/overpayment logic, and Customer Reliability Grading (A/B/C).
- **SPEC Tests 12–17**: 13-week forecast continuity ($W_N \text{ Close} = W_{N+1} \text{ Open}$), safety buffer shortfall detection, what-if scenarios, 0-100 chase scoring, reminder escalation ladder, and public `/pay/:token` portal.
- **SPEC Test 18**: GST documents, Payment Demand Letter disclaimers, and demo date propagation.
- **SPEC Test 19**: SQLite file persistence across backend process restart.
- **SPEC Test 20**: API edge cases (404s, invalid tokens, zero-item prevention, negative amounts).
- **SPEC Section 18**: Bank statement CSV parsing, invoice # matching, customer name matching, 1%/2%/10% TDS shortfall hints, idempotent duplicate re-import, and confirmation step.

---

## 📦 Local Installation & Setup

### Prerequisites
- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher

### 1. Clone & Setup Backend
```bash
cd baaki/backend

# Install dependencies
npm install

# Start development server (runs on port 5000 by default)
npm start
```
*The database (`baaki.db`) is automatically created and seeded with realistic Indian business data on first launch.*

### 2. Setup Frontend
```bash
cd ../frontend

# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:3000)
npm run dev
```

### 3. Open in Browser
Visit `http://localhost:3000` to access the full application.

---

## ☁️ Production Deployment

### Backend (Render)
1. Push repository to GitHub.
2. In Render, select **New > Blueprint** and select `render.yaml`.
3. Configure environment variables:
   - `PORT`: `10000`
   - `FRONTEND_URL`: URL of your deployed frontend (e.g., `https://baaki-receivables.vercel.app`)
   - `NODE_ENV`: `production`

### Frontend (Vercel)
1. In Vercel, import the repository and set **Root Directory** to `baaki/frontend`.
2. Framework Preset: **Vite**.
3. Environment Variables:
   - `VITE_API_URL`: URL of your deployed Render backend (e.g., `https://baaki-api.onrender.com/api`).
4. `vercel.json` provides automatic SPA rewrites to `/index.html` for client-side routing.

---

## 🔒 Security & Data Privacy
- **No Secrets in Repo**: All credentials, database files (`*.db`), and `.env` files are strictly excluded via `.gitignore`.
- **Fictional Demo Data**: All businesses, customers, GSTINs, phone numbers, and bank account numbers are fictitious test values.
- **No Hardcoded URLs**: The frontend reads `VITE_API_URL` dynamically with relative path fallbacks.
- **Sanitized Calculations**: All calculations are performed server-side in integer paise to avoid client-side tampering and floating-point errors.

---

## 📄 License
MIT License. Built for Indian Small Businesses and MSMEs.
