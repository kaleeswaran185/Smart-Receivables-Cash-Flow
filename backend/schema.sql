-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- 1. Business Table
CREATE TABLE IF NOT EXISTS business (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  trade_name TEXT,
  gstin TEXT,
  reg_type TEXT NOT NULL DEFAULT 'REGULAR' CHECK(reg_type IN ('REGULAR', 'COMPOSITION', 'UNREGISTERED')),
  state_code TEXT,
  state TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  pincode TEXT,
  phone TEXT,
  email TEXT,
  pan TEXT,
  bank_name TEXT,
  bank_account_no TEXT,
  bank_ifsc TEXT,
  bank_branch TEXT,
  upi_id TEXT,
  turnover_paise INTEGER DEFAULT 6500000000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  gstin TEXT,
  state_code TEXT,
  state TEXT,
  address TEXT,
  city TEXT,
  pincode TEXT,
  phone TEXT,
  email TEXT,
  credit_limit_paise INTEGER DEFAULT 0,
  credit_period_days INTEGER DEFAULT 30,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_type TEXT NOT NULL CHECK(invoice_type IN ('Tax Invoice', 'Bill of Supply', 'Invoice')),
  invoice_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  place_of_supply TEXT NOT NULL,
  subtotal_paise INTEGER NOT NULL DEFAULT 0,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  taxable_paise INTEGER NOT NULL DEFAULT 0,
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  round_off_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL DEFAULT 0,
  paid_paise INTEGER NOT NULL DEFAULT 0,
  balance_paise INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'SENT' CHECK(status IN ('DRAFT', 'SENT', 'UNPAID', 'DUE_SOON', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'DISPUTED')),
  payment_token TEXT UNIQUE,
  snoozed_until TEXT,
  notes TEXT,
  terms TEXT,
  pdf_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  hsn_code TEXT,
  qty REAL NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'NOS',
  rate_paise INTEGER NOT NULL,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  taxable_paise INTEGER NOT NULL,
  gst_rate REAL NOT NULL DEFAULT 0 CHECK(gst_rate IN (0, 3, 5, 12, 18, 28, 40)),
  cgst_paise INTEGER NOT NULL DEFAULT 0,
  sgst_paise INTEGER NOT NULL DEFAULT 0,
  igst_paise INTEGER NOT NULL DEFAULT 0,
  total_paise INTEGER NOT NULL
);

-- 5. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  payment_date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  payment_mode TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD', 'OTHER')),
  reference_no TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('RENT', 'SALARY', 'UTILITIES', 'PURCHASE', 'TRAVEL', 'MARKETING', 'OFFICE', 'ELECTRICITY', 'GST', 'SUPPLIER', 'OTHER')),
  expense_date TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  vendor TEXT,
  gstin TEXT,
  payment_mode TEXT,
  reference_no TEXT,
  notes TEXT,
  receipt_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK(reminder_type IN ('UPCOMING', 'DUE_TODAY', 'OVERDUE_GENTLE', 'OVERDUE_FIRM', 'URGENT_HOLD', 'LEGAL_NOTICE', 'CUSTOM')),
  stage INTEGER DEFAULT 0,
  channel TEXT NOT NULL CHECK(channel IN ('WHATSAPP', 'SMS', 'EMAIL')),
  scheduled_at TEXT NOT NULL,
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SENT', 'FAILED', 'CANCELLED')),
  message_body TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Disputes Table
CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  disputed_amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
  resolution_notes TEXT,
  resolved_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Promises Table (Promise to Pay)
CREATE TABLE IF NOT EXISTS promises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  promised_date TEXT NOT NULL,
  promised_amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'KEPT', 'BROKEN', 'CANCELLED')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('INVOICE', 'EXPENSE', 'CUSTOMER', 'PAYMENT', 'BANK_STATEMENT', 'OTHER')),
  entity_id INTEGER,
  doc_type TEXT NOT NULL CHECK(doc_type IN ('PDF', 'IMAGE', 'INVOICE_SCAN', 'RECEIPT', 'STATEMENT', 'OTHER')),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  extracted_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER REFERENCES business(id) ON DELETE CASCADE,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Inbox Items Table (claims like 'I have already paid', disputes, notes)
CREATE TABLE IF NOT EXISTS inbox_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'PAYMENT_CLAIM' CHECK(type IN ('PAYMENT_CLAIM', 'DISPUTE_RAISED', 'PROMISE_MADE', 'OTHER')),
  payment_date TEXT,
  amount_paise INTEGER,
  payment_mode TEXT,
  reference_no TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_token ON invoices(payment_token);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_business ON expenses(business_id);
CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_disputes_invoice ON disputes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_promises_customer ON promises(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_business ON inbox_items(business_id);
CREATE INDEX IF NOT EXISTS idx_inbox_items_invoice ON inbox_items(invoice_id);
