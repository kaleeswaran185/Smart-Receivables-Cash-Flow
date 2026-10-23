import express from 'express';
import { getDatabase } from '../db.js';
import { parseBankCSV, matchBankTransaction, computeTxHash } from '../lib/bankMatcher.js';
import { formatIndianCurrency } from '../lib/money.js';
import { getToday } from '../lib/dateUtils.js';

const router = express.Router();

/**
 * POST /api/bank-import/preview
 * Parses CSV and matches against invoices WITHOUT modifying balances or payments.
 * SPEC Section 18 rule: "Nothing paid until I confirm".
 */
router.post('/preview', (req, res) => {
  try {
    const { csv_content } = req.body;
    if (!csv_content || typeof csv_content !== 'string' || !csv_content.trim()) {
      return res.status(400).json({
        error: 'INVALID_CSV',
        message: 'CSV content must be provided in csv_content string property'
      });
    }

    const db = getDatabase();
    const rawTransactions = parseBankCSV(csv_content);

    let newCount = 0;
    let duplicateCount = 0;
    let reconciledCount = 0;

    const previewItems = rawTransactions.map((tx, index) => {
      // Check existing in database (idempotency check)
      const existing = db.prepare('SELECT * FROM bank_transactions WHERE tx_hash = ?').get(tx.tx_hash);

      let importStatus = 'NEW';
      if (existing) {
        if (existing.status === 'RECONCILED') {
          importStatus = 'ALREADY_RECONCILED';
          reconciledCount++;
        } else {
          importStatus = 'ALREADY_IMPORTED';
          duplicateCount++;
        }
      } else {
        newCount++;
      }

      // Match against open invoices & customers
      const match = matchBankTransaction(tx, db);

      return {
        id: existing ? existing.id : `temp-${index}`,
        tx_date: tx.tx_date,
        narration: tx.narration,
        ref_no: tx.ref_no,
        amount_paise: tx.amount_paise,
        formatted_amount: tx.formatted_amount,
        tx_hash: tx.tx_hash,
        import_status: importStatus,
        is_duplicate: Boolean(existing),
        confidence: match.confidence,
        match_reason: match.match_reason,
        matched_invoice: match.matched_invoice ? {
          id: match.matched_invoice.id,
          invoice_number: match.matched_invoice.invoice_number,
          customer_name: match.matched_invoice.customer_name,
          customer_id: match.matched_invoice.customer_id,
          total_paise: match.matched_invoice.total_paise,
          balance_paise: match.matched_invoice.balance_paise,
          formatted_balance: formatIndianCurrency(match.matched_invoice.balance_paise),
          due_date: match.matched_invoice.due_date,
          status: match.matched_invoice.status
        } : null,
        tds_hint: match.tds_hint
      };
    });

    const summary = {
      total_rows: rawTransactions.length,
      new_count: newCount,
      duplicate_count: duplicateCount,
      already_reconciled_count: reconciledCount,
      high_confidence: previewItems.filter(i => i.confidence === 'HIGH').length,
      medium_confidence: previewItems.filter(i => i.confidence === 'MEDIUM').length,
      low_confidence: previewItems.filter(i => i.confidence === 'LOW').length,
      unmatched: previewItems.filter(i => i.confidence === 'NONE').length
    };

    res.json({
      summary,
      transactions: previewItems
    });
  } catch (err) {
    res.status(400).json({ error: 'PARSE_ERROR', message: err.message });
  }
});

/**
 * POST /api/bank-import/save
 * Idempotently saves parsed bank transactions to bank_transactions table without altering payments.
 */
router.post('/save', (req, res) => {
  try {
    const { csv_content } = req.body;
    if (!csv_content || typeof csv_content !== 'string') {
      return res.status(400).json({ error: 'INVALID_CSV', message: 'csv_content is required' });
    }

    const db = getDatabase();
    const parsed = parseBankCSV(csv_content);

    const defaultBiz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const businessId = defaultBiz ? defaultBiz.id : 1;

    let inserted = 0;
    let skipped = 0;

    const insertTx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO bank_transactions (
          business_id, tx_hash, tx_date, narration, ref_no, amount_paise,
          tx_type, status, matched_invoice_id, matched_customer_id, confidence,
          match_reason, tds_rate, tds_deducted_paise
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const tx of parsed) {
        const match = matchBankTransaction(tx, db);
        const tdsRate = match.tds_hint?.rate_percent || 0;
        const tdsPaise = match.tds_hint?.tds_amount_paise || 0;

        const result = stmt.run(
          businessId,
          tx.tx_hash,
          tx.tx_date,
          tx.narration,
          tx.ref_no,
          tx.amount_paise,
          'CREDIT',
          'UNRECONCILED',
          match.matched_invoice_id || null,
          match.matched_customer_id || null,
          match.confidence,
          match.match_reason,
          tdsRate,
          tdsPaise
        );

        if (result.changes > 0) {
          inserted++;
        } else {
          skipped++;
        }
      }
    });

    insertTx();

    res.json({
      success: true,
      total: parsed.length,
      inserted,
      skipped_duplicates: skipped
    });
  } catch (err) {
    res.status(500).json({ error: 'SAVE_FAILED', message: err.message });
  }
});

/**
 * GET /api/bank-import/transactions
 * Returns imported transactions from database.
 */
