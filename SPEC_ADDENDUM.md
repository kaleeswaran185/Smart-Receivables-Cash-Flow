# SPEC ADDENDUM — Architecture & Design Decisions

This document formally records all architectural and implementation decisions for the **Baaki (बाकी)** system in accordance with the specifications in sections A through G.

---

## A. Money & GST Calculations

### 1. Integer-Paise Arithmetic & Rounding Policy
- **Base Unit**: All monetary fields are strictly stored and computed as 64-bit integer paise ($₹1.00 = 100 \text{ paise}$).
- **Line-level calculations**:
  - $\text{Taxable Paise} = \max(0, (\text{qty} \times \text{rate\_paise}) - \text{discount\_paise})$
  - Half-up rounding helper: $\text{round\_half\_up}(x) = \lfloor x + 0.5 \rfloor$ for non-negative values.
- **Component Taxes**:
  - Intra-State (same state):
    $$\text{CGST} = \text{round\_half\_up}\left(\frac{\text{taxable\_paise} \times \text{gst\_rate}}{200}\right)$$
    $$\text{SGST} = \text{round\_half\_up}\left(\frac{\text{taxable\_paise} \times \text{gst\_rate}}{200}\right)$$
  - Inter-State (different state):
    $$\text{IGST} = \text{round\_half\_up}\left(\frac{\text{taxable\_paise} \times \text{gst\_rate}}{100}\right)$$
- **Total Tax & Grand Total**:
  - $\text{Total Tax} = \sum \text{CGST} + \sum \text{SGST} + \sum \text{IGST}$
  - $\text{Raw Total} = \text{Taxable} + \text{Total Tax}$
  - Grand total rounded to nearest Rupee (100 paise; $\ge 50\text{ paise}$ rounds up to $100\text{ paise}$):
    $$\text{Total Paise} = \text{round\_half\_up}\left(\frac{\text{Raw Total}}{100}\right) \times 100$$
    $$\text{Round Off Paise} = \text{Total Paise} - \text{Raw Total} \quad (\text{can be negative, zero, or positive})$$
- **Verification Example**:
  - Item: $3 \times ₹333.00$ ($33,300\text{ paise}$) @ 5% GST.
  - Taxable: $99,900\text{ paise}$ ($₹999.00$).
  - Same state:
    $$\text{CGST} = \text{round\_half\_up}\left(\frac{99900 \times 5}{200}\right) = \text{round\_half\_up}(2497.5) = 2498\text{ paise} \ (₹24.98)$$
    $$\text{SGST} = \text{round\_half\_up}\left(\frac{99900 \times 5}{200}\right) = 2498\text{ paise} \ (₹24.98)$$
    $$\text{Raw Total} = 99900 + 4996 = 104896\text{ paise} \ (₹1048.96)$$
    $$\text{Total} = 104900\text{ paise} \ (₹1,049.00), \quad \text{Round Off} = +4\text{ paise} \ (+₹0.04)$$
  - Other state:
    $$\text{IGST} = \text{round\_half\_up}\left(\frac{99900 \times 5}{100}\right) = 4995\text{ paise} \ (₹49.95)$$
    $$\text{Raw Total} = 99900 + 4995 = 104895\text{ paise} \ (₹1048.95)$$
    $$\text{Total} = 104900\text{ paise} \ (₹1,049.00), \quad \text{Round Off} = +5\text{ paise} \ (+₹0.05)$$

### 2. Amount in Words
- Implements Indian numbering system: Crores, Lakhs, Thousands, Hundreds, Units.
- Correctly formats paise suffixes: e.g. `"Rupees One Thousand Forty Nine and Fifty Paise Only"` or `"Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Fifty Paise Only"`.
- If zero paise remainder, omits the paise clause (e.g. `"Rupees One Thousand Forty Nine Only"`).

### 3. Composition Invoices & Place of Supply
- **Composition Scheme Invoices**:
  - Document Title: `"Bill of Supply"`.
  - Mandatory statutory declaration: `"Composition taxable person, not eligible to collect tax on supplies"`.
  - CGST, SGST, IGST are strictly zero.
- **Tax Invoices**:
  - Clearly display `"Place of Supply"` with 2-digit state code and state name.
- **HSN/SAC Validation**:
  - Must match `/^[0-9]{4,8}$/` (4 to 8 digits) if present. Enforced on both frontend forms and backend validation.

---

## B. Derived State and Dates

