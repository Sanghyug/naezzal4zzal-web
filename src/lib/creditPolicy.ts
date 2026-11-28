export const PAID_CREDIT_POLICY_VERSION = "paid-12-months-v1";
export const PAID_CREDIT_TERM = "결제 승인일부터 1년(12개월)";

// Twelve calendar months in Korea, preserving the approval time. February 29
// uses February 28 the following year rather than rolling into March.
export function paidCreditExpiry(approvedAt: number): number {
  const kst = new Date(approvedAt + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear() + 1;
  const month = kst.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(kst.getUTCDate(), lastDay),
    kst.getUTCHours(), kst.getUTCMinutes(), kst.getUTCSeconds(),
    kst.getUTCMilliseconds()) - 9 * 60 * 60 * 1000;
}
