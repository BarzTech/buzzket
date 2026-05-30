# 🎟️ Buzzket

**Uganda's Event Ticketing Platform** — a full-stack MVP for online event ticketing with WhatsApp-based ticket delivery via Twilio.

---

## Features

### Admin Dashboard
- Create & manage organiser accounts (login credentials issued by admin)
- Set per-organiser commission (percentage + fixed fee per ticket)
- Payment approval queue — review customer TID submissions and approve/reject
- Platform-wide sales overview and revenue tracking
- WhatsApp bot conversation preview/simulator

### Organiser Dashboard
- Create events with venue, date, time, and capacity
- Add unlimited ticket tiers (VIP, Regular, VVIP, Student, etc.) with custom prices and quantities
- Real-time sales tracker — gross revenue, commission deducted, net earnings
- QR code scanner for real-time check-in on event day

### WhatsApp Bot (Twilio)
- Customer browses events and selects ticket tier
- Bot sends Mobile Money payment instructions (MTN MoMo / Airtel Money)
- Customer submits Transaction ID (TID)
- Admin verifies and approves — bot automatically delivers QR ticket to customer on WhatsApp

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| UI Icons | Lucide React |
| WhatsApp Bot | Twilio WhatsApp Business API |
| Backend (planned) | Node.js + Express |
| Database (planned) | PostgreSQL (Neon or Railway) |
| Hosting | Vercel (frontend) + Railway (backend) |

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/buzzket.git
cd buzzket
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

### 4. Build for production
```bash
npm run build
```

---

## Demo Login Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@buzzket.ug | admin123 |
| Organiser | kampala@events.ug | pass123 |
| Organiser | nile@promo.ug | pass456 |

---

## Project Structure

```
buzzket/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx        # Full application (all components)
│   └── main.jsx       # React entry point
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## Roadmap

- [ ] Node.js + Express backend API
- [ ] PostgreSQL database with full schema
- [ ] Twilio WhatsApp bot integration
- [ ] MTN MoMo / Airtel Money TID verification
- [ ] QR code generation and image ticket delivery
- [ ] Camera-based QR scanning (html5-qrcode)
- [ ] Email notifications (Nodemailer)
- [ ] Organiser analytics charts

---

## License

MIT
