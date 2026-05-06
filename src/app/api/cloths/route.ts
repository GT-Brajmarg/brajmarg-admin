import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - Fetch all cloth items with images
export async function GET() {
  try {
    const { data: clothItems, error } = await supabase
      .from("cloth_items")
      .select("*, temples(name, location), cloth_images(*)")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching cloth items:", error);
      return NextResponse.json(
        { error: "Failed to fetch cloth items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ clothItems: clothItems || [] });
  } catch (error) {
    console.error("Error in GET /api/cloths:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new cloth item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { temple_id, name, material, price, sizes, colors, quantity, in_stock, display_order } = body;

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
        .from("cloth_items")
        .select("id, display_order")
        .gte("display_order", display_order)
        .order("display_order", { ascending: true });

      if (existingItems && existingItems.length > 0) {
        for (const item of existingItems) {
          await supabase
            .from("cloth_items")
            .update({ display_order: item.display_order + 1 })
            .eq("id", item.id);
        }
      }
    }

    // Insert new cloth item
    const { data: newCloth, error } = await supabase
      .from("cloth_items")
      .insert({
        temple_id,
        name,
        material: material || null,
        price,
        sizes: sizes || [],
        colors: colors || [],
        quantity: quantity || 0,
        in_stock: in_stock ?? true,
        display_order: display_order || 1,
      })
      .select("*, temples(name, location)")
      .single();

    if (error) {
      console.error("Error creating cloth:", error);
      return NextResponse.json(
        { error: "Failed to create cloth item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ cloth: newCloth }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/cloths:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a cloth item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, temple_id, name, material, price, sizes, colors, quantity, image_url, in_stock, display_order } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Cloth ID is required" },
        { status: 400 }
      );
    }

    // Get current cloth data
    const { data: currentCloth } = await supabase
      .from("cloth_items")
      .select("display_order")
      .eq("id", id)
      .single();

    // Handle display_order change
    if (currentCloth && display_order !== undefined && display_order !== currentCloth.display_order) {
      const oldOrder = currentCloth.display_order;
      const newOrder = display_order;

      if (newOrder < oldOrder) {
        const { data: itemsToShift } = await supabase
          .from("cloth_items")
          .select("id, display_order")
          .gte("display_order", newOrder)
          .lt("display_order", oldOrder)
          .neq("id", id);

        if (itemsToShift) {
          for (const item of itemsToShift) {
            await supabase
              .from("cloth_items")
              .update({ display_order: item.display_order + 1 })
              .eq("id", item.id);
          }
        }
      } else {
        const { data: itemsToShift } = await supabase
          .from("cloth_items")
          .select("id, display_order")
          .gt("display_order", oldOrder)
          .lte("display_order", newOrder)
          .neq("id", id);

        if (itemsToShift) {
          for (const item of itemsToShift) {
            await supabase
              .from("cloth_items")
              .update({ display_order: item.display_order - 1 })
              .eq("id", item.id);
          }
        }
      }
    }

    // Update cloth item
    const { data: updatedCloth, error } = await supabase
      .from("cloth_items")
      .update({
        temple_id,
        name,
        material,
        price,
        sizes,
        colors,
        quantity,
        image_url,
        in_stock,
        display_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, temples(name, location), cloth_images(*)")
      .single();

    if (error) {
      console.error("Error updating cloth:", error);
      return NextResponse.json(
        { error: "Failed to update cloth item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ cloth: updatedCloth });
  } catch (error) {
    console.error("Error in PUT /api/cloths:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a cloth item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Cloth ID is required" },
        { status: 400 }
      );
    }

    // Get the cloth data before deleting (for display_order reordering and image deletion)
    const { data: clothToDelete } = await supabase
      .from("cloth_items")
      .select("display_order, temples(name), name")
      .eq("id", id)
      .single();

    // Delete all images from storage
    const temples = clothToDelete?.temples as unknown as { name: string } | null;
    if (temples?.name && clothToDelete?.name) {
      const sanitizedTempleName = temples.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .trim();
      const sanitizedClothName = clothToDelete.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .trim();

      // List and delete all files in the cloth folder
      const { data: files } = await supabase.storage
        .from("brajmarg_cloth_images")
        .list(`${sanitizedTempleName}/${sanitizedClothName}`);

      if (files && files.length > 0) {
        const filePaths = files.map(
          (f) => `${sanitizedTempleName}/${sanitizedClothName}/${f.name}`
        );
        await supabase.storage
          .from("brajmarg_cloth_images")
          .remove(filePaths);
      }
    }

    // Delete the cloth item (cascade will delete cloth_images records)
    const { error } = await supabase
      .from("cloth_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting cloth:", error);
      return NextResponse.json(
        { error: "Failed to delete cloth item" },
        { status: 500 }
      );
    }

    // Reorder remaining items to fill the gap
    if (clothToDelete) {
      const { data: itemsToShift } = await supabase
        .from("cloth_items")
        .select("id, display_order")
        .gt("display_order", clothToDelete.display_order);

      if (itemsToShift) {
        for (const item of itemsToShift) {
          await supabase
            .from("cloth_items")
            .update({ display_order: item.display_order - 1 })
            .eq("id", item.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/cloths:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
