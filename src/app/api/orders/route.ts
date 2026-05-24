import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Physical / product orders are identified by the "BRJ-" order_number prefix
// (the storefront uses "YTR-" for yatra bookings — see /api/bookings). This is the
// storefront's own discriminator; there is no order_type column.
const ORDER_PREFIX = "BRJ-";

const ORDER_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

// GET - List product orders (order_number like 'BRJ-%') with their line items.
// Optional ?status= filter. Selects * so it tolerates the orders table both before
// and after the delivery_module migration (extra columns simply ride along).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    let query = supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          id,
          order_id,
          item_id,
          item_type,
          quantity,
          created_at
        )
      `
      )
      .like("order_number", `${ORDER_PREFIX}%`)
      .order("created_at", { ascending: false });

    if (statusFilter && ORDER_STATUSES.includes(statusFilter as OrderStatus)) {
      query = query.eq("status", statusFilter);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("Error fetching orders:", error);
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      );
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    console.error("Error in GET /api/orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update a product order's status / payment_status (e.g. cancel). Mirrors
// /api/bookings. Money actions (refund) and fulfillment (shipments) get their own
// service-role routes in later phases; this is the basic order-state update.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, payment_status, cancellation_reason } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }
    if (status && !ORDER_STATUSES.includes(status as OrderStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${ORDER_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    if (!status && !payment_status) {
      return NextResponse.json(
        { error: "Nothing to update (provide status and/or payment_status)" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;

    // On cancel, append a dated reason to notes (soft — row kept).
    if (status === "cancelled") {
      const { data: existing } = await supabase
        .from("orders")
        .select("notes")
        .eq("id", id)
        .single();
      const stamp = new Date().toISOString().slice(0, 10);
      const reason = (cancellation_reason || "Cancelled by admin").trim();
      const line = `[${stamp}] Cancelled by admin: ${reason}`;
      updates.notes = existing?.notes ? `${existing.notes}\n${line}` : line;
    }

    const { data: order, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating order:", error);
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      );
    }
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Error in PATCH /api/orders:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