### 4. Read-Time Derived Invoice Status
- The database does NOT store volatile status values (`OVERDUE`, `DUE_SOON`, `PARTIALLY_PAID`, `PAID`).
- Base stored state in `invoices` table is strictly `DRAFT` or `SENT` (or `CANCELLED`).
- At read time (API layer, queries, models), status is dynamically derived with strict priority:
  1. `PAID`: Confirmed payments $\ge \text{total\_paise}$.
  2. `DISPUTED`: Open dispute exists in `disputes` table (`status = 'OPEN'`).
  3. `PARTIALLY_PAID`: Confirmed payments $> 0$ and $< \text{total\_paise}$.
  4. `OVERDUE`: $\text{due\_date} < \text{today}$.
  5. `DUE_SOON`: $\text{today} \le \text{due\_date} \le \text{today} + \text{due\_soon\_days}$ (default 7 days, configurable in settings).
  6. `SENT`: Invoice has been sent (`is_sent` or base status `SENT`).
  7. `DRAFT`: Draft status.

### 5. Single Source of Truth for "Today"
- `today` is strictly retrieved from `settings.demo_date` (or `demoDate`) as a `YYYY-MM-DD` string.
- Business logic never calls `new Date()` or `Date.now()` to determine current business date.
- Date math is date-only string manipulation in IST timezone.
- Frontend fetches `today` from `/api/settings` and `/api/health`.

### 6. Ageing Buckets
- Buckets are determined strictly by $\text{diffDays}(\text{today}, \text{due\_date})$:
  - **Not Due**: $\text{due\_date} \ge \text{today}$ (i.e. $\le 0$ days overdue).
  - **1–30 Days Overdue**: $1 \le \text{days overdue} \le 30$.
  - **31–60 Days Overdue**: $31 \le \text{days overdue} \le 60$.
  - **61–90 Days Overdue**: $61 \le \text{days overdue} \le 90$.
  - **90+ Days Overdue**: $\text{days overdue} \ge 91$.

---

## C. Reminders & Escalation Ladder

### 7. Unique Constraints & Stage Skipping
- Database enforces `UNIQUE(invoice_id, stage)` in the `reminders` table.
- Ladder stages: `-3` (Upcoming), `0` (Due Today), `7` (Gentle Overdue), `15` (Firm Overdue), `30` (Urgent Supply Hold), `45` (Demand Letter).
- **Jump/Multi-Stage Due Rule**: If a demo-date jump causes multiple stages to be due at once, the system sends **only the highest due unsent stage** and marks all lower due unsent stages as `status = 'SKIPPED'`.

### 8. Pausing & Resuming Logic
- **Dispute Active**: Ladder is paused completely while an open dispute exists. Once resolved, the ladder resumes from the highest due unsent stage.
- **Promise to Pay**: Ladder is paused until `promised_date`. If `today > promised_date` and payment was not confirmed, the promise is broken and the ladder resumes from the highest due unsent stage.
- **Part Payments**: Outstanding balance is recalculated; ladder remains active on remaining balance.

---

## D. Payments & Reconciliation

### 9. Three-State Payments & Overpayment Handling
- Payments table has explicit `status` column: `status IN ('pending', 'confirmed', 'rejected')`.
- **Only `confirmed` payments** reduce `balance_paise`.
- Customer `"I've already paid"` flow creates an `inbox_items` entry (`status = 'PENDING'`), **not a payment**. A payment record is only created when the merchant explicitly accepts the claim in Inbox.
- **Overpayment**: If payment exceeds invoice balance, the excess is recorded as customer credit (`overpayment_paise`), flagged, and never auto-applied to other invoices.
- **Unmatched Payments**: Remain unlinked (`invoice_id = NULL`) until merchant reconciles.

---

## E. Forecast & Chase Priority

### 10. Shared Core Cash Service
- A single unified core service (`sharedCashService.js`) calculates expected collection dates and weekly cash buckets for Dashboard, Forecast, and Chase Priority.
- **Expected Collection Date**:
  $$\text{Expected Date} = \text{due\_date} + \text{customer\_average\_delay}$$
  - Applied to outstanding balance only.
  - If expected date is before `today`, it is placed into **Week 1**.
  - A pending promise date overrides the expected date.
  - Disputed invoices are excluded from expected collections and categorized as `"at risk"`.
