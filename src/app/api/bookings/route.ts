import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-admin";

// Service-role client: the `orders` table is RLS-protected to its owning
// user, so the anon/publishable key would return ZERO rows here (no
// logged-in Supabase user in an API route). The service role bypasses
// RLS so the admin can list and manage every booking. Server-only.
const supabase = createServiceClient();

// The order_items.item_type value the storefront uses for yatra bookings.
// If the storefront writes a different string (e.g. "yatra_package"), change it
// here only — every query below derives from it.
const ITEM_TYPE_YATRA = "yatra";

// Yatra bookings are identified by this order_number prefix (storefront convention).
const ORDER_PREFIX_YATRA = "YTR-";

const ORDER_STATUSES = ["pending", "confirmed", "cancelled", "completed"] as const;
const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "cod_pending",
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// GET - List yatra bookings, with the order's items and each item's joined yatra
// package. Optional ?status= filter.
//
// Yatra bookings are identified by the "YTR-" order_number prefix — the storefront's
// own discriminator (its account page filters the same way). This is more reliable
// than the item_type join used previously. ITEM_TYPE_YATRA is still used below to pick
// which line items get enriched with package details.
export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      console.error("bookings GET: SUPABASE_SERVICE_ROLE_KEY not configured");
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    // Fetch yatra orders (order_number like 'YTR-%') with all their items, newest first.
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
      .like("order_number", `${ORDER_PREFIX_YATRA}%`)
      .order("created_at", { ascending: false });

    if (statusFilter && ORDER_STATUSES.includes(statusFilter as OrderStatus)) {
      query = query.eq("status", statusFilter);
    }

    const { data: orders, error: ordersError } = await query;
    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 }
      );
    }

    // 3) Join yatra package details onto each yatra line item. order_items.item_id
    //    has no DB-level FK to yatra_packages, so stitch it in here.
    const yatraPackageIds = Array.from(
      new Set(
        (orders || [])
          .flatMap((o) => o.order_items || [])
          .filter((it: { item_type: string }) => it.item_type === ITEM_TYPE_YATRA)
          .map((it: { item_id: string }) => it.item_id)
      )
    );

    let packagesById: Record<string, unknown> = {};
    if (yatraPackageIds.length > 0) {
      const { data: packages } = await supabase
        .from("yatra_packages")
        .select(
          `*, vehicles ( id, name, vehicle_type, seating_capacity, is_ac )`
        )
        .in("id", yatraPackageIds);
      packagesById = Object.fromEntries(
        (packages || []).map((p) => [p.id, p])
      );
    }

    const bookings = (orders || []).map((order) => ({
      ...order,
      order_items: (order.order_items || []).map(
        (it: { item_type: string; item_id: string }) => ({
          ...it,
          yatra_package:
            it.item_type === ITEM_TYPE_YATRA
              ? packagesById[it.item_id] ?? null
              : null,
        })
      ),
    }));

    return NextResponse.json({ bookings });
  } catch (error) {
    console.error("Error in GET /api/bookings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update a booking's status and/or payment_status. Used for cancel
// (status='cancelled', optional reason appended to notes) and manual status edits.
export async function PATCH(request: NextRequest) {
  try {
    if (!supabase) {
      console.error("bookings PATCH: SUPABASE_SERVICE_ROLE_KEY not configured");
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { id, status, payment_status, cancellation_reason } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Booking (order) ID is required" },
        { status: 400 }
      );
    }

    if (status && !ORDER_STATUSES.includes(status as OrderStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${ORDER_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    if (
      payment_status &&
      !PAYMENT_STATUSES.includes(payment_status as PaymentStatus)
    ) {
      return NextResponse.json(
        {
          error: `Invalid payment_status. Allowed: ${PAYMENT_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }
    if (!status && !payment_status) {
      return NextResponse.json(
        { error: "Nothing to update (provide status and/or payment_status)" },
        { status: 400 }
      );
    }

    // Build the update payload from only the provided fields.
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;

    // On cancel, append a dated reason to notes (soft cancel — row is kept).
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
      console.error("Error updating booking:", error);
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 }
      );
    }
    if (!order) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Error in PATCH /api/bookings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
