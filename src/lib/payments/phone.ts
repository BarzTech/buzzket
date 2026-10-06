import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/** Accept international numbers only and return a canonical E.164 value. */
export function normalizeWhatsAppNumber(input: string): string {
  const value = input.trim();
  if (!value.startsWith("+")) {
    throw new Error("Enter your WhatsApp number with the international country code, for example +256701234567.");
  }
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed?.isValid() || parsed.number.length < 9 || parsed.number.length > 16) {
    throw new Error("Enter a valid international WhatsApp number, for example +256701234567.");
  }
  return parsed.number;
}
