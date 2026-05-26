import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function validateEndsAt(startsAt: string, endsAt: string | null | undefined) {
  if (!endsAt) return null;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (end <= start) {
    return "End date must be after start date";
  }
  return null;
}

// GET - Fetch all alerts with optional temple info
export async function GET() {
  try {
    const { data: alerts, error } = await supabase
      .from("alerts")
      .select(
        `
        *,
        temples (
          name,
          location
        )
      `
      )
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching alerts:", error);
      return NextResponse.json(
        { error: "Failed to fetch alerts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Error in GET /api/alerts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new alert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      temple_id,
      alert_type,
      priority,
      title,
      description,
      starts_at,
      ends_at,
      image_url,
      cta_label,
      cta_url,
      display_order,
      is_active,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }
    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }
    if (!alert_type) {
      return NextResponse.json(
        { error: "Alert type is required" },
        { status: 400 }
      );
    }
    if (!starts_at) {
      return NextResponse.json(
        { error: "Start date is required" },
        { status: 400 }
      );
    }

    const endsAtError = validateEndsAt(starts_at, ends_at);
    if (endsAtError) {
      return NextResponse.json({ error: endsAtError }, { status: 400 });
    }

    const { data: alert, error } = await supabase
      .from("alerts")
      .insert({
        temple_id: temple_id || null,
        alert_type,
        priority: priority || "info",
        title: title.trim(),
        description: description.trim(),
        starts_at,
        ends_at: ends_at || null,
        image_url: image_url || null,
        cta_label: cta_label || null,
        cta_url: cta_url || null,
        is_active: is_active ?? true,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating alert:", error);
      return NextResponse.json(
        { error: "Failed to create alert" },
        { status: 500 }
      );
    }

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/alerts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update an alert
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      temple_id,
      alert_type,
      priority,
      title,
      description,
      starts_at,
      ends_at,
      image_url,
      cta_label,
      cta_url,
      display_order,
      is_active,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Alert ID is required" },
        { status: 400 }
      );
    }

    if (starts_at && ends_at) {
      const endsAtError = validateEndsAt(starts_at, ends_at);
      if (endsAtError) {
        return NextResponse.json({ error: endsAtError }, { status: 400 });
      }
    }

    const { data: alert, error } = await supabase
      .from("alerts")
      .update({
        temple_id: temple_id === undefined ? undefined : temple_id || null,
        alert_type,
        priority,
        title: title?.trim(),
        description: description?.trim(),
        starts_at,
        ends_at: ends_at === undefined ? undefined : ends_at || null,
        image_url,
        cta_label: cta_label || null,
        cta_url: cta_url || null,
        is_active,
        display_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating alert:", error);
      return NextResponse.json(
        { error: "Failed to update alert" },
        { status: 500 }
      );
    }

    return NextResponse.json({ alert });
  } catch (error) {
    console.error("Error in PUT /api/alerts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an alert
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Alert ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("alerts").delete().eq("id", id);

    if (error) {
      console.error("Error deleting alert:", error);
      return NextResponse.json(
        { error: "Failed to delete alert" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/alerts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
