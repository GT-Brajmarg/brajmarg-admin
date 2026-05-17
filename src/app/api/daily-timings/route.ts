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
      .order("day_of_week", { ascending: true })
      .order("opening_time", { ascending: true });

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

// POST - Create multiple daily timings (batch creation)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { temple_id, day_of_week, timings } = body;

    // Validate required fields
    if (!temple_id || day_of_week === undefined || !timings || !Array.isArray(timings) || timings.length === 0) {
      return NextResponse.json(
        { error: "Temple ID, day of week, and at least one timing are required" },
        { status: 400 }
      );
    }

    // Validate each timing has required fields
    for (const timing of timings) {
      if (!timing.label || !timing.opening_time || !timing.closing_time) {
        return NextResponse.json(
          { error: "Each timing must have label, opening_time, and closing_time" },
          { status: 400 }
        );
      }
    }

    // Check if timings already exist for this temple and day
    const { data: existingTimings } = await supabase
      .from("temple_timings")
      .select("id")
      .eq("temple_id", temple_id)
      .eq("day_of_week", day_of_week);

    if (existingTimings && existingTimings.length > 0) {
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day_of_week];
      return NextResponse.json(
        { error: `Timings for ${dayName} already exist for this temple. Please edit the existing entry.` },
        { status: 400 }
      );
    }

    // Prepare timings for insertion
    const timingsToInsert = timings.map((timing: { label: string; opening_time: string; closing_time: string; special_note?: string; is_active?: boolean }) => ({
      temple_id,
      day_of_week,
      label: timing.label,
      opening_time: timing.opening_time,
      closing_time: timing.closing_time,
      special_note: timing.special_note || "",
      is_active: timing.is_active ?? true,
    }));

    // Insert all timings
    const { data: newTimings, error } = await supabase
      .from("temple_timings")
      .insert(timingsToInsert)
      .select();

    if (error) {
      console.error("Error creating timings:", error);
      return NextResponse.json(
        { error: "Failed to create timings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ timings: newTimings }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/daily-timings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update timings for a temple+day (replaces all existing)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { temple_id, day_of_week, timings } = body;

    if (!temple_id || day_of_week === undefined) {
      return NextResponse.json(
        { error: "Temple ID and day of week are required" },
        { status: 400 }
      );
    }

    // Delete all existing timings for this temple+day
    const { error: deleteError } = await supabase
      .from("temple_timings")
      .delete()
      .eq("temple_id", temple_id)
      .eq("day_of_week", day_of_week);

    if (deleteError) {
      console.error("Error deleting existing timings:", deleteError);
      return NextResponse.json(
        { error: "Failed to update timings" },
        { status: 500 }
      );
    }

    // If no timings provided, just return success (all deleted)
    if (!timings || timings.length === 0) {
      return NextResponse.json({ timings: [], message: "All timings deleted" });
    }

    // Validate each timing has required fields
    for (const timing of timings) {
      if (!timing.label || !timing.opening_time || !timing.closing_time) {
        return NextResponse.json(
          { error: "Each timing must have label, opening_time, and closing_time" },
          { status: 400 }
        );
      }
    }

    // Prepare timings for insertion
    const timingsToInsert = timings.map((timing: { label: string; opening_time: string; closing_time: string; special_note?: string; is_active?: boolean }) => ({
      temple_id,
      day_of_week,
      label: timing.label,
      opening_time: timing.opening_time,
      closing_time: timing.closing_time,
      special_note: timing.special_note || "",
      is_active: timing.is_active ?? true,
    }));

    // Insert new timings
    const { data: newTimings, error: insertError } = await supabase
      .from("temple_timings")
      .insert(timingsToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting timings:", insertError);
      return NextResponse.json(
        { error: "Failed to update timings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ timings: newTimings });
  } catch (error) {
    console.error("Error in PUT /api/daily-timings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete all timings for a temple+day
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templeId = searchParams.get("temple_id");
    const dayOfWeek = searchParams.get("day_of_week");

    if (!templeId || dayOfWeek === null) {
      return NextResponse.json(
        { error: "Temple ID and day of week are required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("temple_timings")
      .delete()
      .eq("temple_id", templeId)
      .eq("day_of_week", parseInt(dayOfWeek));

    if (error) {
      console.error("Error deleting timings:", error);
      return NextResponse.json(
        { error: "Failed to delete timings" },
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
