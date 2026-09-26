// Shared domain types + formatting helpers. Safe to import from both client
// and server (no secrets, no Node-only APIs).

export type TicketTier = {
  id: string;
  eventId: string;
  name: string;
  price: number; // UGX
  quantityTotal: number;
  quantitySold: number;
  available: number; // quantityTotal - quantitySold - active reservations
};

export type Event = {
  id: string;
  title: string;
  category: string;
  date: string; // ISO
  venue: string;
  city: string;
  image: string;
  priceFrom: number; // UGX
  organizer: { name: string; avatar: string };
  description: string;
  featured?: boolean;
  tiers?: TicketTier[];
};

export const CATEGORIES = [
  "All",
  "Music",
  "Festival",
  "Conference",
  "Comedy",
  "Food",
  "Sports",
  "Fashion",
];

export const formatUGX = (n: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(n);

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("en-UG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kampala",
  });

export const formatTicketDate = (iso: string) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "DATE TBA";
    const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "Africa/Kampala" }).toUpperCase();
    const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "Africa/Kampala" });
    const year = d.toLocaleDateString("en-US", { year: "numeric", timeZone: "Africa/Kampala" });
    return `${month} ${day}, ${year}`;
  } catch {
    return "DATE TBA";
  }
};

export const formatTicketTime = (iso: string) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "AT TBA";
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Kampala",
    }).toUpperCase();
    return `AT ${time}`;
  } catch {
    return "AT TBA";
  }
};

export const formatTicketNumber = (id: string, qrToken?: string) => {
  const token = qrToken || id || "00000000";
  const clean = token.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `BZK-${clean.slice(0, 8)}`;
};
