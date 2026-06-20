// Hand-written subset of the database schema. When a Supabase project is
// connected you can regenerate this with:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type OrderStatus = "pending" | "paid" | "cancelled" | "expired";
export type ReservationStatus = "active" | "confirmed" | "expired" | "cancelled";
export type TicketStatus = "valid" | "used" | "void";

export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          title: string;
          category: string;
          date: string;
          venue: string;
          city: string;
          image: string;
          price_from: number;
          organizer_name: string;
          organizer_avatar: string;
          description: string;
          featured: boolean;
          organizer_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["events"]["Row"]> & {
          id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Row"]>;
        Relationships: [];
      };
      ticket_tiers: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          price: number;
          quantity_total: number;
          quantity_sold: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ticket_tiers"]["Row"]> & {
          event_id: string;
          name: string;
          price: number;
          quantity_total: number;
        };
        Update: Partial<Database["public"]["Tables"]["ticket_tiers"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "ticket_tiers_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_tiers_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "tier_availability";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          event_id: string;
          user_id: string | null;
          status: OrderStatus;
          contact_name: string;
          contact_email: string;
          contact_phone: string;
          payment_method: string;
          subtotal: number;
          fees: number;
          total: number;
          created_at: string;
          paid_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          tier_id: string;
          quantity: number;
          unit_price: number;
        };
        Insert: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["order_items"]["Row"]>;
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          order_id: string;
          tier_id: string;
          qr_token: string;
          holder_name: string;
          status: TicketStatus;
          created_at: string;
          used_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["tickets"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["tickets"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "tickets_tier_id_fkey";
            columns: ["tier_id"];
            isOneToOne: false;
            referencedRelation: "ticket_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      reservations: {
        Row: {
          id: string;
          tier_id: string;
          order_id: string | null;
          quantity: number;
          status: ReservationStatus;
          expires_at: string;
          created_at: string;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          unit_price: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["reservations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["reservations"]["Row"]>;
        Relationships: [];
      };
      promo_codes: {
        Row: {
          id: string;
          event_id: string;
          organizer_id: string | null;
          code: string;
          type: "percent" | "flat";
          value: number;
          max_uses: number | null;
          used_count: number;
          active: boolean;
          expires_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["promo_codes"]["Row"]> & {
          event_id: string;
          code: string;
          type: "percent" | "flat";
          value: number;
        };
        Update: Partial<Database["public"]["Tables"]["promo_codes"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      tier_availability: {
        Row: {
          id: string;
          event_id: string;
          quantity_total: number;
          quantity_sold: number;
          available: number;
        };
        Relationships: [
          {
            foreignKeyName: "tier_availability_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "ticket_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
    Functions: {
      reserve_tickets: {
        Args: { p_tier_id: string; p_qty: number };
        Returns: {
          reservation_id: string;
          tier_id: string;
          quantity: number;
          expires_at: string;
        }[];
      };
      confirm_reservation: {
        Args: {
          p_reservation_id: string;
          p_contact_name: string;
          p_contact_email: string;
          p_contact_phone: string;
          p_payment_method: string;
          p_unit_price: number;
        };
        Returns: {
          order_id: string;
          qr_tokens: string[];
        }[];
      };
      dashboard_stats: {
        Args: {
          p_organizer_id?: string | null;
        };
        Returns: {
          total_sales: number;
          tickets_sold: number;
          total_events: number;
          attendees: number;
          platform_commission: number;
          organizer_payout: number;
        }[];
      };
      check_in_ticket: {
        Args: { p_token: string };
        Returns: {
          status: string;
          holder: string | null;
          event_id: string | null;
        }[];
      };
    };
  };
};
