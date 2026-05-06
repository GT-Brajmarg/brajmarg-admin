import { NextRequest, NextResponse } from "next/server";
import { supabase, Temple } from "@/lib/supabase";

// GET - Fetch all temples
export async function GET() {
  try {
    const { data: temples, error } = await supabase
      .from("temples")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching temples:", error);
      return NextResponse.json(
        { error: "Failed to fetch temples" },
        { status: 500 }
      );
    }

    return NextResponse.json({ temples: temples || [] });
  } catch (error) {
    console.error("Error in GET /api/temples:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new temple
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, location, description, image_url, display_order, is_active, is_coming_soon } = body;

    // Validate required fields
    if (!name || !location) {
      return NextResponse.json(
        { error: "Name and location are required" },
        { status: 400 }
      );
    }

    // If display_order is provided and conflicts with existing, reorder
    if (display_order) {
      // Get all temples with display_order >= the new one
      const { data: existingTemples } = await supabase
        .from("temples")
        .select("id, display_order")
        .gte("display_order", display_order)
        .order("display_order", { ascending: true });

      // Shift their display_order by 1
      if (existingTemples && existingTemples.length > 0) {
        for (const temple of existingTemples) {
          await supabase
            .from("temples")
            .update({ display_order: temple.display_order + 1 })
            .eq("id", temple.id);
        }
      }
    }

    // Insert new temple
    const { data: newTemple, error } = await supabase
      .from("temples")
      .insert({
        name,
        location,
        description: description || "",
        image_url: image_url || "",
        display_order: display_order || 1,
        is_active: is_active ?? true,
        is_coming_soon: is_coming_soon ?? false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating temple:", error);
      return NextResponse.json(
        { error: "Failed to create temple" },
        { status: 500 }
      );
    }

    return NextResponse.json({ temple: newTemple }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/temples:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a temple
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, location, description, image_url, display_order, is_active, is_coming_soon } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Temple ID is required" },
        { status: 400 }
      );
    }

    // Get current temple data
    const { data: currentTemple } = await supabase
      .from("temples")
      .select("display_order")
      .eq("id", id)
      .single();

    // Handle display_order change
    if (currentTemple && display_order !== undefined && display_order !== currentTemple.display_order) {
      const oldOrder = currentTemple.display_order;
      const newOrder = display_order;

      if (newOrder < oldOrder) {
        // Moving up: shift temples between newOrder and oldOrder-1 down by 1
        await supabase
          .from("temples")
          .update({ display_order: supabase.rpc("increment_display_order") })
          .gte("display_order", newOrder)
          .lt("display_order", oldOrder)
          .neq("id", id);
        
        // Manual update since RPC might not be available
        const { data: templesToShift } = await supabase
          .from("temples")
          .select("id, display_order")
          .gte("display_order", newOrder)
          .lt("display_order", oldOrder)
          .neq("id", id);

        if (templesToShift) {
          for (const temple of templesToShift) {
            await supabase
              .from("temples")
              .update({ display_order: temple.display_order + 1 })
              .eq("id", temple.id);
          }
        }
      } else {
        // Moving down: shift temples between oldOrder+1 and newOrder up by 1
        const { data: templesToShift } = await supabase
          .from("temples")
          .select("id, display_order")
          .gt("display_order", oldOrder)
          .lte("display_order", newOrder)
          .neq("id", id);

        if (templesToShift) {
          for (const temple of templesToShift) {
            await supabase
              .from("temples")
              .update({ display_order: temple.display_order - 1 })
              .eq("id", temple.id);
          }
        }
      }
    }

    // Update temple
    const { data: updatedTemple, error } = await supabase
      .from("temples")
      .update({
        name,
        location,
        description,
        image_url,
        display_order,
        is_active,
        is_coming_soon,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating temple:", error);
      return NextResponse.json(
        { error: "Failed to update temple" },
        { status: 500 }
      );
    }

    return NextResponse.json({ temple: updatedTemple });
  } catch (error) {
    console.error("Error in PUT /api/temples:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a temple
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Temple ID is required" },
        { status: 400 }
      );
    }

    // Get the temple data before deleting (for display_order reordering and image deletion)
    const { data: templeToDelete } = await supabase
      .from("temples")
      .select("display_order, image_url")
      .eq("id", id)
      .single();

    // Delete the temple's image from storage if it exists
    if (templeToDelete?.image_url && templeToDelete.image_url.includes("brajmarg_temple_images")) {
      // Extract path: everything after "brajmarg_temple_images/" (excluding query params)
      const pathMatch = templeToDelete.image_url.match(/brajmarg_temple_images\/([^?]+)/);
      if (pathMatch) {
        const storagePath = pathMatch[1];
        await supabase.storage
          .from("brajmarg_temple_images")
          .remove([storagePath]);
      }
    }

    // Delete the temple
    const { error } = await supabase
      .from("temples")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting temple:", error);
      return NextResponse.json(
        { error: "Failed to delete temple" },
        { status: 500 }
      );
    }

    // Reorder remaining temples to fill the gap
    if (templeToDelete) {
      const { data: templesToShift } = await supabase
        .from("temples")
        .select("id, display_order")
        .gt("display_order", templeToDelete.display_order);

      if (templesToShift) {
        for (const temple of templesToShift) {
          await supabase
            .from("temples")
            .update({ display_order: temple.display_order - 1 })
            .eq("id", temple.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/temples:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
