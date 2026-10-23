import { getSharedCashModel } from './sharedCashService.js';

/**
 * Calculates chase priority for all active invoices using the shared core service.
 * @param {object} db - better-sqlite3 database instance
 * @param {object} [options={}]
 * @returns {Array<object>} Ranked list of chase recommendations
 */
export function calculateChasePriority(db, options = {}) {
  const model = getSharedCashModel(db, options);
  const list = model.chaseList;
  list.chaseList = list;
  return list;
}

/**
 * Returns list of disputed invoices requiring dispute resolution.
 * @param {object} db - better-sqlite3 database instance
 * @param {object} [options={}]
 * @returns {Array<object>}
 */
export function getDisputeList(db, options = {}) {
  const model = getSharedCashModel(db, options);
  return model.resolveDisputeList;
}

export default calculateChasePriority;
