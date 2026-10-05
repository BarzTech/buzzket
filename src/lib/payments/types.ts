export type PaymentProviderType = "manual_momo" | "pesapal";

export type MobileMoneyNetwork = "mtn" | "airtel";

export type ManualPaymentStatus =
  | "pending"
  | "pending_payment"
  | "payment_submitted"
  | "paid"
  | "payment_approved"
  | "payment_rejected"
  | "cancelled"
  | "expired";

export interface MobileMoneyConfig {
  network: MobileMoneyNetwork;
  name: string;
  merchantCode: string;
  merchantName: string;
  ussdCode: string;
  badgeColor: string;
  instructions: string[];
}

export interface PaymentSubmission {
  reservationId: string;
  amount: number;
  network: MobileMoneyNetwork;
  transactionId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  unitPrice: number;
  qty: number;
}

export interface ManualVerificationItem {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  ticketTier: string;
  qty: number;
  unitPrice: number;
  total: number;
  subtotal: number;
  fees: number;
  paymentMethod: string;
  paymentProvider: string;
  transactionId: string;
  merchantCode: string;
  status: ManualPaymentStatus;
  rejectionReason: string | null;
  createdAt: string;
  verifiedAt: string | null;
  verifiedBy: string | null;
  emailSentAt: string | null;
  emailError: string | null;
  smsSentAt: string | null;
  smsError: string | null;
  isDuplicateTx?: boolean;
  duplicateOrderIds?: string[];
}
