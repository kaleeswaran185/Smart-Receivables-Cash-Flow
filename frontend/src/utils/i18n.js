import { useDemo } from '../context/DemoContext';

export const translations = {
  en: {
    // Navigation
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    customers: 'Customers',
    payments: 'Payments',
    followups: 'Follow-ups',
    chase: 'Chase',
    inbox: 'Inbox',
    forecast: 'Cash Forecast',
    settings: 'Settings',
    new_invoice: 'New Invoice',
    create_invoice: 'Create Invoice',
    more: 'More',
    simulated_date: 'Simulated Date',
    safety_buffer: 'Safety Buffer',

    // Actions & Bank Import
    import_bank_csv: 'Import Bank Statement (CSV)',
    record_payment: 'Record Payment',
    preview_matches: 'Preview & Auto-Match',
    confirm_reconciliation: 'Confirm Selected Reconciliations',
    nothing_paid_notice: 'Rule: No invoices are marked as paid and no accounts are credited until you click Confirm Reconciliation.',
    confidence_high: 'High Confidence',
    confidence_medium: 'Medium Confidence',
    confidence_low: 'Low Confidence',
    confidence_none: 'Unmatched',
    tds_detected: 'TDS Shortfall Detected',
    apply_tds: 'Apply TDS Reconciliation',
    already_imported: 'Already Staged',
    already_reconciled: 'Already Reconciled',
    new_transaction: 'New Transaction',

    // Statuses
    status_paid: 'Paid',
    status_overdue: 'Overdue',
    status_due_soon: 'Due Soon',
    status_partially_paid: 'Partially Paid',
    status_sent: 'Sent',
    status_disputed: 'Disputed',
    status_draft: 'Draft',

    // Dashboard
    total_outstanding: 'Total Outstanding',
    overdue_amount: 'Overdue Amount',
    expected_this_week: 'Expected This Week',
    expected_this_month: 'Expected This Month',
    chase_first_title: 'CHASE THESE FIRST',
    ageing_breakdown: 'Receivables Ageing Breakdown',
    shortage_alert: 'Cash Shortage Warning'
  },
  hi: {
    // Navigation
    dashboard: 'डैशबोर्ड (Dashboard)',
    invoices: 'चालान (Invoices)',
    customers: 'ग्राहक (Customers)',
    payments: 'भुगतान (Payments)',
    followups: 'तगादा (Follow-ups)',
    chase: 'तगादा',
    inbox: 'इनबॉक्स (Inbox)',
    forecast: 'रोकड़ पूर्वानुमान (Forecast)',
    settings: 'सेटिंग्स (Settings)',
    new_invoice: 'नया चालान',
    create_invoice: 'चालान बनाएं',
    more: 'अन्य',
    simulated_date: 'सिम्युलेटेड तारीख',
    safety_buffer: 'सुरक्षा बफर',

    // Actions & Bank Import
    import_bank_csv: 'बैंक स्टेटमेंट आयात करें (CSV)',
    record_payment: 'भुगतान दर्ज करें',
    preview_matches: 'पूर्वावलोकन और मिलान (Preview)',
    confirm_reconciliation: 'चयनित मिलान की पुष्टि करें (Confirm)',
    nothing_paid_notice: 'नियम: जब तक आप पुष्टि नहीं करते, कोई भी चालान भुगतान हुआ नहीं माना जाएगा।',
    confidence_high: 'उच्च विश्वसनीयता (High)',
    confidence_medium: 'मध्यम विश्वसनीयता (Medium)',
    confidence_low: 'निम्न विश्वसनीयता (Low)',
    confidence_none: 'अमेल (Unmatched)',
    tds_detected: 'टीडीएस (TDS) कटौती पहचानी गई',
    apply_tds: 'टीडीएस समाधान लागू करें',
    already_imported: 'पहले से आयातित',
    already_reconciled: 'पहले से चुकता (Reconciled)',
    new_transaction: 'नया लेन-देन',

    // Statuses
    status_paid: 'भुगतान पूर्ण (Paid)',
    status_overdue: 'अतिदेय (Overdue)',
    status_due_soon: 'जल्द देय (Due Soon)',
    status_partially_paid: 'आंशिक भुगतान (Part Paid)',
    status_sent: 'भेजा गया (Sent)',
    status_disputed: 'विवादित (Disputed)',
    status_draft: 'प्रारूप (Draft)',

    // Dashboard
    total_outstanding: 'कुल बाकी रकम (Outstanding)',
    overdue_amount: 'अतिदेय रकम (Overdue)',
    expected_this_week: 'इस हफ्ते अपेक्षित (This Week)',
    expected_this_month: 'इस महीने अपेक्षित (This Month)',
    chase_first_title: '🔥 पहले इनका तगादा करें (Chase First)',
    ageing_breakdown: 'बकाया अवधि विवरण (Ageing)',
    shortage_alert: 'रोकड़ कमी की चेतावनी (Shortage)'
  },
  hinglish: {
    // Navigation
    dashboard: 'Dashboard',
    invoices: 'Invoices (चालान)',
    customers: 'Customers (पार्टियां)',
    payments: 'Payments (पेमेंट)',
    followups: 'Follow-ups (तगादा)',
    chase: 'Chase',
    inbox: 'Inbox',
    forecast: 'Cash Forecast',
    settings: 'Settings',
    new_invoice: 'New Invoice बनाएं',
    create_invoice: 'Invoice बनाएं',
    more: 'More',
    simulated_date: 'Demo Date',
    safety_buffer: 'Safety Buffer',

    // Actions & Bank Import
    import_bank_csv: 'Bank Statement Import करें (CSV)',
    record_payment: 'Payment Record करें',
    preview_matches: 'Match Check करें',
    confirm_reconciliation: 'Selected Match Confirm करें',
    nothing_paid_notice: 'जब तक आप Confirm नहीं करेंगे, कोई चालान Paid नहीं होगा।',
    confidence_high: 'Pakka Match (High)',
    confidence_medium: 'Probable Match (Medium)',
    confidence_low: 'Doubtful Match (Low)',
    confidence_none: 'Unmatched',
    tds_detected: 'TDS Deduction Detect हुआ',
    apply_tds: 'TDS Adjust करें',
    already_imported: 'Already Imported',
    already_reconciled: 'Already Reconciled',
    new_transaction: 'New Entry',

    // Statuses
    status_paid: 'Paid',
    status_overdue: 'Overdue (लेट)',
    status_due_soon: 'Due Soon',
    status_partially_paid: 'Part Paid',
    status_sent: 'Sent',
    status_disputed: 'Disputed',
    status_draft: 'Draft',

    // Dashboard
    total_outstanding: 'Total Baaki (Outstanding)',
    overdue_amount: 'Late Baaki (Overdue)',
    expected_this_week: 'Expected This Week',
    expected_this_month: 'Expected This Month',
    chase_first_title: '🔥 Pehle Tagada Karein',
    ageing_breakdown: 'Ageing Breakdown',
    shortage_alert: 'Cash Shortage Alert'
  }
};

export function useTranslation() {
  const { language = 'en', setLanguage } = useDemo();
  const currentLang = translations[language] ? language : 'en';
  const dict = translations[currentLang];

  const t = (key, fallback = '') => {
    return dict[key] || translations.en[key] || fallback || key;
  };

  return { t, language: currentLang, setLanguage };
}

export default useTranslation;
