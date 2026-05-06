import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - Fetch all yatra packages with vehicle info
export async function GET() {
  try {
    const { data: yatraPackages, error } = await supabase
      .from("yatra_packages")
      .select(
        `
        *,
        vehicles (
          id,
          name,
          vehicle_type,
          seating_capacity,
          is_ac
        )
      `
      )
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching yatra packages:", error);
      return NextResponse.json(
        { error: "Failed to fetch yatra packages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ yatraPackages });
  } catch (error) {
    console.error("Error in GET /api/yatra:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new yatra package
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      vehicle_id,
      name,
      from_location,
      to_location,
      distance_km,
      duration_days,
      duration_nights,
      price,
      price_per_km,
      route_description,
      inclusions,
      exclusions,
      itinerary,
      image_url,
      is_active,
      display_order,
    } = body;

    if (!vehicle_id || !name || !from_location || !to_location) {
      return NextResponse.json(
        { error: "vehicle_id, name, from_location, and to_location are required" },
        { status: 400 }
      );
    }

    const { data: yatraPackage, error } = await supabase
      .from("yatra_packages")
      .insert({
        vehicle_id,
        name,
        from_location,
        to_location,
        distance_km: distance_km || null,
        duration_days: duration_days || null,
        duration_nights: duration_nights || null,
        price: price || null,
        price_per_km: price_per_km || null,
        route_description: route_description || null,
        inclusions: inclusions || [],
        exclusions: exclusions || [],
        itinerary: itinerary || null,
        image_url: image_url || null,
        is_active: is_active ?? true,
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating yatra package:", error);
      return NextResponse.json(
        { error: "Failed to create yatra package" },
        { status: 500 }
      );
    }

    return NextResponse.json({ yatraPackage }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/yatra:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a yatra package
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      vehicle_id,
      name,
      from_location,
      to_location,
      distance_km,
      duration_days,
      duration_nights,
      price,
      price_per_km,
      route_description,
      inclusions,
      exclusions,
      itinerary,
      image_url,
      is_active,
      display_order,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Yatra package ID is required" },
        { status: 400 }
      );
    }

    const { data: yatraPackage, error } = await supabase
      .from("yatra_packages")
      .update({
        vehicle_id,
        name,
        from_location,
        to_location,
        distance_km,
        duration_days,
        duration_nights,
        price,
        price_per_km,
        route_description,
        inclusions,
        exclusions,
        itinerary,
        image_url,
        is_active,
        display_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating yatra package:", error);
      return NextResponse.json(
        { error: "Failed to update yatra package" },
        { status: 500 }
      );
    }

    return NextResponse.json({ yatraPackage });
  } catch (error) {
    console.error("Error in PUT /api/yatra:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a yatra package
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Yatra package ID is required" },
        { status: 400 }
      );
    }

    // Get package to delete its image from storage
    const { data: yatraPackage } = await supabase
      .from("yatra_packages")
      .select("image_url")
      .eq("id", id)
      .single();

    if (yatraPackage?.image_url) {
      const urlParts = yatraPackage.image_url.split("/brajmarg_yatra_images/");
      if (urlParts[1]) {
        await supabase.storage
          .from("brajmarg_yatra_images")
          .remove([urlParts[1]]);
      }
    }

    const { error } = await supabase
      .from("yatra_packages")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting yatra package:", error);
      return NextResponse.json(
        { error: "Failed to delete yatra package" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/yatra:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
