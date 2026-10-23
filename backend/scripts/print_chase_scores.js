import { getDatabase } from '../src/db.js';
import { calculateChasePriority } from '../src/services/chaseService.js';
import { getSharedCashModel } from '../src/services/sharedCashService.js';

const db = getDatabase();
const chaseList = calculateChasePriority(db);
console.log('=== OPEN INVOICES CHASE SCORES ===');
console.log(`Total Open Invoices in Chase List: ${chaseList.length}`);
chaseList.forEach((inv, idx) => {
  console.log(
    `${idx + 1}. Score: ${inv.score} | ${inv.invoice_number} | ${inv.customer_name} | Balance: ₹${(inv.balance_paise / 100).toLocaleString('en-IN')} | Days Overdue: ${inv.days_overdue} | Priority: ${inv.priority_level} | Status: ${inv.status}`
  );
});

const allOpen = db.prepare("SELECT SUM(balance_paise) as total_bal, MAX(balance_paise) as max_bal FROM invoices WHERE status != 'PAID'").get();
console.log('\n=== SEED REALISM STATS ===');
console.log(`Total Receivables: ₹${(allOpen.total_bal / 100).toLocaleString('en-IN')}`);
console.log(`Largest Invoice: ₹${(allOpen.max_bal / 100).toLocaleString('en-IN')} (${((allOpen.max_bal / allOpen.total_bal) * 100).toFixed(1)}% of total receivables - requirement: well under 1/3, i.e. < 33.3%)`);

const scores = chaseList.map(i => i.score);
const scoresAt100 = scores.filter(s => s === 100).length;
const top5 = scores.slice(0, 5);
const top5Unique = new Set(top5).size;
console.log(`\nScores == 100 count: ${scoresAt100} (requirement: <= 1)`);
console.log(`Top 5 scores: [${top5.join(', ')}] (requirement: distinct, count = ${top5Unique}/5)`);

const model = getSharedCashModel(db);
console.log('\n=== CASH SHORTAGE & GAP COVERING SET ===');
console.log(`First Shortage Week: ${model.firstShortageWeek ? 'Week ' + model.firstShortageWeek.weekNumber + ' (' + model.firstShortageWeek.label + ')' : 'None'}`);
console.log(`Shortage Deficit: ${model.firstShortageWeek ? model.firstShortageWeek.formattedDeficit : 'None'}`);
console.log(`Gap-Covering Invoices Count: ${model.gapCoveringInvoices.length} (at most 3)`);
model.gapCoveringInvoices.forEach((inv, i) => {
  console.log(`  ${i + 1}. ${inv.invoice_number} - ${inv.customer_name}: ₹${(inv.balance_paise / 100).toLocaleString('en-IN')} (Cumulative: ${inv.formatted_cumulative_amount} vs Shortfall: ${inv.formatted_shortfall})`);
});
