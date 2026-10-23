/**
 * Seed script for Baaki - Smart Receivables & Cash Flow Assistant.
 * Fully fictional realistic data for "Sharma Packaging" (Pune, Maharashtra).
 * Idempotent: Skips if data already exists, or can be forced.
 */

import crypto from 'crypto';
import { generateValidGSTIN, calculateInvoice } from './lib/gst.js';
import { rupeesToPaise } from './lib/money.js';
import { addDays } from './lib/dateUtils.js';
import { calculateCashForecast } from './services/sharedCashService.js';

export const DEMO_DATE = '2026-10-22';

export function seedDatabase(db, options = { force: false }) {
  const existingBiz = db.prepare('SELECT COUNT(*) as count FROM business').get();

  if (existingBiz.count > 0 && !options.force) {
    return { seeded: false, message: 'Database already seeded' };
  }

  // Clear existing if force
  if (options.force) {
    db.prepare('DELETE FROM invoice_items').run();
    db.prepare('DELETE FROM payments').run();
    db.prepare('DELETE FROM customer_credits').run();
    db.prepare('DELETE FROM reminders').run();
    db.prepare('DELETE FROM disputes').run();
    db.prepare('DELETE FROM promises').run();
    db.prepare('DELETE FROM documents').run();
    db.prepare('DELETE FROM expenses').run();
    db.prepare('DELETE FROM inbox_items').run();
    db.prepare('DELETE FROM invoices').run();
    db.prepare('DELETE FROM customers').run();
    db.prepare('DELETE FROM settings').run();
    db.prepare('DELETE FROM business').run();
  }

  const runInTransaction = db.transaction(() => {
    // 1. Settings
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('demo_date', DEMO_DATE);
    insertSetting.run('demoDate', DEMO_DATE);
    insertSetting.run('app_name', 'Baaki - Smart Receivables Assistant');
    insertSetting.run('default_credit_period_days', '30');
    insertSetting.run('base_currency', 'INR');
    insertSetting.run('opening_cash_paise', String(rupeesToPaise(500000))); // ₹5 Lakh
    insertSetting.run('safety_buffer_paise', String(rupeesToPaise(500000))); // ₹5 Lakh
    insertSetting.run('cash_flow_alert_threshold_paise', String(rupeesToPaise(500000))); // ₹5 Lakh
    insertSetting.run('annual_turnover_paise', '6500000000'); // ₹6.5 Crore (> ₹5 Crore)

    // 2. Business: Sharma Packaging [DEMO] (Pune, Maharashtra)
    // PAN 4th character must be 'Z' so it cannot match a real business
    const bizPAN = 'AAAZR1234F';
    const bizGSTIN = generateValidGSTIN('27', bizPAN, '1'); // Maharashtra
    const insertBiz = db.prepare(`
      INSERT INTO business (
        name, trade_name, gstin, reg_type, state_code, state,
        address_line1, address_line2, city, pincode, phone, email, pan,
        bank_name, bank_account_no, bank_ifsc, bank_branch, upi_id, turnover_paise
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Sharma Packaging [DEMO]',
      'Sharma Packaging Solutions Pvt Ltd [DEMO]',
      bizGSTIN,
      'REGULAR',
      '27',
      'Maharashtra',
      'Plot No. 42, Sector 10, PCMC Industrial Area',
      'Bhosari MIDC',
      'Pune',
      '411026',
      '+91 99999 00000',
      'billing@sharmapackaging.demo',
      bizPAN,
      'HDFC Bank',
      '50200045892147',
      'HDFC0001234',
      'Bhosari MIDC Branch',
      'sharmapackaging@demo',
      6500000000
    );

    const businessId = insertBiz.lastInsertRowid;

    // 3. 12 Customers across different states with valid GSTINs
    // All PANs use 4th character 'Z' so they cannot match a real business
    const customerDefs = [
      {
        name: 'Apex Logistics Pune [DEMO]',
        company: 'Apex Supply Chain Solutions LLP [DEMO]',
        stateCode: '27',
        state: 'Maharashtra',
        city: 'Pune',
        pan: 'AABZA1111A',
        creditLimit: 1500000, // ₹15L
        behavior: 'A' // Always early or on-time
      },
      {
        name: 'Bengaluru Fresh Foods [DEMO]',
        company: 'Bengaluru Organic Organics Pvt Ltd [DEMO]',
        stateCode: '29',
        state: 'Karnataka',
        city: 'Bengaluru',
        pan: 'BBCZB2222B',
        creditLimit: 2000000,
        behavior: 'A'
      },
      {
        name: 'Gujarat Pharma Pack [DEMO]',
        company: 'Gujarat Healthcare Packaging Ltd [DEMO]',
        stateCode: '24',
        state: 'Gujarat',
        city: 'Ahmedabad',
        pan: 'DDEZD4444D',
        creditLimit: 2500000,
        behavior: 'A'
      },
      {
        name: 'Chennai Textiles & Apparels [DEMO]',
        company: 'Chennai Fashion Weaves Ltd [DEMO]',
        stateCode: '33',
        state: 'Tamil Nadu',
        city: 'Chennai',
        pan: 'CCDZC3333C',
        creditLimit: 1800000,
        behavior: 'A'
      },
      {
        name: 'Hyderabad Bio Labs [DEMO]',
        company: 'Hyderabad Life Sciences Research [DEMO]',
        stateCode: '36',
        state: 'Telangana',
        city: 'Hyderabad',
        pan: 'FFGZF6666F',
        creditLimit: 1200000,
        behavior: 'B' // Minor delays
      },
      {
        name: 'Delhi Electronics Hub [DEMO]',
        company: 'Delhi Smart Tech Solutions LLP [DEMO]',
        stateCode: '07',
        state: 'Delhi',
        city: 'New Delhi',
        pan: 'EEFZE5555E',
        creditLimit: 1000000,
        behavior: 'B'
      },
      {
        name: 'Indore Agro Processing [DEMO]',
        company: 'Indore Food Parks Pvt Ltd [DEMO]',
        stateCode: '23',
        state: 'Madhya Pradesh',
        city: 'Indore',
        pan: 'JJKZJ1010J',
        creditLimit: 1400000,
        behavior: 'B'
      },
      {
        name: 'Jaipur Handicrafts Emporium [DEMO]',
        company: 'Jaipur Royal Exports LLP [DEMO]',
        stateCode: '08',
        state: 'Rajasthan',
        city: 'Jaipur',
        pan: 'IIKZI9999I',
        creditLimit: 800000,
        behavior: 'B'
      },
      {
        name: 'Kolkata Jute & Packaging [DEMO]',
        company: 'Eastern Packaging Goods Ltd [DEMO]',
        stateCode: '19',
        state: 'West Bengal',
        city: 'Kolkata',
        pan: 'HHJZH8888H',
        creditLimit: 1000000,
        behavior: 'C' // High delay
      },
      {
        name: 'Noida Auto Components [DEMO]',
        company: 'Noida Precision Engineering Pvt Ltd [DEMO]',
        stateCode: '09',
        state: 'Uttar Pradesh',
        city: 'Noida',
        pan: 'GGHZG7777G',
        creditLimit: 1200000,
        behavior: 'C'
      },
      {
        name: 'Gurugram Retail Ventures [DEMO]',
        company: 'Gurugram Quick Commerce Labs [DEMO]',
        stateCode: '06',
        state: 'Haryana',
        city: 'Gurugram',
        pan: 'LLMZL3030L',
        creditLimit: 900000,
        behavior: 'C'
      },
      {
        name: 'Kochi Spices Export [DEMO]',
        company: 'Malabar Spices & Aromas Ltd [DEMO]',
        stateCode: '32',
        state: 'Kerala',
        city: 'Kochi',
        pan: 'KKLZK2020K',
        creditLimit: 1100000,
        behavior: 'C'
      }
    ];

    const insertCustStmt = db.prepare(`
      INSERT INTO customers (
        business_id, name, company_name, gstin, state_code, state,
        address, city, pincode, phone, email, credit_limit_paise, credit_period_days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const customers = [];
    customerDefs.forEach((c, idx) => {
      const gstin = generateValidGSTIN(c.stateCode, c.pan, '1');
      const res = insertCustStmt.run(
        businessId,
        c.name,
        c.company,
        gstin,
        c.stateCode,
        c.state,
        `Unit ${idx + 1}, Industrial Estate`,
        c.city,
        `${c.stateCode}0001`,
        `+91 99999 ${String(10000 + idx)}`,
        `accounts@${c.name.toLowerCase().replace(/[^a-z]/g, '')}.demo`,
        rupeesToPaise(c.creditLimit),
        30
      );
      customers.push({
        id: res.lastInsertRowid,
        ...c,
        gstin
      });
    });

    // 4. Products Catalogue for realistic items
    const packagingProducts = [
      { description: 'Heavy Duty 5-Ply Corrugated Boxes (500x400x300mm)', hsn: '481910', rate: 45, gstRate: 18 },
      { description: 'Standard 3-Ply Shipping Cartons (300x250x200mm)', hsn: '481910', rate: 28, gstRate: 18 },
      { description: 'Air Bubble Wrap Roll (100m x 1m, 80 GSM)', hsn: '392390', rate: 650, gstRate: 18 },
      { description: 'BoPP Self-Adhesive Brown Tape (65m x 48mm, 45 Micron)', hsn: '391910', rate: 38, gstRate: 18 },
      { description: 'Stretch Film Pallet Wrap Roll (500mm x 23 Micron)', hsn: '392010', rate: 480, gstRate: 18 },
      { description: 'Custom Printed Rigid Paperboard Boxes', hsn: '481920', rate: 120, gstRate: 12 },
      { description: 'Eco-Friendly Honeycomb Paper Padded Mailers', hsn: '481910', rate: 18, gstRate: 12 },
      { description: 'Corrugated Corner Edge Protectors (Pack of 100)', hsn: '481910', rate: 220, gstRate: 5 },
      { description: 'Bio-Degradable Courier Poly Bags (10x14 Inch, 100 pcs)', hsn: '392321', rate: 320, gstRate: 18 }
    ];

    // Statements for Invoices and Items
    const insertInvoiceStmt = db.prepare(`
      INSERT INTO invoices (
        business_id, customer_id, invoice_number, invoice_type, invoice_date, due_date, place_of_supply,
        subtotal_paise, discount_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise,
        round_off_paise, total_paise, paid_paise, balance_paise, status, payment_token, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItemStmt = db.prepare(`
      INSERT INTO invoice_items (
        invoice_id, description, hsn_code, qty, unit, rate_paise, discount_paise,
        taxable_paise, gst_rate, cgst_paise, sgst_paise, igst_paise, total_paise
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPaymentStmt = db.prepare(`
      INSERT INTO payments (
        business_id, customer_id, invoice_id, payment_date, amount_paise, payment_mode, reference_no, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertDisputeStmt = db.prepare(`
      INSERT INTO disputes (
        business_id, invoice_id, customer_id, reason, disputed_amount_paise, status, resolution_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertReminderStmt = db.prepare(`
      INSERT INTO reminders (
        business_id, invoice_id, customer_id, reminder_type, stage, channel, scheduled_at, sent_at, status, message_body
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 40 Invoices Generator Plan:
    // 1-16: PAID (16 invoices)
    // 17-22: PARTIALLY_PAID (6 invoices)
    // 23-27: DUE_SOON (5 invoices)
    // 28-33: OVERDUE (6 invoices)
    // 34-35: DISPUTED (2 invoices)
    // 36-37: DRAFT (2 invoices)
    // 38-40: SENT (3 invoices)

    // Strategic customer distribution across the 40 invoices:
    // Index 0..3: Grade A customers (Apex, Bengaluru, Gujarat, Chennai)
    // Index 4..7: Grade B customers (Hyderabad, Delhi, Indore, Jaipur)
    // Index 8..11: Grade C customers (Kolkata, Noida, Gurugram, Kochi)
    const invoiceCustomerIndex = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, // 1-12
      0, 1, 2, 3,                         // 13-16 (PAID)
      4, 5, 6, 7, 8, 9,                   // 17-22 (PARTIALLY_PAID)
      0, 1, 2, 3, 4,                      // 23-27 (DUE_SOON)
      8, 9, 10, 11, 8, 9,                 // 28-33 (OVERDUE)
      10, 11,                             // 34-35 (DISPUTED)
      0, 2,                               // 36-37 (DRAFT)
      1, 5, 6                             // 38-40 (SENT)
    ];

    let invCounter = 1001;

    for (let i = 1; i <= 40; i++) {
      const invNum = `INV-2026-${invCounter++}`;
      const custIdx = invoiceCustomerIndex[i - 1];
      const customer = customers[custIdx];

      let targetStatus = 'PAID';
      let invDate = '2026-07-01';
      let dueDate = '2026-07-31';
      let paymentDaysAfterDue = 0;

      if (i <= 16) {
        // PAID (16 invoices)
        targetStatus = 'PAID';
        const offsetDays = -(120 - i * 6);
        invDate = addDays(DEMO_DATE, offsetDays);
        dueDate = addDays(invDate, 30);

        if (customer.behavior === 'A') {
          paymentDaysAfterDue = -2 - (i % 3); // 2 to 4 days ahead of due date (100% on-time)
        } else if (customer.behavior === 'B') {
          // Moderate delays: one on-time (-2), one slightly late (6 days) -> ~50% on-time, avg delay ~2 days
          paymentDaysAfterDue = (i % 2 === 1) ? -2 : 6;
        } else {
          // Grade C: severe delay 25 to 35 days (0% on-time)
          paymentDaysAfterDue = 25 + (i % 10);
        }
      } else if (i <= 22) {
        // PARTIALLY_PAID (6 invoices)
        targetStatus = 'PARTIALLY_PAID';
        const isGradeC = (custIdx >= 8);
        const offsetDays = isGradeC ? -65 : -15; // Grade C is old, Grade B is fresh
        invDate = addDays(DEMO_DATE, offsetDays);
        dueDate = addDays(invDate, 30);
        paymentDaysAfterDue = isGradeC ? 25 : 4;
      } else if (i <= 27) {
        // DUE_SOON (5 invoices) - due between Oct 23 and Oct 31
        targetStatus = 'DUE_SOON';
        const offsetDays = -(25 - (i - 22) * 3);
        invDate = addDays(DEMO_DATE, offsetDays);
        dueDate = addDays(DEMO_DATE, 1 + (i - 22) * 2);
      } else if (i <= 33) {
        // OVERDUE (6 invoices) - due in August / September
        targetStatus = 'OVERDUE';
        const offsetDays = (i === 30) ? -60 : -(70 - (i - 27) * 7);
        invDate = addDays(DEMO_DATE, offsetDays);
        dueDate = addDays(invDate, 30);
      } else if (i <= 35) {
        // DISPUTED (2 invoices)
        targetStatus = 'DISPUTED';
        invDate = addDays(DEMO_DATE, -40 + (i - 33) * 10);
        dueDate = addDays(invDate, 30);
      } else if (i <= 37) {
        // DRAFT (2 invoices)
        targetStatus = 'DRAFT';
        invDate = addDays(DEMO_DATE, -2 + (i - 35));
        dueDate = addDays(invDate, 30);
      } else {
        // SENT (3 invoices)
        targetStatus = 'SENT';
        invDate = addDays(DEMO_DATE, -5 + (i - 37) * 2);
        dueDate = addDays(invDate, 30);
      }

      // Pick 2 items for this invoice
      let p1 = packagingProducts[(i * 2) % packagingProducts.length];
      let p2 = packagingProducts[(i * 3 + 1) % packagingProducts.length];

      let item1Qty = 50 + (i * 10);
      let item2Qty = 20 + (i * 5);
      if (i === 30) {
        // High balance top-priority invoice: ~₹6,10,650 for Grade C customer
        p1 = packagingProducts[0]; // 5-Ply Corrugated Boxes, rate: 45
        p2 = packagingProducts[2]; // Air Bubble Wrap Roll, rate: 650
        item1Qty = 5000;
        item2Qty = 450;
      }

      const rawItems = [
        {
          description: p1.description,
          hsnCode: p1.hsn,
          qty: item1Qty,
          ratePaise: rupeesToPaise(p1.rate),
          gstRate: p1.gstRate,
          discountPercent: i % 4 === 0 ? 5 : 0 // Occasional discount
        },
        {
          description: p2.description,
          hsnCode: p2.hsn,
          qty: item2Qty,
          ratePaise: rupeesToPaise(p2.rate),
          gstRate: p2.gstRate,
          discountPercent: 0
        }
      ];

      // Calculate invoice with complete GST engine
      const calculation = calculateInvoice({
        business: {
          gstin: bizGSTIN,
          stateCode: '27',
          regType: 'REGULAR'
        },
        customer: {
          gstin: customer.gstin,
          stateCode: customer.stateCode
        },
        items: rawItems
      });

      const { summary, items: calcItems } = calculation;
      const totalPaise = summary.totalPaise;

      let paidPaise = 0;
      let balancePaise = totalPaise;

      if (targetStatus === 'PAID') {
        paidPaise = totalPaise;
        balancePaise = 0;
      } else if (targetStatus === 'PARTIALLY_PAID') {
        paidPaise = Math.round(totalPaise * 0.4); // 40% paid
        balancePaise = totalPaise - paidPaise;
      }

      // Fixed 128-bit token constant (32 hex chars) so seeded pay links survive a reset
      const paymentToken = crypto.createHash('sha256').update(`baaki_seed_${invNum}`).digest('hex').slice(0, 32);

      // Insert invoice
      const invRes = insertInvoiceStmt.run(
        businessId,
        customer.id,
        invNum,
        calculation.invoiceType,
        invDate,
        dueDate,
        customer.state,
        summary.subtotalPaise,
        summary.discountPaise,
        summary.taxablePaise,
        summary.cgstPaise,
        summary.sgstPaise,
        summary.igstPaise,
        summary.roundOffPaise,
        totalPaise,
        paidPaise,
        balancePaise,
        targetStatus,
        paymentToken,
        `Invoice for Packaging supplies delivered under PO #${7000 + i}`
      );

      const invoiceId = invRes.lastInsertRowid;

      // Insert line items
      calcItems.forEach(item => {
        insertItemStmt.run(
          invoiceId,
          item.description,
          item.hsnCode,
          item.qty,
          item.unit,
          item.ratePaise,
          item.discountPaise,
          item.taxablePaise,
          item.gstRate,
          item.cgstPaise,
          item.sgstPaise,
          item.igstPaise,
          item.totalPaise
        );
      });

      // Insert payments if paid or partially paid
      if (paidPaise > 0) {
        const paymentDate = addDays(dueDate, paymentDaysAfterDue);
        const paymentMode = i % 3 === 0 ? 'NEFT' : (i % 2 === 0 ? 'UPI' : 'RTGS');
        insertPaymentStmt.run(
          businessId,
          customer.id,
          invoiceId,
          paymentDate,
          paidPaise,
          paymentMode,
          `UTR${Date.now().toString().slice(-6)}${100 + i}`,
          targetStatus === 'PAID' ? 'Full settlement' : 'Advance 40% installment'
        );
      }

      // Insert reminder if overdue or due soon (leave i === 30 without a sent reminder)
      if ((targetStatus === 'OVERDUE' || targetStatus === 'DUE_SOON') && i !== 30) {
        insertReminderStmt.run(
          businessId,
          invoiceId,
          customer.id,
          targetStatus === 'OVERDUE' ? 'OVERDUE_GENTLE' : 'UPCOMING',
          targetStatus === 'OVERDUE' ? 7 : -3,
          'WHATSAPP',
          addDays(DEMO_DATE, -1),
          addDays(DEMO_DATE, -1),
          'SENT',
          `Dear ${customer.name}, friendly reminder that ${invNum} of amount ₹${(balancePaise / 100).toLocaleString('en-IN')} is due on ${dueDate}.`
        );
      }

      // Insert dispute record if disputed
      if (targetStatus === 'DISPUTED') {
        insertDisputeStmt.run(
          businessId,
          invoiceId,
          customer.id,
          'Packaging dimensions slightly deviated from specification in batch #B3',
          Math.round(totalPaise * 0.3),
          'OPEN',
          'Customer requested replacement or 30% credit note for damaged edges'
        );
      }
    }

    // 5. Realistic Business Expenses
    const expenseDefs = [
      // Past expenses
      { category: 'SALARY', desc: 'Factory Workers & Staff Payroll for Sept 2026', amount: 350000, date: '2026-10-01', vendor: 'Internal Staff' },
      { category: 'RENT', desc: 'Bhosari MIDC Warehouse Lease - October 2026', amount: 85000, date: '2026-10-05', vendor: 'MIDC Property Holdings' },
      { category: 'SUPPLIER', desc: 'Virgin Kraft Paperboard Reel Inflow (20 MT)', amount: 620000, date: '2026-10-08', vendor: 'Century Paperboard Mills Ltd' },
      { category: 'SUPPLIER', desc: 'Industrial BoPP Film & Adhesive Raw Material', amount: 145000, date: '2026-10-12', vendor: 'Supreme Polymers India' },
      { category: 'ELECTRICITY', desc: 'MSEDCL Industrial Electricity Bill - High Tension', amount: 48500, date: '2026-10-15', vendor: 'Maharashtra State Electricity Board' },
      { category: 'GST', desc: 'GST Monthly Challan PMT-06 Settlement (Cash Ledger)', amount: 92400, date: '2026-10-20', vendor: 'GST Portal India' },
      { category: 'OFFICE', desc: 'Printing, Stationery & Plant Consumables', amount: 12500, date: '2026-10-18', vendor: 'Navneet Stationers Pune' },
      { category: 'UTILITIES', desc: 'Industrial Water Tankers & Facility Maintenance', amount: 18000, date: '2026-10-14', vendor: 'Bhosari Industrial Services' },

      // Future scheduled expenses within 13-week horizon (starting 2026-10-22)
      // Week 1 (Oct 22 - Oct 28):
      { category: 'OFFICE', desc: 'Consumables & Packaging Strapping', amount: 25000, date: '2026-10-25', vendor: 'Navneet Stationers Pune' },
      // Week 2 (Oct 29 - Nov 04):
      { category: 'SALARY', desc: 'Factory Staff & Machine Operators Payroll Oct 2026', amount: 250000, date: '2026-11-01', vendor: 'Internal Staff' },
      // Week 3 (Nov 05 - Nov 11) - Heavy Supplier & Tax week creating the planned cash shortage:
      { category: 'RENT', desc: 'Bhosari MIDC Plant Lease - November 2026', amount: 85000, date: '2026-11-05', vendor: 'MIDC Property Holdings' },
      { category: 'SUPPLIER', desc: 'Century Paperboard Mills Bulk Fluting Paper (40 MT)', amount: 1750000, date: '2026-11-08', vendor: 'Century Paperboard Mills Ltd' },
      { category: 'GST', desc: 'GST Monthly Settlement Challan - Oct 2026', amount: 95000, date: '2026-11-10', vendor: 'GST Portal India' },
      // Week 4 (Nov 12 - Nov 18):
      { category: 'ELECTRICITY', desc: 'Industrial Power Bill HT Connection', amount: 52000, date: '2026-11-15', vendor: 'Maharashtra State Electricity Board' },
      // Week 6 (Nov 26 - Dec 02):
      { category: 'SUPPLIER', desc: 'Raw Adhesives & Polymer Inks', amount: 180000, date: '2026-11-28', vendor: 'Supreme Polymers India' },
      // Week 7 (Dec 03 - Dec 09):
      { category: 'SALARY', desc: 'Factory Staff & Operators Payroll Nov 2026', amount: 350000, date: '2026-12-01', vendor: 'Internal Staff' },
      { category: 'RENT', desc: 'Bhosari MIDC Plant Lease - December 2026', amount: 85000, date: '2026-12-05', vendor: 'MIDC Property Holdings' }
    ];

    const insertExpenseStmt = db.prepare(`
      INSERT INTO expenses (
        business_id, category, expense_date, amount_paise, vendor, payment_mode, reference_no, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    expenseDefs.forEach((exp, idx) => {
      insertExpenseStmt.run(
        businessId,
        exp.category,
        exp.date,
        rupeesToPaise(exp.amount),
        exp.vendor,
        'NEFT',
        `CMS${8000 + idx}`,
        exp.desc
      );
    });
  });

  runInTransaction();

  // Evaluate forecast & chase prioritization for demo verification
  const forecast = calculateCashForecast(db);
  const shortageWeek = forecast.firstShortageWeek
    ? `Week ${forecast.firstShortageWeek.weekNumber} (${forecast.firstShortageWeek.startDate} to ${forecast.firstShortageWeek.endDate})`
    : 'None';
  const topInvoice = forecast.chaseList && forecast.chaseList.length > 0 ? forecast.chaseList[0] : null;

  console.log(`[SEED] Planned Demo Shortage: ${shortageWeek}`);
  if (forecast.firstShortageWeek) {
    console.log(`[SEED] Shortage Deficit: ${forecast.firstShortageWeek.formattedDeficit} below safety buffer of ₹5,00,000`);
    if (forecast.gapCoveringInvoices && forecast.gapCoveringInvoices.length > 0) {
      console.log(`[SEED] Gap-Covering Set (${forecast.gapCoveringInvoices.length} invoices, at most 3): ${forecast.gapCoveringInvoices.map(i => `${i.invoice_number} (${i.formatted_balance})`).join(', ')} -> Cumulative: ${forecast.gapCoveringInvoices[forecast.gapCoveringInvoices.length - 1].formatted_cumulative_amount} vs Shortfall: ${forecast.firstShortageWeek.formattedDeficit}`);
    }
  }
  if (topInvoice) {
    console.log(`[SEED] Top-Ranked Chase Invoice: #${topInvoice.invoice_number} - ${topInvoice.customer_name} (Score: ${topInvoice.score}/100, Balance: ${topInvoice.formatted_balance}, Reason: "${topInvoice.reason}")`);
  }

  return {
    seeded: true,
    shortage_week: shortageWeek,
    top_ranked_invoice: topInvoice ? `#${topInvoice.invoice_number} (${topInvoice.customer_name})` : null,
    message: 'Seeded Sharma Packaging [DEMO] with 12 customers, 40 invoices, payments and expenses'
  };
}

export default seedDatabase;
