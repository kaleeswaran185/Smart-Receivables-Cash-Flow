/**
 * Reminder Engine & Escalation Ladder Service
 * Ladder stages: -3, 0, 7, 15, 30, 45 days.
 * Rules:
 * - Each stage can be sent only once per invoice.
 * - Disputed invoices pause the ladder.
 * - Active promises pause the ladder until promised_date, then resume.
 * - Snoozed invoices pause until snoozed_until.
 * - Part payments keep the invoice active with remaining balance.
 * - Generates message text tailored per stage.
 */

import { getToday, diffDays, addDays } from '../lib/dateUtils.js';
import { formatIndianCurrency } from '../lib/money.js';

export const STAGES = [-3, 0, 7, 15, 30, 45];

export const STAGE_META = {
  [-3]: { name: 'UPCOMING', label: 'Upcoming Due Reminder (-3 days)', severity: 'GENTLE' },
  [0]: { name: 'DUE_TODAY', label: 'Due Today (0 days)', severity: 'GENTLE' },
  [7]: { name: 'OVERDUE_GENTLE', label: 'First Overdue Reminder (7 days)', severity: 'MODERATE' },
  [15]: { name: 'OVERDUE_FIRM', label: 'Firm Follow-up (15 days)', severity: 'FIRM' },
  [30]: { name: 'URGENT_HOLD', label: 'Supply Hold Warning (30 days)', severity: 'URGENT' },
  [45]: { name: 'LEGAL_NOTICE', label: 'Legal & MSME Demand (45 days)', severity: 'CRITICAL' }
};

/**
 * Generates reminder message text for WhatsApp and SMS.
 */
export function generateMessageText({ stage, invoice, customer, business, payUrl }) {
  const bizName = business.name || 'Sharma Packaging';
  const custName = customer.name || 'Customer';
  const invNum = invoice.invoice_number;
  const balance = formatIndianCurrency(invoice.balance_paise);
  const dueDate = invoice.due_date;
  const link = payUrl || `https://baaki.app/pay/${invoice.payment_token || invoice.id}`;

  switch (stage) {
    case -3:
      return `Dear ${custName}, this is a gentle reminder from ${bizName} that invoice ${invNum} for ${balance} is due on ${dueDate}. View invoice and payment options: ${link}`;
    case 0:
      return `Dear ${custName}, invoice ${invNum} for ${balance} from ${bizName} is due today (${dueDate}). Please process the payment at your earliest convenience: ${link}`;
    case 7:
      return `Dear ${custName}, invoice ${invNum} (${balance}) from ${bizName} was due on ${dueDate} and is now 7 days overdue. Please confirm payment status or settle online: ${link}`;
    case 15:
      return `Attention ${custName}: Invoice ${invNum} for ${balance} is now 15 days overdue. Kindly release payment today to avoid any hold on ongoing dispatches: ${link}`;
    case 30:
      return `URGENT NOTICE: Invoice ${invNum} (${balance}) is 30 days overdue. Account credit is temporarily frozen pending settlement. Please clear immediately: ${link}`;
    case 45:
      return `FINAL DEMAND: Invoice ${invNum} for ${balance} is 45+ days overdue. This account is scheduled for MSME Samadhaan escalation and legal recovery unless cleared within 48 hours: ${link}`;
    default:
      return `Reminder from ${bizName}: Invoice ${invNum} of ${balance} is outstanding. Pay here: ${link}`;
  }
}

/**
 * Evaluates the current reminder status for an invoice.
 * Determines eligible stage, whether paused, already sent, etc.
 */
