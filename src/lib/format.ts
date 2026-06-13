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
  });
