export const CHECKOUT_STEPS = [
  "Select Tickets",
  "Contact Information",
  "Sign In",
  "Payment",
] as const;

/** The payment panel stays hidden until step four has server-returned data. */
export function canShowPaymentInstructions(step: number, paymentInfo: unknown): boolean {
  return step === 4 && paymentInfo !== null && paymentInfo !== undefined;
}
