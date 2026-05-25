"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

type OrderStatus = "pending" | "confirmed" | "cancelled" | "completed";
type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cod_pending";

interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  item_type: string; // prasad | frames | cloths | seva | ...
  quantity: number;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  payment_method: string | null;
  payment_status: PaymentStatus;
  total_amount: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  // Delivery columns (present after the delivery_module migration; optional until then).
  cod_remitted?: boolean | null;
  refund_status?: string | null;
}

const STATUS_TABS: { value: "all" | OrderStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];
const PAYMENT_OPTIONS: PaymentStatus[] = [
  "pending",
  "paid",
  "failed",
  "refunded",
  "cod_pending",
];

const statusBadge: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-200 text-gray-600",
};
const paymentBadge: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-purple-100 text-purple-700",
  cod_pending: "bg-orange-100 text-orange-700",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersPage() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | OrderStatus>("all");
  const [payFilter, setPayFilter] = useState<"all" | "online" | "cod">("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
      } else {
        showToast("error", data.error || "Failed to load orders");
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      showToast("error", "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // COD vs Online. Anything that isn't "cod" is treated as an online payment
  // (the storefront uses razorpay/upi/card for online). Null/empty -> "online"
  // so unknown methods aren't hidden from the default Online filter.
  const isCod = (o: Order) => (o.payment_method || "").toLowerCase() === "cod";

  const visible = orders.filter((o) => {
    const statusOk = activeTab === "all" || o.status === activeTab;
    const payOk =
      payFilter === "all" ||
      (payFilter === "cod" ? isCod(o) : !isCod(o));
    return statusOk && payOk;
  });

  const counts = STATUS_TABS.reduce(
    (acc, t) => {
      // Status counts respect the active payment filter, so the numbers match
      // what the table shows when a payment filter is applied.
      const base =
        payFilter === "all"
          ? orders
          : orders.filter((o) => (payFilter === "cod" ? isCod(o) : !isCod(o)));
      acc[t.value] =
        t.value === "all"
          ? base.length
          : base.filter((o) => o.status === t.value).length;
      return acc;
    },
    {} as Record<string, number>
  );

  const payCounts = {
    all: orders.length,
    online: orders.filter((o) => !isCod(o)).length,
    cod: orders.filter((o) => isCod(o)).length,
  };

  // Summary strip: revenue across the currently-visible (filtered) orders,
  // excluding cancelled ones so the figure reflects real expected revenue.
  const visibleRevenue = visible
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);

  const patchOrder = async (
    body: {
      id: string;
      status?: OrderStatus;
      payment_status?: PaymentStatus;
      cancellation_reason?: string;
    },
    successMsg: string
  ) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Update failed");
        return;
      }
      showToast("success", successMsg);
      setOrders((prev) =>
        prev.map((o) => (o.id === body.id ? { ...o, ...data.order } : o))
      );
      setSelected((prev) =>
        prev && prev.id === body.id ? { ...prev, ...data.order } : prev
      );
    } catch (error) {
      console.error("Failed to update order:", error);
      showToast("error", "Update failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (order: Order) => {
    if (order.status === "cancelled") return;
    const reason = window.prompt(
      "Cancel this order? Optionally add a reason (shown in notes):",
      ""
    );
    if (reason === null) return;
    patchOrder(
      { id: order.id, status: "cancelled", cancellation_reason: reason },
      "Order cancelled"
    );
  };

  const itemsSummary = (o: Order) => {
    const items = o.order_items || [];
    if (items.length === 0) return "—";
    const totalQty = items.reduce((s, it) => s + (it.quantity || 0), 0);
    const types = Array.from(new Set(items.map((it) => it.item_type)));
    return `${items.length} item${items.length === 1 ? "" : "s"} · ${totalQty} qty · ${types.join(", ")}`;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <svg
          className="h-8 w-8 animate-spin text-brand-red"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + summary strip */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-sm text-gray-500">
            Product orders (prasad, frames, cloths, seva) with delivery. Yatra
            bookings are under Yatra Bookings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryCard label="Orders" value={String(orders.length)} />
          <SummaryCard
            label="Revenue"
            value={`₹${visibleRevenue.toLocaleString()}`}
            hint={payFilter === "all" && activeTab === "all" ? "all" : "filtered"}
          />
          <SummaryCard label="Online" value={String(payCounts.online)} />
          <SummaryCard label="COD" value={String(payCounts.cod)} />
        </div>
      </div>

      {/* Filters card */}
      <div className="space-y-3 rounded-xl bg-card-bg p-4 shadow-sm ring-1 ring-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Status
          </span>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-brand-red text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-70">({counts[tab.value] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Payment
          </span>
          {(
            [
              { value: "all", label: "All" },
              { value: "online", label: "Online Payment" },
              { value: "cod", label: "Cash on Delivery" },
            ] as const
          ).map((p) => (
            <button
              key={p.value}
              onClick={() => setPayFilter(p.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                payFilter === p.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              }`}
            >
              {p.label}
              <span className="ml-1.5 opacity-70">({payCounts[p.value]})</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl bg-card-bg p-12 text-center shadow-sm ring-1 ring-gray-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.3}
            stroke="currentColor"
            className="mx-auto h-12 w-12 text-gray-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
            />
          </svg>
          <p className="mt-3 text-sm font-medium text-gray-500">No orders match these filters.</p>
          <p className="mt-1 text-xs text-gray-400">Try switching the status or payment filter above.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card-bg shadow-sm ring-1 ring-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-brand-red/[0.03]">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-foreground">
                        {o.order_number || o.id.slice(0, 8)}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        {formatDateTime(o.created_at)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">
                        {o.customer_name || "—"}
                      </div>
                      <div className="text-xs text-gray-400">
                        {o.customer_phone || o.customer_email || ""}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{itemsSummary(o)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-foreground">
                      {o.total_amount != null
                        ? `₹${o.total_amount.toLocaleString()}`
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <PaymentCell order={o} isCod={isCod(o)} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setSelected(o)}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 ring-1 ring-blue-200 transition-colors hover:bg-blue-50"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleCancel(o)}
                          disabled={o.status === "cancelled"}
                          className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-card-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Order {selected.order_number || selected.id.slice(0, 8)}
                </h2>
                <p className="text-xs text-gray-400">
                  Placed {formatDateTime(selected.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div
              className="space-y-5 overflow-y-auto p-6"
              style={{ maxHeight: "calc(90vh - 140px)" }}
            >
              {/* Customer */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-500">
                  Customer
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Name" value={selected.customer_name} />
                  <Detail label="Phone" value={selected.customer_phone} />
                  <Detail label="Email" value={selected.customer_email} />
                  <Detail
                    label="Amount"
                    value={
                      selected.total_amount != null
                        ? `₹${selected.total_amount.toLocaleString()}`
                        : null
                    }
                  />
                </div>
              </section>

              {/* Items */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-500">
                  Items
                </h3>
                <div className="space-y-2">
                  {(selected.order_items || []).map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 p-3 text-sm"
                    >
                      <div>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                          {it.item_type}
                        </span>
                        <span className="ml-2 text-gray-500">
                          item {it.item_id.slice(0, 8)}
                        </span>
                      </div>
                      <span className="text-gray-600">×{it.quantity}</span>
                    </div>
                  ))}
                  {(selected.order_items || []).length === 0 && (
                    <p className="text-sm text-gray-400">No line items.</p>
                  )}
                </div>
              </section>

              {/* Delivery / shipments — populated in a later phase (Shiprocket). */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-500">
                  Delivery
                </h3>
                <div className="rounded-md border border-dashed border-gray-300 p-3 text-xs text-gray-400">
                  Shipment tracking will appear here once the Shiprocket
                  fulfillment module is enabled.
                </div>
              </section>

              {/* Status controls */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-500">
                  Manage
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Order Status
                    </label>
                    <select
                      value={selected.status}
                      disabled={isSaving}
                      onChange={(e) =>
                        patchOrder(
                          {
                            id: selected.id,
                            status: e.target.value as OrderStatus,
                          },
                          "Status updated"
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Payment Status
                    </label>
                    <select
                      value={selected.payment_status}
                      disabled={isSaving}
                      onChange={(e) =>
                        patchOrder(
                          {
                            id: selected.id,
                            payment_status: e.target.value as PaymentStatus,
                          },
                          "Payment status updated"
                        )
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      {PAYMENT_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {selected.notes && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-gray-500">
                    Notes
                  </h3>
                  <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                    {selected.notes}
                  </pre>
                </section>
              )}
            </div>

            <div className="flex justify-between gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => handleCancel(selected)}
                disabled={selected.status === "cancelled" || isSaving}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                {selected.status === "cancelled"
                  ? "Already cancelled"
                  : "Cancel order"}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-foreground">{value || "—"}</div>
    </div>
  );
}

// A compact stat tile for the header summary strip.
function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-[88px] rounded-lg bg-card-bg px-3 py-2 text-center shadow-sm ring-1 ring-gray-100">
      <div className="text-lg font-bold leading-tight text-foreground">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">
        {label}
        {hint ? ` · ${hint}` : ""}
      </div>
    </div>
  );
}

// Payment cell: method (Online / COD) on top, payment_status badge below.
function PaymentCell({
  order,
  isCod,
}: {
  order: { payment_method: string | null; payment_status: PaymentStatus };
  isCod: boolean;
}) {
  return (
    <div className="space-y-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          isCod ? "bg-orange-100 text-orange-700" : "bg-indigo-100 text-indigo-700"
        }`}
      >
        {isCod ? "COD" : "Online"}
      </span>
      <div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${paymentBadge[order.payment_status] || "bg-gray-100 text-gray-600"}`}
        >
          {order.payment_status}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge[status] || "bg-gray-100 text-gray-600"}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
