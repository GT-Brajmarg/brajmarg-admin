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

// Yatra Package type definition
export interface YatraPackage {
  id: string;
  vehicle_id: string;
  name: string;
  from_location: string;
  to_location: string;
  distance_km: number | null;
  duration_days: number | null;
  duration_nights: number | null;
  price: number | null;
  price_per_km: number | null;
  route_description: string | null;
  inclusions: string[];
  exclusions: string[];
  itinerary: string | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  vehicles?: Vehicle;
}
