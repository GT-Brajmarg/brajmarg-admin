import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Validate group-package-only fields. Returns an error string or null.
function validateGroupFields(body: {
  weekdays?: unknown;
  seats_total?: unknown;
  departure_time?: unknown;
}) {
  const weekdays = body.weekdays;
  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    return "Group packages require at least one recurring weekday";
  }
  if (!weekdays.every((d) => typeof d === "number" && d >= 0 && d <= 6)) {
    return "weekdays must be integers 0 (Sun) to 6 (Sat)";
  }
  const seats = Number(body.seats_total);
  if (!Number.isFinite(seats) || seats < 1) {
    return "Group packages require seats_total of at least 1";
  }
  if (!body.departure_time) {
    return "Group packages require a departure time";
  }
  return null;
}

// At least one payment method must be enabled (applies to both package types).
// Returns an error string or null. Treats undefined as "keep enabled".
function validatePayment(body: {
  allow_direct_payment?: unknown;
  allow_cod?: unknown;
}) {
  const direct = body.allow_direct_payment !== false;
  const cod = body.allow_cod !== false;
  if (!direct && !cod) {
    return "Select at least one payment method (Direct Payment or COD)";
  }
  return null;
}

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
      package_type,
      weekdays,
      departure_time,
      arrival_time,
      seats_total,
      allow_direct_payment,
      allow_cod,
    } = body;

    if (!vehicle_id || !name || !from_location || !to_location) {
      return NextResponse.json(
        { error: "vehicle_id, name, from_location, and to_location are required" },
        { status: 400 }
      );
    }

    // Type is set once, at creation. Anything other than "group" is treated as solo.
    const type = package_type === "group" ? "group" : "solo";
    if (type === "group") {
      const groupError = validateGroupFields(body);
      if (groupError) {
        return NextResponse.json({ error: groupError }, { status: 400 });
      }
    }

    const paymentError = validatePayment(body);
    if (paymentError) {
      return NextResponse.json({ error: paymentError }, { status: 400 });
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
        package_type: type,
        // Group-only fields; null/empty for solo so the two types never collide.
        weekdays: type === "group" ? weekdays : [],
        departure_time: type === "group" ? departure_time : null,
        arrival_time: type === "group" ? arrival_time || null : null,
        seats_total: type === "group" ? seats_total : null,
        // Payment options apply to both types; default to enabled.
        allow_direct_payment: allow_direct_payment ?? true,
        allow_cod: allow_cod ?? true,
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
      weekdays,
      departure_time,
      arrival_time,
      seats_total,
      allow_direct_payment,
      allow_cod,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Yatra package ID is required" },
        { status: 400 }
      );
    }

    // Package type is immutable. Read the existing type from the row and write it
    // back — any package_type in the request body is intentionally ignored, so a
    // solo package can never become a group package (or vice versa) via edit.
    const { data: existing, error: existingError } = await supabase
      .from("yatra_packages")
      .select("package_type")
      .eq("id", id)
      .single();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Yatra package not found" },
        { status: 404 }
      );
    }
    const type = existing.package_type === "group" ? "group" : "solo";

    if (type === "group") {
      const groupError = validateGroupFields(body);
      if (groupError) {
        return NextResponse.json({ error: groupError }, { status: 400 });
      }
    }

    const paymentError = validatePayment(body);
    if (paymentError) {
      return NextResponse.json({ error: paymentError }, { status: 400 });
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
        // package_type deliberately omitted — never updated.
        weekdays: type === "group" ? weekdays : [],
        departure_time: type === "group" ? departure_time : null,
        arrival_time: type === "group" ? arrival_time || null : null,
        seats_total: type === "group" ? seats_total : null,
        allow_direct_payment: allow_direct_payment ?? true,
        allow_cod: allow_cod ?? true,
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
