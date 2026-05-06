import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - Fetch all vehicles
export async function GET() {
  try {
    const { data: vehicles, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching vehicles:", error);
      return NextResponse.json(
        { error: "Failed to fetch vehicles" },
        { status: 500 }
      );
    }

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Error in GET /api/vehicles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new vehicle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      vehicle_type,
      seating_capacity,
      is_ac,
      features,
      image_url,
      is_active,
      display_order,
    } = body;

    if (!name || !vehicle_type || !seating_capacity) {
      return NextResponse.json(
        { error: "name, vehicle_type, and seating_capacity are required" },
        { status: 400 }
      );
    }

    const { data: vehicle, error } = await supabase
      .from("vehicles")
      .insert({
        name,
        vehicle_type,
        seating_capacity,
        is_ac: is_ac ?? true,
        features: features || [],
        image_url: image_url || null,
        is_active: is_active ?? true,
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating vehicle:", error);
      return NextResponse.json(
        { error: "Failed to create vehicle" },
        { status: 500 }
      );
    }

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/vehicles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a vehicle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      vehicle_type,
      seating_capacity,
      is_ac,
      features,
      image_url,
      is_active,
      display_order,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Vehicle ID is required" },
        { status: 400 }
      );
    }

    const { data: vehicle, error } = await supabase
      .from("vehicles")
      .update({
        name,
        vehicle_type,
        seating_capacity,
        is_ac,
        features,
        image_url,
        is_active,
        display_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating vehicle:", error);
      return NextResponse.json(
        { error: "Failed to update vehicle" },
        { status: 500 }
      );
    }

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error("Error in PUT /api/vehicles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a vehicle
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Vehicle ID is required" },
        { status: 400 }
      );
    }

    // Get vehicle to delete its image from storage
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("image_url")
      .eq("id", id)
      .single();

    if (vehicle?.image_url) {
      // Extract path from URL and delete from storage
      const urlParts = vehicle.image_url.split("/brajmarg_vehicle_images/");
      if (urlParts[1]) {
        await supabase.storage
          .from("brajmarg_vehicle_images")
          .remove([urlParts[1]]);
      }
    }

    const { error } = await supabase.from("vehicles").delete().eq("id", id);

    if (error) {
      console.error("Error deleting vehicle:", error);
      return NextResponse.json(
        { error: "Failed to delete vehicle" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/vehicles:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
