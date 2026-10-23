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

export const REMINDER_TEMPLATES = {
  en: {
    [-3]: 'Dear {{customer}}, this is a gentle reminder from {{business}} that invoice {{invoiceNumber}} for {{amount}} is due on {{dueDate}}. View invoice and payment options: {{paymentLink}}',
    [0]: 'Dear {{customer}}, invoice {{invoiceNumber}} for {{amount}} from {{business}} is due today ({{dueDate}}). Please process the payment at your earliest convenience: {{paymentLink}}',
    [7]: 'Dear {{customer}}, invoice {{invoiceNumber}} ({{amount}}) from {{business}} was due on {{dueDate}} and is now 7 days overdue. Please confirm payment status or settle online: {{paymentLink}}',
    [15]: 'Attention {{customer}}: Invoice {{invoiceNumber}} for {{amount}} is now 15 days overdue. Kindly release payment today to avoid any hold on ongoing dispatches: {{paymentLink}}',
    [30]: 'URGENT NOTICE: Invoice {{invoiceNumber}} ({{amount}}) is 30 days overdue. Account credit is temporarily frozen pending settlement. Please clear immediately: {{paymentLink}}',
    [45]: 'FINAL DEMAND: Invoice {{invoiceNumber}} for {{amount}} is 45+ days overdue. This account is scheduled for MSME Samadhaan escalation and legal recovery unless cleared within 48 hours: {{paymentLink}}',
    default: 'Reminder from {{business}}: Invoice {{invoiceNumber}} of {{amount}} is outstanding. Pay here: {{paymentLink}}'
  },
  hi: {
    [-3]: 'नमस्ते {{customer}}, {{business}} की ओर से विनम्र स्मरण पत्र: बिल {{invoiceNumber}} का {{amount}} भुगतान {{dueDate}} को देय है। विवरण और ऑनलाइन भुगतान: {{paymentLink}}',
    [0]: 'नमस्ते {{customer}}, {{business}} का बिल {{invoiceNumber}} ({{amount}}) आज ({{dueDate}}) देय है। कृपया यथाशीघ्र भुगतान करें: {{paymentLink}}',
    [7]: 'नमस्ते {{customer}}, {{business}} का बिल {{invoiceNumber}} ({{amount}}) {{dueDate}} को देय था और 7 दिन अतिदेय है। कृपया स्थिति बताएं या ऑनलाइन भुगतान करें: {{paymentLink}}',
    [15]: 'ध्यान दें {{customer}}: बिल {{invoiceNumber}} का {{amount}} भुगतान 15 दिन अतिदेय है। आपूर्ति में रुकावट से बचने के लिए कृपया आज भुगतान करें: {{paymentLink}}',
    [30]: 'अति आवश्यक सूचना: बिल {{invoiceNumber}} ({{amount}}) 30 दिन अतिदेय है। खाता क्रेडिट अस्थायी रूप से रोक दिया गया है। कृपया तुरंत भुगतान करें: {{paymentLink}}',
    [45]: 'अंतिम मांग पत्र: बिल {{invoiceNumber}} का {{amount}} 45+ दिन अतिदेय है। 48 घंटों में भुगतान न होने पर कानूनी वसूली और MSME समाधान प्रक्रिया शुरू होगी: {{paymentLink}}',
    default: '{{business}} से स्मरण पत्र: बिल {{invoiceNumber}} का {{amount}} बकाया है। यहाँ भुगतान करें: {{paymentLink}}'
  },
  ta: {
    [-3]: 'வணக்கம் {{customer}}, {{business}}-இன் இன்வாய்ஸ் {{invoiceNumber}}-க்கான {{amount}} {{dueDate}} அன்று செலுத்தப்பட வேண்டும் என்பதற்கான நினைவூட்டல். விவரங்கள் மற்றும் கட்டண இணைப்பு: {{paymentLink}}',
    [0]: 'வணக்கம் {{customer}}, {{business}}-இன் இன்வாய்ஸ் {{invoiceNumber}}-க்கான {{amount}} இன்று ({{dueDate}}) செலுத்தப்பட வேண்டும். தயவுசெய்து உடனடியாக செலுத்தவும்: {{paymentLink}}',
    [7]: 'வணக்கம் {{customer}}, {{business}}-இன் இன்வாய்ஸ் {{invoiceNumber}} ({{amount}}) {{dueDate}} அன்று செலுத்தப்பட வேண்டியது, 7 நாட்கள் தாமதமாகியுள்ளது. உறுதிப்படுத்தவும் அல்லது ஆன்லைனில் செலுத்தவும்: {{paymentLink}}',
    [15]: 'கவனத்திற்கு {{customer}}: இன்வாய்ஸ் {{invoiceNumber}}-க்கான {{amount}} 15 நாட்கள் தாமதமாகியுள்ளது. விநியோகத் தடையைத் தவிர்க்க தயவுசெய்து இன்று செலுத்தவும்: {{paymentLink}}',
    [30]: 'அவசர அறிவிப்பு: இன்வாய்ஸ் {{invoiceNumber}} ({{amount}}) 30 நாட்கள் தாமதமாகியுள்ளது. கணக்கு கடன் தற்காலிகமாக நிறுத்தப்பட்டுள்ளது. உடனே செலுத்தவும்: {{paymentLink}}',
    [45]: 'இறுதி கோரிக்கை: இன்வாய்ஸ் {{invoiceNumber}}-க்கான {{amount}} 45+ நாட்கள் தாமதமாகியுள்ளது. 48 மணி நேரத்திற்குள் தீர்க்கப்படாவிட்டால் MSME சமாதான் மற்றும் சட்ட நடவடிக்கைகள் தொடங்கப்படும்: {{paymentLink}}',
    default: '{{business}}-இன் நினைவூட்டல்: இன்வாய்ஸ் {{invoiceNumber}}-க்கான {{amount}} நிலுவையில் உள்ளது. இங்கே செலுத்தவும்: {{paymentLink}}'
  }
};

