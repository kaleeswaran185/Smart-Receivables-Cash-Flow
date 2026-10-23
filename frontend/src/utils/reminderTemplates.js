import { formatIndianCurrency, formatDate } from './money';

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
 * Generates reminder message text using template and placeholders.
 */
export function renderReminderMessage({ stage, lang = 'en', customer, business = 'Sharma Packaging', invoiceNumber, amount, dueDate, paymentLink }) {
  const validLang = (lang === 'hi' || lang === 'ta') ? lang : 'en';
  const tplGroup = REMINDER_TEMPLATES[validLang] || REMINDER_TEMPLATES.en;
  const rawTemplate = tplGroup[stage] || tplGroup.default;

  return rawTemplate
    .replace(/\{\{customer\}\}/g, customer || 'Customer')
    .replace(/\{\{business\}\}/g, business || 'Sharma Packaging')
    .replace(/\{\{invoiceNumber\}\}/g, invoiceNumber || '')
    .replace(/\{\{amount\}\}/g, amount || '₹0')
    .replace(/\{\{dueDate\}\}/g, dueDate || '')
    .replace(/\{\{paymentLink\}\}/g, paymentLink || '');
}
