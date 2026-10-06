// Hand-written subset of the database schema. When a Supabase project is
// connected you can regenerate this with:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type OrderStatus = "pending" | "pending_payment" | "payment_submitted" | "paid" | "payment_approved" | "payment_rejected" | "cancelled" | "expired";
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
          transaction_id: string | null;
          merchant_code: string | null;
          payment_provider: string | null;
          rejection_reason: string | null;
          verified_by: string | null;
          verified_at: string | null;
          email_sent_at: string | null;
          email_error: string | null;
          sms_sent_at: string | null;
          sms_error: string | null;
          whatsapp_number: string | null;
          guest_status_token_hash: string | null;
          pdf_storage_path: string | null;
          ticket_generation_status: "pending" | "generated" | "failed";
          ticket_generation_error: string | null;
          whatsapp_delivery_status: "pending" | "sent" | "delivered" | "failed";
          whatsapp_message_sid: string | null;
          whatsapp_sent_at: string | null;
          whatsapp_delivery_error: string | null;
          whatsapp_retry_count: number;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [{ foreignKeyName: "orders_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] }];
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
        Relationships: [
          { foreignKeyName: "order_items_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] },
          { foreignKeyName: "order_items_tier_id_fkey"; columns: ["tier_id"]; isOneToOne: false; referencedRelation: "ticket_tiers"; referencedColumns: ["id"] },
        ];
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
      organizer_profiles: {
        Row: {
          user_id: string;
          display_name: string;
          bio: string;
          avatar_url: string;
          phone: string;
          website: string;
          payout_method: string;
          payout_account: string;
          approval_status: "pending" | "approved" | "rejected";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organizer_profiles"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizer_profiles"]["Row"]>;
        Relationships: [];
      };
      platform_settings: {
        Row: {
          id: number;
          maintenance_mode: boolean;
          refund_policy: string;
          sla_hours: number;
          email_template_subject: string;
          email_template_body: string;
          sms_template: string;
        };
        Insert: Partial<Database["public"]["Tables"]["platform_settings"]["Row"]> & {
          id: number;
        };
        Update: Partial<Database["public"]["Tables"]["platform_settings"]["Row"]>;
        Relationships: [];
      };
      payout_requests: {
        Row: { id: string; organizer_id: string; amount: number; status: "pending" | "approved" | "rejected" | "paid"; payment_method: string; payment_account: string; note: string; requested_at: string; resolved_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["payout_requests"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["payout_requests"]["Row"]>;
        Relationships: [];
      };
      organizer_follows: {
        Row: { organizer_id: string; follower_id: string; created_at: string };
        Insert: { organizer_id: string; follower_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["organizer_follows"]["Row"]>;
        Relationships: [];
      };
      payment_audit_logs: {
        Row: { id: string; order_id: string; admin_id: string | null; action: string; previous_status: string | null; new_status: string | null; transaction_id: string | null; rejection_reason: string | null; metadata: Record<string, unknown>; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["payment_audit_logs"]["Row"]> & { order_id: string; action: string };
        Update: Partial<Database["public"]["Tables"]["payment_audit_logs"]["Row"]>;
        Relationships: [];
      };
      ticket_download_tokens: {
        Row: { id: string; order_id: string; token_hash: string; created_at: string; expires_at: string | null; revoked_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["ticket_download_tokens"]["Row"]> & { order_id: string; token_hash: string };
        Update: Partial<Database["public"]["Tables"]["ticket_download_tokens"]["Row"]>;
        Relationships: [];
      };
      user_roles: {
        Row: { user_id: string; role: "admin" | "organizer"; created_at: string };
        Insert: { user_id: string; role: "admin" | "organizer"; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Row"]>;
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
      approve_order_and_mint_tickets: {
        Args: { p_order_id: string; p_admin_id: string };
        Returns: { order_id: string; qr_tokens: string[]; already_approved: boolean }[];
      };
      reject_order_and_release_inventory: {
        Args: { p_order_id: string; p_admin_id: string; p_rejection_reason: string };
        Returns: boolean;
      };
      submit_manual_payment: {
        Args: { p_reservation_id: string; p_contact_name: string; p_contact_email: string; p_whatsapp_number: string; p_payment_method: string; p_transaction_id: string; p_merchant_code: string; p_status_token: string; p_promo_code?: string | null };
        Returns: { order_id: string; status_token: string }[];
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
