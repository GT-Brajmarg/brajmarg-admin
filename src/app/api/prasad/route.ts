import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// At least one payment method must be enabled.
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

// GET - Fetch all prasad items with images
export async function GET() {
  try {
    const { data: prasadItems, error } = await supabase
      .from("prasad_items")
      .select("*, temples(name, location), prasad_images(*)")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching prasad items:", error);
      return NextResponse.json(
        { error: "Failed to fetch prasad items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ prasadItems: prasadItems || [] });
  } catch (error) {
    console.error("Error in GET /api/prasad:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new prasad item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { temple_id, name, price, quantity, ingredients, in_stock, display_order, allow_direct_payment, allow_cod } = body;

    // Validate required fields
    if (!temple_id || !name || price === undefined) {
      return NextResponse.json(
        { error: "Temple ID, name, and price are required" },
        { status: 400 }
      );
    }

    const paymentError = validatePayment(body);
    if (paymentError) {
      return NextResponse.json({ error: paymentError }, { status: 400 });
    }

    // If display_order is provided and conflicts with existing, reorder
    if (display_order) {
      const { data: existingItems } = await supabase
        .from("prasad_items")
        .select("id, display_order")
        .gte("display_order", display_order)
        .order("display_order", { ascending: true });

      if (existingItems && existingItems.length > 0) {
        for (const item of existingItems) {
          await supabase
            .from("prasad_items")
            .update({ display_order: item.display_order + 1 })
            .eq("id", item.id);
        }
      }
    }

    // Insert new prasad item
    const { data: newPrasad, error } = await supabase
      .from("prasad_items")
      .insert({
        temple_id,
        name,
        price,
        quantity: quantity || 0,
        ingredients: ingredients || null,
        in_stock: in_stock ?? true,
        display_order: display_order || 1,
        allow_direct_payment: allow_direct_payment ?? true,
        allow_cod: allow_cod ?? true,
      })
      .select("*, temples(name, location)")
      .single();

    if (error) {
      console.error("Error creating prasad:", error);
      return NextResponse.json(
        { error: "Failed to create prasad item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ prasad: newPrasad }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/prasad:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a prasad item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, temple_id, name, price, quantity, ingredients, image_url, in_stock, display_order, allow_direct_payment, allow_cod } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Prasad ID is required" },
        { status: 400 }
      );
    }

    const paymentError = validatePayment(body);
    if (paymentError) {
      return NextResponse.json({ error: paymentError }, { status: 400 });
    }

    // Get current prasad data
    const { data: currentPrasad } = await supabase
      .from("prasad_items")
      .select("display_order")
      .eq("id", id)
      .single();

    // Handle display_order change
    if (currentPrasad && display_order !== undefined && display_order !== currentPrasad.display_order) {
      const oldOrder = currentPrasad.display_order;
      const newOrder = display_order;

      if (newOrder < oldOrder) {
        const { data: itemsToShift } = await supabase
          .from("prasad_items")
          .select("id, display_order")
          .gte("display_order", newOrder)
          .lt("display_order", oldOrder)
          .neq("id", id);

        if (itemsToShift) {
          for (const item of itemsToShift) {
            await supabase
              .from("prasad_items")
              .update({ display_order: item.display_order + 1 })
              .eq("id", item.id);
          }
        }
      } else {
        const { data: itemsToShift } = await supabase
          .from("prasad_items")
          .select("id, display_order")
          .gt("display_order", oldOrder)
          .lte("display_order", newOrder)
          .neq("id", id);

        if (itemsToShift) {
          for (const item of itemsToShift) {
            await supabase
              .from("prasad_items")
              .update({ display_order: item.display_order - 1 })
              .eq("id", item.id);
          }
        }
      }
    }

    // Update prasad item
    const { data: updatedPrasad, error } = await supabase
      .from("prasad_items")
      .update({
        temple_id,
        name,
        price,
        quantity,
        ingredients,
        image_url,
        in_stock,
        display_order,
        allow_direct_payment: allow_direct_payment ?? true,
        allow_cod: allow_cod ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, temples(name, location), prasad_images(*)")
      .single();

    if (error) {
      console.error("Error updating prasad:", error);
      return NextResponse.json(
        { error: "Failed to update prasad item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ prasad: updatedPrasad });
  } catch (error) {
    console.error("Error in PUT /api/prasad:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a prasad item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Prasad ID is required" },
        { status: 400 }
      );
    }

    // Get the prasad data before deleting (for display_order reordering and image deletion)
    const { data: prasadToDelete } = await supabase
      .from("prasad_items")
      .select("display_order, temples(name), name")
      .eq("id", id)
      .single();

    // Delete all images from storage
    const temples = prasadToDelete?.temples as unknown as { name: string } | null;
    if (temples?.name && prasadToDelete?.name) {
      const sanitizedTempleName = temples.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .trim();
      const sanitizedPrasadName = prasadToDelete.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_")
        .trim();

      // List and delete all files in the prasad folder
      const { data: files } = await supabase.storage
        .from("brajmarg_prasad_images")
        .list(`${sanitizedTempleName}/${sanitizedPrasadName}`);

      if (files && files.length > 0) {
        const filePaths = files.map(
          (f) => `${sanitizedTempleName}/${sanitizedPrasadName}/${f.name}`
        );
        await supabase.storage
          .from("brajmarg_prasad_images")
          .remove(filePaths);
      }
    }

    // Delete the prasad item (cascade will delete prasad_images records)
    const { error } = await supabase
      .from("prasad_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting prasad:", error);
      return NextResponse.json(
        { error: "Failed to delete prasad item" },
        { status: 500 }
      );
    }

    // Reorder remaining items to fill the gap
    if (prasadToDelete) {
      const { data: itemsToShift } = await supabase
        .from("prasad_items")
        .select("id, display_order")
        .gt("display_order", prasadToDelete.display_order);

      if (itemsToShift) {
        for (const item of itemsToShift) {
          await supabase
            .from("prasad_items")
            .update({ display_order: item.display_order - 1 })
            .eq("id", item.id);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/prasad:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