/**
 * Generates reminder message text for WhatsApp and SMS in the requested language (en, hi, ta).
 */
export function generateMessageText({ stage, invoice, customer, business, payUrl, lang = 'en' }) {
  const bizName = (business && business.name) || 'Sharma Packaging';
  const custName = (customer && customer.name) || 'Customer';
  const invNum = invoice ? invoice.invoice_number : '';
  const balance = invoice ? formatIndianCurrency(invoice.balance_paise) : '₹0';
  const dueDate = invoice ? invoice.due_date : '';
  const link = payUrl || `https://baaki.app/pay/${(invoice && (invoice.payment_token || invoice.id)) || ''}`;
  const validLang = (lang === 'hi' || lang === 'ta') ? lang : 'en';

  const tplGroup = REMINDER_TEMPLATES[validLang] || REMINDER_TEMPLATES.en;
  const rawTemplate = tplGroup[stage] || tplGroup.default;

  return rawTemplate
    .replace(/\{\{customer\}\}/g, custName)
    .replace(/\{\{business\}\}/g, bizName)
    .replace(/\{\{invoiceNumber\}\}/g, invNum)
    .replace(/\{\{amount\}\}/g, balance)
    .replace(/\{\{dueDate\}\}/g, dueDate)
    .replace(/\{\{paymentLink\}\}/g, link);
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
      c.email as customer_email,
      c.preferred_language as preferred_language
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
      const custLang = inv.preferred_language || 'en';
      const messageText = generateMessageText({
        stage: evaluation.stage,
        invoice: inv,
        customer: { name: inv.customer_name },
        business,
        payUrl: `https://baaki.app/pay/${inv.payment_token || inv.id}`,
        lang: custLang
      });

      followups.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        customer_phone: inv.customer_phone,
        customer_email: inv.customer_email,
        preferred_language: custLang,
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

  const existingTarget = db.prepare('SELECT id, status FROM reminders WHERE invoice_id = ? AND stage = ?').get(invoiceId, stage);
  if (existingTarget && existingTarget.status === 'SENT') {
    const err = new Error(`Reminder for stage ${stage} has already been recorded as sent for invoice #${invoice.invoice_number}`);
    err.code = 'REMINDER_ALREADY_SENT';
    throw err;
  }

  const tx = db.transaction(() => {
    // 1. Mark the target stage as SENT (upsert for UNIQUE(invoice_id, stage))
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
