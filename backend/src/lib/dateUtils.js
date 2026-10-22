/**
 * Pure date utility functions.
 * CRITICAL RULE: Never calls new Date() for current time.
 * All operations are deterministic and anchor to `today` read from settings (demo_date).
 */

/**
 * Reads the single reference 'today' date string from settings.
 * @param {object} db - better-sqlite3 database instance
 * @returns {string} Date string in YYYY-MM-DD
 */
export function getToday(db) {
  try {
    let row = db.prepare("SELECT value FROM settings WHERE key = 'demoDate'").get();
    if (!row) {
      row = db.prepare("SELECT value FROM settings WHERE key = 'demo_date'").get();
    }
    if (row && row.value && /^\d{4}-\d{2}-\d{2}$/.test(row.value.trim())) {
      return row.value.trim();
    }
  } catch (err) {
    // fallback if db or table not yet initialized
  }
  return '2026-10-22';
}

/**
 * Adds an integer number of days to a YYYY-MM-DD date string.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} days - Positive or negative integer
 * @returns {string} Resulting YYYY-MM-DD
 */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Construct date at UTC noon to prevent timezone daylight shifts
  const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);

  const resY = utcDate.getUTCFullYear();
  const resM = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const resD = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

/**
 * Returns the whole day difference: dateA - dateB.
 * Positive if dateA is after dateB; negative if before.
 * @param {string} dateA - YYYY-MM-DD
 * @param {string} dateB - YYYY-MM-DD
 * @returns {number} Integer days
 */
export function diffDays(dateA, dateB) {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);

  const t1 = Date.UTC(y1, m1 - 1, d1, 12, 0, 0);
  const t2 = Date.UTC(y2, m2 - 1, d2, 12, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((t1 - t2) / msPerDay);
}

/**
 * Checks if a date falls inclusively between startDate and endDate.
 * @param {string} date - YYYY-MM-DD
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {boolean}
 */
export function isDateInRange(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
}

/**
 * Calculates start and end dates for 13 weekly forecast buckets.
 * Week 1 starts on `today`.
 * @param {string} today - YYYY-MM-DD
 * @param {number} [totalWeeks=13]
 * @returns {Array<{ weekNumber: number, startDate: string, endDate: string, label: string }>}
 */
export function getWeeklyBuckets(today, totalWeeks = 13) {
  const buckets = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const startOffset = (w - 1) * 7;
    const endOffset = startOffset + 6;
    const startDate = addDays(today, startOffset);
    const endDate = addDays(today, endOffset);
    buckets.push({
      weekNumber: w,
      startDate,
      endDate,
      label: `Week ${w} (${startDate} to ${endDate})`
    });
  }
  return buckets;
}
