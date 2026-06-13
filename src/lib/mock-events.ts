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
};

const img = (seed: string) =>
  `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=1200&q=70`;

export const EVENTS: Event[] = [
  {
    id: "blankets-wine-kampala",
    title: "Blankets & Wine Kampala",
    category: "Music",
    date: "2026-07-12T16:00:00",
    venue: "Lugogo Cricket Oval",
    city: "Kampala",
    image: img("photo-1514525253161-7a46d19cd819"),
    priceFrom: 75000,
    organizer: { name: "Swangz Avenue", avatar: img("photo-1494790108377-be9c29b29330") },
    description:
      "An afternoon of soulful live music, curated food and the best of East African creativity. Bring a blanket, bring a friend.",
    featured: true,
  },
  {
    id: "nyege-nyege-2026",
    title: "Nyege Nyege Festival 2026",
    category: "Festival",
    date: "2026-09-10T12:00:00",
    venue: "Itanda Falls",
    city: "Jinja",
    image: img("photo-1459749411175-04bf5292ceea"),
    priceFrom: 250000,
    organizer: { name: "Nyege Nyege Tapes", avatar: img("photo-1535713875002-d1d0cf377fde") },
    description:
      "Four days, four stages, hundreds of artists from across the continent on the banks of the Nile.",
    featured: true,
  },
  {
    id: "kla-tech-summit",
    title: "Kampala Tech Summit",
    category: "Conference",
    date: "2026-08-22T09:00:00",
    venue: "Kampala Serena Hotel",
    city: "Kampala",
    image: img("photo-1505373877841-8d25f7d46678"),
    priceFrom: 120000,
    organizer: { name: "Innovation Village", avatar: img("photo-1500648767791-00dcc994a43e") },
    description:
      "The largest gathering of founders, engineers and investors in East Africa. Two days of talks, demos and deals.",
    featured: true,
  },
  {
    id: "comedy-store-uganda",
    title: "Comedy Store Uganda — Anniversary",
    category: "Comedy",
    date: "2026-07-25T20:00:00",
    venue: "UMA Multipurpose Hall",
    city: "Kampala",
    image: img("photo-1527224857830-43a7acc85260"),
    priceFrom: 40000,
    organizer: { name: "Alex Muhangi", avatar: img("photo-1568602471122-7832951cc4c5") },
    description:
      "Uganda's biggest comedians under one roof for one unforgettable night.",
  },
  {
    id: "afro-food-festival",
    title: "Afro Food & Wine Festival",
    category: "Food",
    date: "2026-08-02T11:00:00",
    venue: "Sheraton Gardens",
    city: "Kampala",
    image: img("photo-1414235077428-338989a2e8c0"),
    priceFrom: 50000,
    organizer: { name: "Taste Uganda", avatar: img("photo-1438761681033-6461ffad8d80") },
    description:
      "Sample dishes from 40+ chefs, pair with local wines, watch live cooking demos.",
  },
  {
    id: "marathon-2026",
    title: "MTN Kampala Marathon",
    category: "Sports",
    date: "2026-11-15T06:00:00",
    venue: "Kololo Independence Grounds",
    city: "Kampala",
    image: img("photo-1452626038306-9aae5e071dd3"),
    priceFrom: 30000,
    organizer: { name: "MTN Uganda", avatar: img("photo-1472099645785-5658abf4ff4e") },
    description: "Run for a cause across 5km, 10km, 21km and 42km categories.",
  },
  {
    id: "fashion-week-ug",
    title: "Kampala Fashion Week",
    category: "Fashion",
    date: "2026-10-04T18:00:00",
    venue: "Kampala Sheraton",
    city: "Kampala",
    image: img("photo-1469334031218-e382a71b716b"),
    priceFrom: 90000,
    organizer: { name: "KFW Council", avatar: img("photo-1544005313-94ddf0286df2") },
    description: "East Africa's leading designers showcase their newest collections.",
  },
  {
    id: "gospel-night",
    title: "Worship Night Uganda",
    category: "Music",
    date: "2026-09-28T17:00:00",
    venue: "Namboole Stadium",
    city: "Kampala",
    image: img("photo-1493225457124-a3eb161ffa5f"),
    priceFrom: 20000,
    organizer: { name: "Watoto Church", avatar: img("photo-1531123897727-8f129e1688ce") },
    description: "An evening of praise with leading gospel artists from across Africa.",
  },
];

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

export const getEvent = (id: string) => EVENTS.find((e) => e.id === id);

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