export function evaluateInvoiceReminder(db, invoiceOrId, today = null) {
  if (!today) today = getToday(db);

  const invoice = typeof invoiceOrId === 'object' && invoiceOrId !== null
    ? invoiceOrId
    : db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceOrId);

  if (!invoice) {
    return { isActionable: false, status: 'NOT_FOUND', reason: 'Invoice not found' };
  }

  // 1. Inactive checks
  if (invoice.balance_paise <= 0 || invoice.status === 'PAID' || invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') {
    return { isActionable: false, status: 'INACTIVE', reason: 'Invoice is fully paid or inactive' };
  }

  // 2. Check Snooze
  if (invoice.snoozed_until && invoice.snoozed_until >= today) {
    return {
      isActionable: false,
      isPaused: true,
      pauseReason: 'SNOOZED',
      snoozedUntil: invoice.snoozed_until,
      reason: `Snoozed until ${invoice.snoozed_until}`
    };
  }

  // 3. Check Dispute pause
  if (invoice.status === 'DISPUTED') {
    return {
      isActionable: false,
      isPaused: true,
      pauseReason: 'DISPUTE_ACTIVE',
      reason: 'Dispute active on invoice; ladder paused'
    };
  }
  const openDispute = db.prepare("SELECT * FROM disputes WHERE invoice_id = ? AND status = 'OPEN'").get(invoice.id);
  if (openDispute) {
    return {
      isActionable: false,
      isPaused: true,
      pauseReason: 'DISPUTE_ACTIVE',
      dispute: openDispute,
      reason: `Open dispute: ${openDispute.reason}`
    };
  }

  // 4. Check Promise to Pay pause
  const activePromise = db.prepare(`
    SELECT * FROM promises
    WHERE invoice_id = ? AND status = 'PENDING'
    ORDER BY promised_date DESC LIMIT 1
  `).get(invoice.id);

  if (activePromise) {
    if (activePromise.promised_date >= today) {
      return {
        isActionable: false,
        isPaused: true,
        pauseReason: 'PROMISE_ACTIVE',
        promisedDate: activePromise.promised_date,
        reason: `Payment promised by ${activePromise.promised_date}; ladder paused until then`
      };
    }
    // If promised_date < today, promise is broken; ladder resumes!
  }

  // 5. Determine Eligible Due Stages based on days overdue
  const daysOverdue = diffDays(today, invoice.due_date);

  // Eligible stages are all predefined stages where stage <= daysOverdue
  const eligibleStages = STAGES.filter(s => s <= daysOverdue);

  if (eligibleStages.length === 0) {
    return {
      isActionable: false,
      status: 'NOT_DUE_YET',
      daysOverdue,
      reason: `Invoice due in ${Math.abs(daysOverdue)} days (before reminder window)`
    };
  }

  // 6. Check existing sent or skipped stages in DB
  const existingRecords = db.prepare(`
    SELECT stage, status FROM reminders WHERE invoice_id = ?
  `).all(invoice.id);

  const handledStages = new Set(
    existingRecords
      .filter(r => r.status === 'SENT' || r.status === 'SKIPPED')
      .map(r => r.stage)
  );

  // Unsent due stages
  const unsentDueStages = eligibleStages.filter(s => !handledStages.has(s));

  if (unsentDueStages.length === 0) {
    return {
      isActionable: false,
      status: 'ALREADY_SENT',
      daysOverdue,
      reason: `All eligible stages up to ${daysOverdue} days overdue have already been handled`
    };
  }

  // Rule 7: Send only the HIGHEST due unsent stage
  const currentStage = Math.max(...unsentDueStages);

  // Invoice is actionable for this highest unsent stage!
  return {
    isActionable: true,
    isPaused: false,
    stage: currentStage,
    meta: STAGE_META[currentStage],
    daysOverdue,
    hasBrokenPromise: !!(activePromise && activePromise.promised_date < today)
  };
}

/**
 * Gets list of all actionable followups for today across the business.
 */
export function getActionableFollowups(db) {
  const today = getToday(db);

  const business = db.prepare('SELECT * FROM business LIMIT 1').get() || { name: 'Sharma Packaging' };

  const invoices = db.prepare(`
    SELECT
      i.*,
      c.name as customer_name,
      c.company_name as customer_company,
      c.phone as customer_phone,
      c.email as customer_email
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.status NOT IN ('PAID', 'CANCELLED', 'DRAFT')
      AND i.balance_paise > 0
    ORDER BY i.due_date ASC
  `).all();

  const followups = [];

  invoices.forEach(inv => {
    const evaluation = evaluateInvoiceReminder(db, inv, today);
    if (evaluation.isActionable) {
      const messageText = generateMessageText({
        stage: evaluation.stage,
        invoice: inv,
        customer: { name: inv.customer_name },
        business,
        payUrl: `https://baaki.app/pay/${inv.payment_token || inv.id}`
      });

      followups.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        customer_phone: inv.customer_phone,
        customer_email: inv.customer_email,
        total_paise: inv.total_paise,
        paid_paise: inv.paid_paise,
        balance_paise: inv.balance_paise,
        formatted_balance: formatIndianCurrency(inv.balance_paise),
        due_date: inv.due_date,
        days_overdue: evaluation.daysOverdue,
        stage: evaluation.stage,
        stage_name: evaluation.meta.name,
        stage_label: evaluation.meta.label,
        severity: evaluation.meta.severity,
        message_body: messageText,
        channel: 'WHATSAPP',
        has_broken_promise: evaluation.hasBrokenPromise,
        payment_token: inv.payment_token
      });
    }
  });

  return followups;
}

/**
 * Records that a reminder has been sent.
 * Rule: Marks the sent stage as 'SENT', and any earlier due unsent stages as 'SKIPPED'.
 */
