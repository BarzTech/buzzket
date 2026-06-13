// Buzzket platform commission charged to organizers per ticket sold.
// Buyers see a transparent service fee at checkout that covers this.
export const COMMISSION_PERCENT = 0.05; // 5%
export const COMMISSION_FLAT_UGX = 500; // UGX 500 per ticket

export function feePerTicket(unitPrice: number) {
  return Math.round(unitPrice * COMMISSION_PERCENT) + COMMISSION_FLAT_UGX;
}

export function calcOrder(unitPrice: number, qty: number) {
  const subtotal = unitPrice * qty;
  const fees = feePerTicket(unitPrice) * qty;
  return { subtotal, fees, total: subtotal + fees };
}
