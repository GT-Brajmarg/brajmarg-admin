import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - Fetch all seva items with temple info
export async function GET() {
  try {
    const { data: sevaItems, error } = await supabase
      .from("seva_items")
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
      console.error("Error fetching seva items:", error);
      return NextResponse.json(
        { error: "Failed to fetch seva items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ sevaItems });
  } catch (error) {
    console.error("Error in GET /api/seva:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new seva item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      temple_id,
      name,
      price,
      time,
      details,
      significance,
      is_active,
      display_order,
    } = body;

    if (!temple_id || !name || price === undefined) {
      return NextResponse.json(
        { error: "temple_id, name, and price are required" },
        { status: 400 }
      );
    }

    // If display_order conflicts, shift others
    if (display_order) {
      await supabase.rpc("increment_seva_display_order", {
        p_display_order: display_order,
      });
    }

    const { data: seva, error } = await supabase
      .from("seva_items")
      .insert({
        temple_id,
        name,
        price,
        time: time || null,
        details: details || null,
        significance: significance || null,
        is_active: is_active ?? true,
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating seva item:", error);
      return NextResponse.json(
        { error: "Failed to create seva item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ seva }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/seva:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a seva item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      temple_id,
      name,
      price,
      time,
      details,
      significance,
      is_active,
      display_order,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Seva item ID is required" },
        { status: 400 }
      );
    }

    // Get current display order
    const { data: currentSeva } = await supabase
      .from("seva_items")
      .select("display_order")
      .eq("id", id)
      .single();

    // Handle display order change
    if (
      currentSeva &&
      display_order !== undefined &&
      display_order !== currentSeva.display_order
    ) {
      const oldOrder = currentSeva.display_order;
      const newOrder = display_order;

      if (newOrder > oldOrder) {
        // Moving down: decrease order of items between old and new position
        await supabase
          .from("seva_items")
          .update({ display_order: supabase.rpc("decrement", { x: 1 }) })
          .gt("display_order", oldOrder)
          .lte("display_order", newOrder);
      } else {
        // Moving up: increase order of items between new and old position
        await supabase
          .from("seva_items")
          .update({ display_order: supabase.rpc("increment", { x: 1 }) })
          .gte("display_order", newOrder)
          .lt("display_order", oldOrder);
      }
    }

    const { data: seva, error } = await supabase
      .from("seva_items")
      .update({
        temple_id,
        name,
        price,
        time: time || null,
        details: details || null,
        significance: significance || null,
        is_active,
        display_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating seva item:", error);
      return NextResponse.json(
        { error: "Failed to update seva item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ seva });
  } catch (error) {
    console.error("Error in PUT /api/seva:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a seva item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Seva item ID is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("seva_items").delete().eq("id", id);

    if (error) {
      console.error("Error deleting seva item:", error);
      return NextResponse.json(
        { error: "Failed to delete seva item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/seva:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