router.get('/transactions', (req, res) => {
  try {
    const db = getDatabase();
    const { status = 'ALL' } = req.query;

    let query = `
      SELECT
        bt.*,
        i.invoice_number as matched_invoice_number,
        i.balance_paise as invoice_balance_paise,
        c.name as matched_customer_name
      FROM bank_transactions bt
      LEFT JOIN invoices i ON bt.matched_invoice_id = i.id
      LEFT JOIN customers c ON bt.matched_customer_id = c.id
    `;

    const params = [];
    if (status !== 'ALL') {
      query += ' WHERE bt.status = ?';
      params.push(status);
    }

    query += ' ORDER BY bt.tx_date DESC, bt.id DESC';

    const rows = db.prepare(query).all(...params);

    const enriched = rows.map(r => ({
      ...r,
      formatted_amount: formatIndianCurrency(r.amount_paise),
      formatted_tds: r.tds_deducted_paise ? formatIndianCurrency(r.tds_deducted_paise) : null,
      formatted_invoice_balance: r.invoice_balance_paise ? formatIndianCurrency(r.invoice_balance_paise) : null
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'FETCH_FAILED', message: err.message });
  }
});

/**
 * POST /api/bank-import/confirm
 * Explicit confirmation step: updates invoice balances and creates official payment records.
 * SPEC Section 18 rule: "Nothing paid until I confirm".
 */
router.post('/confirm', (req, res) => {
  try {
    const { confirmations = [] } = req.body;
    if (!Array.isArray(confirmations) || confirmations.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'confirmations must be a non-empty array of reconciliation items'
      });
    }

    const db = getDatabase();
    const demoDate = getToday(db);

    const defaultBiz = db.prepare('SELECT id FROM business LIMIT 1').get();
    const businessId = defaultBiz ? defaultBiz.id : 1;

    const reconciledResults = [];

    const confirmTx = db.transaction(() => {
      const insertPaymentStmt = db.prepare(`
        INSERT INTO payments (
          business_id, customer_id, invoice_id, payment_date, amount_paise,
          payment_mode, reference_no, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateInvoiceStmt = db.prepare(`
        UPDATE invoices
        SET paid_paise = paid_paise + ?,
            balance_paise = MAX(0, balance_paise - ?),
            status = CASE
              WHEN (balance_paise - ?) <= 0 THEN 'PAID'
              ELSE 'PARTIALLY_PAID'
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const updateTxStmt = db.prepare(`
        UPDATE bank_transactions
        SET status = 'RECONCILED',
            matched_invoice_id = ?,
            payment_id = ?
        WHERE id = ? OR tx_hash = ?
      `);

      for (const item of confirmations) {
        const {
          tx_id,
          tx_hash,
          invoice_id,
          amount_paise,
          payment_date = demoDate,
          payment_mode = 'NEFT',
          reference_no,
          apply_tds = false,
          tds_paise = 0,
          notes
        } = item;

        if (!invoice_id) {
          throw new Error(`invoice_id is required for confirming transaction ${tx_id || tx_hash}`);
        }

        const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
        if (!invoice) {
          throw new Error(`Target invoice ID ${invoice_id} not found`);
        }

        const receivedAmount = Number(amount_paise || invoice.balance_paise);
        if (receivedAmount <= 0) {
          throw new Error('Payment amount must be greater than 0');
        }

        // If TDS is applied, the credited amount to invoice balance can include TDS shortfall
        const effectiveCreditPaise = apply_tds && tds_paise > 0
          ? Math.min(invoice.balance_paise, receivedAmount + Number(tds_paise))
          : Math.min(invoice.balance_paise, receivedAmount);

        // Record official payment
        const paymentNotes = notes || (apply_tds && tds_paise > 0
          ? `Bank Import reconciled with TDS deduction (${formatIndianCurrency(tds_paise)} TDS under Sec 194C/J)`
          : 'Bank Import reconciled payment');

        const payRes = insertPaymentStmt.run(
          businessId,
          invoice.customer_id,
          invoice.id,
          payment_date,
          receivedAmount,
          payment_mode,
          reference_no || `BANK-${Date.now()}`,
          paymentNotes
        );

        const paymentId = payRes.lastInsertRowid;

        // Update invoice balance
        updateInvoiceStmt.run(effectiveCreditPaise, effectiveCreditPaise, effectiveCreditPaise, invoice.id);

        // Fetch updated invoice
        const updatedInvoice = db.prepare('SELECT id, invoice_number, total_paise, paid_paise, balance_paise, status FROM invoices WHERE id = ?').get(invoice.id);

        // Update bank transaction status
        if (tx_id || tx_hash) {
          updateTxStmt.run(invoice.id, paymentId, tx_id || null, tx_hash || null);
        }

        reconciledResults.push({
          payment_id: paymentId,
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          received_paise: receivedAmount,
          effective_credited_paise: effectiveCreditPaise,
          new_balance_paise: updatedInvoice.balance_paise,
          new_status: updatedInvoice.status
        });
      }
    });

    confirmTx();

    res.json({
      success: true,
      reconciled_count: reconciledResults.length,
      reconciled_results: reconciledResults
    });
  } catch (err) {
    res.status(400).json({ error: 'CONFIRMATION_FAILED', message: err.message });
  }
});

export default router;