export function recordReminderSent(db, { invoiceId, stage, channel = 'WHATSAPP', messageBody, sentAt }) {
  const today = getToday(db);
  const finalSentAt = sentAt || today;

  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const meta = STAGE_META[stage] || { name: 'CUSTOM' };
  const daysOverdue = diffDays(finalSentAt, invoice.due_date);

  const tx = db.transaction(() => {
    // 1. Mark the target stage as SENT (upsert for UNIQUE(invoice_id, stage))
    const existingTarget = db.prepare('SELECT id FROM reminders WHERE invoice_id = ? AND stage = ?').get(invoiceId, stage);
    let reminderId;

    if (existingTarget) {
      db.prepare(`
        UPDATE reminders
        SET status = 'SENT', sent_at = ?, message_body = ?, channel = ?, reminder_type = ?
        WHERE id = ?
      `).run(finalSentAt, messageBody || '', channel, meta.name, existingTarget.id);
      reminderId = existingTarget.id;
    } else {
      const insert = db.prepare(`
        INSERT INTO reminders (
          business_id, invoice_id, customer_id, reminder_type, stage, channel, scheduled_at, sent_at, status, message_body
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SENT', ?)
      `).run(
        invoice.business_id,
        invoice.id,
        invoice.customer_id,
        meta.name,
        stage,
        channel,
        finalSentAt,
        finalSentAt,
        messageBody || ''
      );
      reminderId = insert.lastInsertRowid;
    }

    // 2. Mark any earlier due stages as 'SKIPPED'
    for (const s of STAGES) {
      if (s < stage && s <= daysOverdue) {
        const existingEarlier = db.prepare('SELECT id, status FROM reminders WHERE invoice_id = ? AND stage = ?').get(invoiceId, s);
        if (!existingEarlier) {
          const metaS = STAGE_META[s] || { name: 'CUSTOM' };
          db.prepare(`
            INSERT INTO reminders (
              business_id, invoice_id, customer_id, reminder_type, stage, channel, scheduled_at, sent_at, status, message_body
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SKIPPED', 'Skipped due to jump to higher stage')
          `).run(
            invoice.business_id,
            invoice.id,
            invoice.customer_id,
            metaS.name,
            s,
            channel,
            finalSentAt,
            finalSentAt
          );
        } else if (existingEarlier.status === 'PENDING') {
          db.prepare("UPDATE reminders SET status = 'SKIPPED' WHERE id = ?").run(existingEarlier.id);
        }
      }
    }

    return reminderId;
  });

  const reminderId = tx();
  return { id: reminderId, invoice_id: invoiceId, stage, sent_at: finalSentAt };
}

/**
 * Snoozes an invoice until a specified date.
 */
export function snoozeInvoice(db, invoiceId, { snoozeUntil, days }) {
  const today = getToday(db);
  let targetDate = snoozeUntil;
  if (!targetDate && days) {
    targetDate = addDays(today, Number(days));
  }
  if (!targetDate) {
    targetDate = addDays(today, 7); // Default 7 days
  }

  db.prepare('UPDATE invoices SET snoozed_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetDate, invoiceId);
  return { invoiceId, snoozed_until: targetDate };
}

/**
 * Records an invoice dispute and pauses the ladder.
 */
export function disputeInvoice(db, invoiceId, { reason, amountPaise, resolutionNotes }) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const disputedAmount = (amountPaise !== undefined) ? amountPaise : invoice.balance_paise;

  const insert = db.prepare(`
    INSERT INTO disputes (
      business_id, invoice_id, customer_id, reason, disputed_amount_paise, status, resolution_notes
    ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?)
  `).run(
    invoice.business_id,
    invoice.id,
    invoice.customer_id,
    reason || 'Customer raised invoice discrepancy',
    disputedAmount,
    resolutionNotes || null
  );

  db.prepare("UPDATE invoices SET status = 'DISPUTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(invoiceId);

  return { disputeId: insert.lastInsertRowid, invoiceId, status: 'DISPUTED', disputed_amount_paise: disputedAmount };
}

/**
 * Records a customer promise to pay and pauses the ladder.
 */
export function promiseInvoice(db, invoiceId, { promisedDate, amountPaise, notes }) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const promisedAmount = (amountPaise !== undefined) ? amountPaise : invoice.balance_paise;

  const insert = db.prepare(`
    INSERT INTO promises (
      business_id, customer_id, invoice_id, promised_date, promised_amount_paise, status, notes
    ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(
    invoice.business_id,
    invoice.customer_id,
    invoice.id,
    promisedDate,
    promisedAmount,
    notes || null
  );

  return { promiseId: insert.lastInsertRowid, invoiceId, promised_date: promisedDate, status: 'PENDING' };
}
