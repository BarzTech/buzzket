import type { MobileMoneyConfig, MobileMoneyNetwork } from "./types";
import { formatUGX } from "../format";

export const DEFAULT_MTN_CONFIG = {
  merchantCode: "04454491",
  merchantName: "DARREN BAZIRA",
  ussdCode: "*165*3#",
};

export const DEFAULT_AIRTEL_CONFIG = {
  merchantCode: "6993013",
  merchantName: "BUZZKET",
  ussdCode: "*185*9#",
};

export function getMobileMoneyConfig(network: MobileMoneyNetwork, amountUGX?: number): MobileMoneyConfig {
  const amountStr = amountUGX ? formatUGX(amountUGX) : "the exact total";

  if (network === "mtn") {
    const code = DEFAULT_MTN_CONFIG.merchantCode;
    const name = DEFAULT_MTN_CONFIG.merchantName;
    return {
      network: "mtn",
      name: "MTN Mobile Money",
      merchantCode: code,
      merchantName: name,
      ussdCode: DEFAULT_MTN_CONFIG.ussdCode,
      badgeColor: "bg-[#FFCC00] text-black font-bold",
      instructions: code ? [
        `Dial ${DEFAULT_MTN_CONFIG.ussdCode} on your phone`,
        `Enter Merchant Code: ${code} (${name})`,
        `Enter Payment Reference: Your Name or Order Ref`,
        `Enter the exact amount: ${amountStr}`,
        `Enter your MTN MoMo PIN to authorize the transaction`,
        `Copy the Transaction ID from the MTN SMS receipt and enter it below`,
      ] : ["MTN payments are not configured yet. Please contact Buzzket support before sending money."],
    };
  }

  const code = DEFAULT_AIRTEL_CONFIG.merchantCode;
  const name = DEFAULT_AIRTEL_CONFIG.merchantName;
  return {
    network: "airtel",
    name: "Airtel Money",
    merchantCode: code,
    merchantName: name,
    ussdCode: DEFAULT_AIRTEL_CONFIG.ussdCode,
    badgeColor: "bg-[#ED1B24] text-white font-bold",
    instructions: code ? [
      `Dial ${DEFAULT_AIRTEL_CONFIG.ussdCode} on your phone`,
      `Enter Merchant / Pay Code: ${code} (${name})`,
      `Enter the exact amount: ${amountStr}`,
      `Enter Payment Reference: Your Name or Order Ref`,
      `Enter your Airtel Money PIN to authorize the transaction`,
      `Copy the Transaction ID from the Airtel SMS receipt and enter it below`,
    ] : ["Airtel payments are not configured yet. Please contact Buzzket support before sending money."],
  };
}

export function getAllMobileMoneyConfigs(amountUGX?: number): Record<MobileMoneyNetwork, MobileMoneyConfig> {
  return {
    mtn: getMobileMoneyConfig("mtn", amountUGX),
    airtel: getMobileMoneyConfig("airtel", amountUGX),
  };
}
