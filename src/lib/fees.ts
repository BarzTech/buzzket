// Buzzket platform commission. The organizer nets the ticket face value
// ("desired amount"); the buyer covers the platform's cut via a transparent
// "Service & Processing Fee" line at checkout.
export const COMMISSION_PERCENT = 0.05; // 5%
export const COMMISSION_FLAT_UGX = 500; // UGX 500 per ticket

// Gross-up formula (per ticket): Final = (Desired + 500) / 0.95
//
// Solving the gross-up so that after the platform deducts 5% + UGX 500 from the
// amount the buyer pays, the organizer is left with exactly `desired`:
//   final - (final * 0.05) - 500 = desired
//   final * 0.95 = desired + 500
//   final = (desired + 500) / 0.95
// We round UP so platform fees are always fully recovered (never under-collect).
export function grossUpPerTicket(desiredUnitPrice: number) {
  return Math.ceil((desiredUnitPrice + COMMISSION_FLAT_UGX) / (1 - COMMISSION_PERCENT));
}

// The buyer-facing service fee for a single ticket.
export function feePerTicket(desiredUnitPrice: number) {
  return grossUpPerTicket(desiredUnitPrice) - desiredUnitPrice;
}

export type FeeResponsibility = "customer" | "organizer";

export function calcOrder(unitPrice: number, qty: number, feeResponsibility: FeeResponsibility = "customer") {
  const subtotal = unitPrice * qty;
  const feePerUnit = grossUpPerTicket(unitPrice) - unitPrice;
  const fees = feePerUnit * qty;
  const total = feeResponsibility === "customer" ? subtotal + fees : subtotal;
  return { subtotal, fees, total };
}
