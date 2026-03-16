/**
 * Pure date-math helpers for report scheduling.
 * No side effects, no database access -- easy to test.
 * All computations use UTC to avoid DST issues.
 */

/**
 * Compute the next run date from a given cadence and reference date.
 *
 * @param {'WEEKLY'|'MONTHLY'|'QUARTERLY'|'YEARLY'} cadence
 * @param {Date} [fromDate=new Date()] - Reference date to compute from
 * @returns {Date} Next run timestamp
 */
export function computeNextRun(cadence, fromDate = new Date()) {
  const next = new Date(fromDate);
  switch (cadence) {
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case 'YEARLY':
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    default:
      throw new Error(`Unknown cadence: ${cadence}`);
  }
  return next;
}

/**
 * Compute the lookback date range for a given cadence.
 * Returns { dateStart, dateEnd } where dateEnd is the reference date
 * and dateStart is the lookback boundary.
 *
 * @param {'WEEKLY'|'MONTHLY'|'QUARTERLY'|'YEARLY'} cadence
 * @param {Date} [referenceDate=new Date()] - End of the range
 * @returns {{ dateStart: Date, dateEnd: Date }}
 */
export function computeDateRange(cadence, referenceDate = new Date()) {
  const end = new Date(referenceDate);
  const start = new Date(referenceDate);

  switch (cadence) {
    case 'WEEKLY':
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case 'MONTHLY':
      start.setUTCMonth(start.getUTCMonth() - 1);
      break;
    case 'QUARTERLY':
      start.setUTCMonth(start.getUTCMonth() - 3);
      break;
    case 'YEARLY':
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      break;
    default:
      throw new Error(`Unknown cadence: ${cadence}`);
  }

  return { dateStart: start, dateEnd: end };
}

/**
 * Map a schedule cadence to the appropriate ReportType enum value.
 *
 * @param {'WEEKLY'|'MONTHLY'|'QUARTERLY'|'YEARLY'} cadence
 * @returns {'WEEKLY_PERFORMANCE'|'MONTHLY_SUMMARY'|'CUSTOM'}
 */
export function cadenceToReportType(cadence) {
  switch (cadence) {
    case 'WEEKLY':
      return 'WEEKLY_PERFORMANCE';
    case 'MONTHLY':
      return 'MONTHLY_SUMMARY';
    case 'QUARTERLY':
    case 'YEARLY':
      return 'CUSTOM';
    default:
      return 'CUSTOM';
  }
}