- **Consistency Guarantee**:
  - $\text{Dashboard Expected This Week} \equiv \text{Forecast Week 1 Collections}$.
  - $\text{Dashboard Expected This Month} \equiv \sum_{w=1}^4 \text{Forecast Week } w \text{ Collections}$.

### 11. Chase-First Priority Scoring (0–100)
- Chase list excludes `PAID`, `NOT DUE` ($\text{due\_date} \ge \text{today}$), and `DISPUTED` invoices (disputed invoices move to a separate `"Resolve Dispute"` queue).
- **Scoring Weights (Sum = 100)**:
  1. Outstanding Amount: **30 pts**
  2. Days Overdue: **25 pts**
  3. Safety Buffer Shortage Impact: **20 pts**
  4. Customer Reliability Rating (A=5, B=10, C=15): **15 pts**
  5. Expected Payment Delay: **10 pts**
- **Actionable Reason String**:
  - Formatted with amount, days overdue, and shortage week covered.
  - `"Can cover the gap"`: collecting this invoice by the shortage week raises that week's projected closing cash to or above the safety buffer, or directly reduces the deficit.

### 12. Seed Shortage Demonstration
- Seed data deterministically produces a cash deficit below the ₹5,00,000 safety buffer in **Week 3** (or a designated week).
- Identifies one clearly top-ranked chase invoice (e.g. INV-2026-1015 / Agarwal Construction) whose collection bridges the deficit.
- The shortage week and top invoice are printed in the seed log.

---

## F. Security & Demo Safety

### 13. Owner Authentication & Defense-in-Depth
- Simple owner login using `OWNER_EMAIL` and `OWNER_PASSWORD` from environment variables (defaults for local dev: `owner@baaki.app` / `baaki123`).
- Signed HMAC token or session cookie (`baaki_auth_token`).
- All `/api/*` endpoints require authentication except `/api/health`, `/api/auth/login`, and public pay portal endpoints (`/api/public/pay/*`).
- `/api/settings/reset-demo` requires authentication.
- If `DEMO_MODE=true` (or in development), the login screen provides a 1-click `"Enter Demo Mode"` button.
- Backend security middleware:
  - `helmet`: Secure HTTP response headers.
  - `express.json({ limit: '1mb' })`: Body size limits.
  - Simple rate limiting on public endpoints (`/api/public/pay/*`).
  - Strict CORS allow-list using `FRONTEND_URL`.

### 14. Cryptographic Pay Tokens
- Tokens are generated using `crypto.randomBytes(16).toString('hex')` ($\ge 128$ bits).
- Seeded invoices use fixed token constants so links persist across demo resets.
- Public endpoint returns strictly minimum necessary fields (invoice number, seller name, buyer name, balance, due date, items summary, UPI parameters).

### 15. Demo Data Safety & Privacy
- Demo customer phone numbers are sanitized placeholder numbers (`+91 99999 0000X`).
- When a phone number is a demo placeholder, WhatsApp click actions open `https://wa.me/?text=<encoded message>` without a recipient phone number.
- Demo UPI ID uses `sharmapackaging@demo` or `sharmaelec@demo`.
- Generated demo GSTINs use a PAN with `'Z'` as the 4th character (e.g. `27AAZCS1429B1Z`), which cannot match any registered Indian business entity.
- All demo entities clearly display the badge/label `[DEMO]`.

### 16. E-Invoicing Turnover Threshold & CSV TDS Hints
- Setting label: `"Highest aggregate turnover in any financial year since 2017-18 (PAN level)"`.
- Informational note displayed when turnover $> ₹5\text{ Crore}$ ($5,00,00,000\text{ paise}$):
  > *"e-invoicing may apply; this app does not generate IRNs."*
- Bank CSV matching detects TDS shortfalls at 0.1% (Section 194Q), 1% (194C individual), 2% (194C corporate), and 10% (194J professional).

---

## G. Deployment Resilience

### 17. Environment Variables & Cold-Start UX
- Database path configured from `process.env.DB_PATH || process.env.DATABASE_PATH`.
- Auto-seeds automatically on initial launch when database is empty.
- `/api/health` endpoint responds with `{ status: 'ok', service: 'baaki-backend', today: ... }`.
- Frontend includes an automatic cold-start retry banner (`"Waking up the server... Retrying connection (up to 60s)"`) when backend is spinning up on free-tier hosting (Render).
- Documentation in README notes free-tier spin-down behavior and ephemeral file persistence.
