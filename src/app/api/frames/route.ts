import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - Fetch all frame items with images
export async function GET() {
  try {
    const { data: frameItems, error } = await supabase
      .from("frame_items")
      .select("*, temples(name, location), frame_images(*)")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching frame items:", error);
      return NextResponse.json(
        { error: "Failed to fetch frame items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ frameItems: frameItems || [] });
  } catch (error) {
    console.error("Error in GET /api/frames:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new frame item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { temple_id, name, material, price, size, quantity, in_stock, display_order } = body;

    // Validate required fields
    if (!temple_id || !name || price === undefined) {
      return NextResponse.json(
        { error: "Temple ID, name, and price are required" },
        { status: 400 }
      );
    }

    // If display_order is provided and conflicts with existing, reorder
    if (display_order) {
      const { data: existingItems } = await supabase
        .from("frame_items")
        .select("id, display_order")
        .gte("display_order", display_order)
        .order("display_order", { ascending: true });

      if (existingItems && existingItems.length > 0) {
        for (const item of existingItems) {
          await supabase
            .from("frame_items")
            .update({ display_order: item.display_order + 1 })
            .eq("id", item.id);
        }
      }
    }

    // Insert new frame item
    const { data: newFrame, error } = await supabase
      .from("frame_items")
      .insert({
        temple_id,
        name,
        material: material || null,
        price,
        size: size || null,
        quantity: quantity || 0,
        in_stock: in_stock ?? true,
        display_order: display_order || 1,
      })
      .select("*, temples(name, location)")
      .single();

    if (error) {
      console.error("Error creating frame:", error);
      return NextResponse.json(
        { error: "Failed to create frame item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ frame: newFrame }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/frames:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a frame item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, temple_id, name, material, price, size, quantity, image_url, in_stock, display_order } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Frame ID is required" },
        { status: 400 }
      );
    }

    // Get current frame data
    const { data: currentFrame } = await supabase
      .from("frame_items")
      .select("display_order")
      .eq("id", id)
      .single();

    // Handle display_order change
    if (currentFrame && display_order !== undefined && display_order !== currentFrame.display_order) {
      const oldOrder = currentFrame.display_order;
      const newOrder = display_order;

      if (newOrder < oldOrder) {
        const { data: itemsToShift } = await supabase
          .from("frame_items")
          .select("id, display_order")
          .gte("display_order", newOrder)
          .lt("display_order", oldOrder)
          .neq("id", id);

        if (itemsToShift) {
          for (const item of itemsToShift) {
            await supabase
              .from("frame_items")
              .update({ display_order: item.display_order + 1 })
              .eq("id", item.id);
          }
        }
      } else {
        const { data: itemsToShift } = await supabase
          .from("frame_items")
          .select("id, display_order")
          .gt("display_order", oldOrder)
          .lte("display_order", newOrder)
          .neq("id", id);

        if (itemsToShift) {
          for (const item of itemsToShift) {
            await supabase
              .from("frame_items")
              .update({ display_order: item.display_order - 1 })
              .eq("id", item.id);
          }
        }
      }
    }

    // Update frame item
    const { data: updatedFrame, error } = await supabase
      .from("frame_items")
      .update({
        temple_id,
        name,
        material,
        price,
        size,
        quantity,
        image_url,
        in_stock,
        display_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, temples(name, location), frame_images(*)")
      .single();

    if (error) {
      console.error("Error updating frame:", error);
      return NextResponse.json(
        { error: "Failed to update frame item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ frame: updatedFrame });
  } catch (error) {
    console.error("Error in PUT /api/frames:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a frame item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Frame ID is required" },
        { status: 400 }
      );
    }

    // Get the frame data before deleting (for display_order reordering and image deletion)
    const { data: frameToDelete } = await supabase
      .from("frame_items")
      .select("display_order, temples(name), name")
      .eq("id", id)
      .single();

    // Delete all images from storage
    const temples = frameToDelete?.temples as unknown as { name: string } | null;
    if (temples?.name && frameToDelete?.name) {
      const sanitizedTempleName = temples.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .trim();
      const sanitizedFrameName = frameToDelete.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .trim();

      // List and delete all files in the frame folder
      const { data: files } = await supabase.storage
        .from("brajmarg_frames_images")
        .list(`${sanitizedTempleName}/${sanitizedFrameName}`);

      if (files && files.length > 0) {
        const filePaths = files.map(
          (f) => `${sanitizedTempleName}/${sanitizedFrameName}/${f.name}`
        );
        await supabase.storage
          .from("brajmarg_frames_images")
          .remove(filePaths);
      }
    }

    // Delete the frame item (cascade will delete frame_images records)
    const { error } = await supabase
      .from("frame_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting frame:", error);
      return NextResponse.json(
        { error: "Failed to delete frame item" },
        { status: 500 }
      );
    }

    // Reorder remaining items to fill the gap
    if (frameToDelete) {
      const { data: itemsToShift } = await supabase
        .from("frame_items")
        .select("id, display_order")
        .gt("display_order", frameToDelete.display_order);

      if (itemsToShift) {
        for (const item of itemsToShift) {
          await supabase
            .from("frame_items")
            .update({ display_order: item.display_order - 1 })
            .eq("id", item.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/frames:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
