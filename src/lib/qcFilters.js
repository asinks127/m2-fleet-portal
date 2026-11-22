/**
 * @deprecated Use lib/qcUtils.js instead — this file is kept for backward compatibility only.
 * Re-exports everything from qcUtils so existing imports continue to work.
 */

export { isValidRecord, isActiveWarrantyIssue, buildDataBreakdown, computeNextAction,
  isWarrantyIssue, isDamageClaim, isOpenIssue, isClosedIssue, isOverdueIssue, computeMetrics,
  computeDataQualityStatus, getMissingFields } from './qcUtils.js';