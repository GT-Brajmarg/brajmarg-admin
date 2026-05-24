import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin type definition
export interface Admin {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// Temple type definition
export interface Temple {
  id: string;
  name: string;
  location: string;
  description: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
  is_coming_soon: boolean;
  created_at: string;
  updated_at: string;
}

// Daily Timing type definition (temple_timings table)
export interface DailyTiming {
  id: string;
  temple_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  opening_time: string; // HH:mm format
  closing_time: string; // HH:mm format
  label: string;
  special_note: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Prasad Item type definition
export interface PrasadItem {
  id: string;
  temple_id: string;
  name: string;
  price: number;
  quantity: number;
  ingredients: string | null;
  image_url: string | null; // Primary image URL
  in_stock: boolean;
  display_order: number;
  allow_direct_payment: boolean;
  allow_cod: boolean;
  created_at: string;
  updated_at: string;
  temples?: {
    name: string;
    location: string;
  };
  prasad_images?: PrasadImage[];
}

// Prasad Image type definition
export interface PrasadImage {
  id: string;
  prasad_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

// Seva Item type definition
export interface SevaItem {
  id: string;
  temple_id: string;
  name: string;
  price: number;
  time: string | null;
  details: string | null;
  significance: string | null;
  is_active: boolean;
  display_order: number;
  // Payment methods the storefront should offer for this item (admin-configured).
  allow_direct_payment: boolean;
  allow_cod: boolean;
  created_at: string;
  updated_at: string;
  temples?: {
    name: string;
    location: string;
  };
}

// Frame Item type definition
export interface FrameItem {
  id: string;
  temple_id: string;
  name: string;
  material: string | null;
  price: number;
  size: string | null;
  quantity: number;
  image_url: string | null;
  in_stock: boolean;
  display_order: number;
  allow_direct_payment: boolean;
  allow_cod: boolean;
  created_at: string;
  updated_at: string;
  temples?: {
    name: string;
    location: string;
  };
  frame_images?: FrameImage[];
}

// Frame Image type definition
export interface FrameImage {
  id: string;
  frame_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

// Cloth Item type definition
export interface ClothItem {
  id: string;
  temple_id: string;
  name: string;
  material: string | null;
  price: number;
  sizes: string[];
  colors: string[];
  quantity: number;
  image_url: string | null;
  in_stock: boolean;
  display_order: number;
  allow_direct_payment: boolean;
  allow_cod: boolean;
  created_at: string;
  updated_at: string;
  temples?: {
    name: string;
    location: string;
  };
  cloth_images?: ClothImage[];
}

// Cloth Image type definition
export interface ClothImage {
  id: string;
  cloth_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

// Vehicle type definition
export interface Vehicle {
  id: string;
  name: string;
  vehicle_type: string;
  seating_capacity: number;
  is_ac: boolean;
  features: string[];
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Alert type definition
export type AlertType =
  | "festival"
  | "special_darshan"
  | "closure"
  | "timing_change"
  | "general";

export type AlertPriority = "info" | "important" | "urgent";

export interface Alert {
  id: string;
  temple_id: string | null;
  alert_type: AlertType;
  priority: AlertPriority;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  temples?: {
    name: string;
    location: string;
  } | null;
}

// Yatra Package type definition
// "solo" = full private vehicle, available any day, single price.
// "group" = seat-based shared yatra with a recurring weekly schedule.
export type PackageType = "solo" | "group";

export interface YatraPackage {
  id: string;
  vehicle_id: string;
  name: string;
  from_location: string;
  to_location: string;
  distance_km: number | null;
  duration_days: number | null;
  duration_nights: number | null;
  // For solo: full vehicle price. For group: price per seat.
  price: number | null;
  price_per_km: number | null;
  route_description: string | null;
  inclusions: string[];
  exclusions: string[];
  itinerary: string | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  // Type is immutable after creation (enforced in the API).
  package_type: PackageType;
  // Group-only fields (null/empty for solo). weekdays: 0=Sun .. 6=Sat.
  weekdays: number[];
  departure_time: string | null; // "HH:MM"
  arrival_time: string | null; // "HH:MM"
  seats_total: number | null; // seats per recurring week
  // Payment options shown to users (both package types); at least one is true.
  allow_direct_payment: boolean;
  allow_cod: boolean;
  created_at: string;
  updated_at: string;
  vehicles?: Vehicle;
}

// ----- Orders / Bookings -----
// Orders are created by the customer-facing storefront; this admin panel reads
// them and can update status / payment_status (e.g. cancel a booking).

export type OrderStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type OrderPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cod_pending";

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string; // references the product/package id
  item_type: string; // e.g. "yatra" (see ITEM_TYPE_YATRA in /api/bookings)
  quantity: number;
  created_at: string;
  // Joined yatra package details (populated for yatra bookings).
  yatra_package?: YatraPackage | null;
}

export interface Order {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  payment_method: string | null; // "direct" | "cod" (storefront-defined)
  payment_status: OrderPaymentStatus;
  total_amount: number | null;
  user_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}
