npx supabase link --project-ref <your-project-ref>
-- Seed data: 8 launch events + 3 tiers each. Mirrors src/lib/seed.ts.
-- Idempotent-ish: clears catalog tables first. Safe to re-run in dev.
truncate table public.reservations, public.order_items, public.tickets, public.orders, public.ticket_tiers, public.events restart identity cascade;

insert into public.events (id,title,category,date,venue,city,image,price_from,organizer_name,organizer_avatar,description,featured) values
  ('blankets-wine-kampala','Blankets & Wine Kampala','Music','2026-07-12T16:00:00','Lugogo Cricket Oval','Kampala','https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=70',75000,'Swangz Avenue','https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=70','An afternoon of soulful live music, curated food and the best of East African creativity. Bring a blanket, bring a friend.',true),
  ('nyege-nyege-2026','Nyege Nyege Festival 2026','Festival','2026-09-10T12:00:00','Itanda Falls','Jinja','https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=70',250000,'Nyege Nyege Tapes','https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=1200&q=70','Four days, four stages, hundreds of artists from across the continent on the banks of the Nile.',true),
  ('kla-tech-summit','Kampala Tech Summit','Conference','2026-08-22T09:00:00','Kampala Serena Hotel','Kampala','https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=70',120000,'Innovation Village','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=70','The largest gathering of founders, engineers and investors in East Africa. Two days of talks, demos and deals.',true),
  ('comedy-store-uganda','Comedy Store Uganda — Anniversary','Comedy','2026-07-25T20:00:00','UMA Multipurpose Hall','Kampala','https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&w=1200&q=70',40000,'Alex Muhangi','https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=1200&q=70','Uganda''s biggest comedians under one roof for one unforgettable night.',false),
  ('afro-food-festival','Afro Food & Wine Festival','Food','2026-08-02T11:00:00','Sheraton Gardens','Kampala','https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=70',50000,'Taste Uganda','https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=1200&q=70','Sample dishes from 40+ chefs, pair with local wines, watch live cooking demos.',false),
  ('marathon-2026','MTN Kampala Marathon','Sports','2026-11-15T06:00:00','Kololo Independence Grounds','Kampala','https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=1200&q=70',30000,'MTN Uganda','https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=1200&q=70','Run for a cause across 5km, 10km, 21km and 42km categories.',false),
  ('fashion-week-ug','Kampala Fashion Week','Fashion','2026-10-04T18:00:00','Kampala Sheraton','Kampala','https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=70',90000,'KFW Council','https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1200&q=70','East Africa''s leading designers showcase their newest collections.',false),
  ('gospel-night','Worship Night Uganda','Music','2026-09-28T17:00:00','Namboole Stadium','Kampala','https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=70',20000,'Watoto Church','https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1200&q=70','An evening of praise with leading gospel artists from across Africa.',false),
  ('roast-rhyme-kampala','Roast & Rhyme Kampala','Music','2026-08-30T14:00:00','Jahazi Pier','Kampala','https://images.unsplash.com/photo-1589723226346-757c0d096b42?auto=format&fit=crop&w=1200&q=70',60000,'Swangz Avenue','https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=70','A perfect blend of live music, BBQ, and good vibes on the shores of Lake Victoria. The best of Ugandan soul and acoustic artists.',false);

insert into public.ticket_tiers (event_id,name,price,quantity_total) values
  ('blankets-wine-kampala','Early Bird',52500,100),
  ('blankets-wine-kampala','Regular',75000,400),
  ('blankets-wine-kampala','VIP',187500,50),
  ('nyege-nyege-2026','Early Bird',175000,100),
  ('nyege-nyege-2026','Regular',250000,400),
  ('nyege-nyege-2026','VIP',625000,50),
  ('kla-tech-summit','Early Bird',84000,100),
  ('kla-tech-summit','Regular',120000,400),
  ('kla-tech-summit','VIP',300000,50),
  ('comedy-store-uganda','Early Bird',28000,100),
  ('comedy-store-uganda','Regular',40000,400),
  ('comedy-store-uganda','VIP',100000,50),
  ('afro-food-festival','Early Bird',35000,100),
  ('afro-food-festival','Regular',50000,400),
  ('afro-food-festival','VIP',125000,50),
  ('marathon-2026','Early Bird',21000,100),
  ('marathon-2026','Regular',30000,400),
  ('marathon-2026','VIP',75000,50),
  ('fashion-week-ug','Early Bird',63000,100),
  ('fashion-week-ug','Regular',90000,400),
  ('fashion-week-ug','VIP',225000,50),
  ('gospel-night','Early Bird',14000,100),
  ('gospel-night','Regular',20000,400),
  ('gospel-night','VIP',50000,50),
  ('roast-rhyme-kampala','Early Bird',42000,100),
  ('roast-rhyme-kampala','Regular',60000,400),
  ('roast-rhyme-kampala','VIP',150000,50);
