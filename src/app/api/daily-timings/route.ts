import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - Fetch all daily timings (optionally filter by temple)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templeId = searchParams.get("temple_id");

    let query = supabase
      .from("temple_timings")
      .select("*, temples(name, location)")
      .order("day_of_week", { ascending: true });

    if (templeId) {
      query = query.eq("temple_id", templeId);
    }

    const { data: timings, error } = await query;

    if (error) {
      console.error("Error fetching timings:", error);
      return NextResponse.json(
        { error: "Failed to fetch timings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ timings: timings || [] });
  } catch (error) {
    console.error("Error in GET /api/daily-timings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new daily timing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { temple_id, day_of_week, opening_time, closing_time, label, special_note, is_active } = body;

    // Validate required fields
    if (!temple_id || day_of_week === undefined || !opening_time || !closing_time) {
      return NextResponse.json(
        { error: "Temple ID, day of week, opening time, and closing time are required" },
        { status: 400 }
      );
    }

    // Check if timing already exists for this temple and day
    const { data: existingTiming } = await supabase
      .from("temple_timings")
      .select("id")
      .eq("temple_id", temple_id)
      .eq("day_of_week", day_of_week)
      .single();

    if (existingTiming) {
      return NextResponse.json(
        { error: `Timing for ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day_of_week]} already exists` },
        { status: 400 }
      );
    }

    // Insert new timing
    const { data: newTiming, error } = await supabase
      .from("temple_timings")
      .insert({
        temple_id,
        day_of_week,
        opening_time,
        closing_time,
        label: label || "",
        special_note: special_note || "",
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating timing:", error);
      return NextResponse.json(
        { error: "Failed to create timing" },
        { status: 500 }
      );
    }

    return NextResponse.json({ timing: newTiming }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/daily-timings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a daily timing
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, day_of_week, opening_time, closing_time, label, special_note, is_active } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Timing ID is required" },
        { status: 400 }
      );
    }

    const { data: updatedTiming, error } = await supabase
      .from("temple_timings")
      .update({
        day_of_week,
        opening_time,
        closing_time,
        label,
        special_note,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating timing:", error);
      return NextResponse.json(
        { error: "Failed to update timing" },
        { status: 500 }
      );
    }

    return NextResponse.json({ timing: updatedTiming });
  } catch (error) {
    console.error("Error in PUT /api/daily-timings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a daily timing
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Timing ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("temple_timings")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting timing:", error);
      return NextResponse.json(
        { error: "Failed to delete timing" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/daily-timings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
