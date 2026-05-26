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

interface YatraPackageLite {
  id: string;
  name: string;
  from_location: string;
  to_location: string;
  package_type: string;
  departure_time: string | null;
  arrival_time: string | null;
  price: number | null;
  vehicles?: { name: string; seating_capacity: number } | null;
}

interface BookingItem {
  id: string;
  order_id: string;
  item_id: string;
  item_type: string;
  quantity: number;
  created_at: string;
  yatra_package?: YatraPackageLite | null;
}

interface Booking {
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
  order_items?: BookingItem[];
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
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersPage() {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | OrderStatus>("all");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/bookings");
      const data = await res.json();
      if (res.ok) {
        setBookings(data.bookings || []);
      } else {
        showToast("error", data.error || "Failed to load bookings");
      }
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
      showToast("error", "Failed to load bookings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const visible =
    activeTab === "all"
      ? bookings
      : bookings.filter((b) => b.status === activeTab);

  const counts = STATUS_TABS.reduce(
    (acc, t) => {
      acc[t.value] =
        t.value === "all"
          ? bookings.length
          : bookings.filter((b) => b.status === t.value).length;
      return acc;
    },
    {} as Record<string, number>
  );

  const patchBooking = async (
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
      const res = await fetch("/api/bookings", {
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
      // Update local state from the returned order.
      setBookings((prev) =>
        prev.map((b) => (b.id === body.id ? { ...b, ...data.order } : b))
      );
      setSelected((prev) =>
        prev && prev.id === body.id ? { ...prev, ...data.order } : prev
      );
    } catch (error) {
      console.error("Failed to update booking:", error);
      showToast("error", "Update failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = (booking: Booking) => {
    if (booking.status === "cancelled") return;
    const reason = window.prompt(
      "Cancel this booking? Optionally add a reason (shown in notes):",
      ""
    );
    // prompt returns null if the admin clicked Cancel on the dialog.
    if (reason === null) return;
    patchBooking(
      { id: booking.id, status: "cancelled", cancellation_reason: reason },
      "Booking cancelled"
    );
  };

  const yatraItemsOf = (b: Booking) =>
    (b.order_items || []).filter((it) => it.item_type === "yatra");

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Yatra Bookings</h1>
        <p className="text-sm text-gray-500">
          View, manage, and cancel customer yatra bookings.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-brand-red text-white"
                : "bg-card-bg text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 opacity-70">({counts[tab.value] ?? 0})</span>
          </button>
        ))}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-lg bg-card-bg p-8 text-center shadow-sm">
          <p className="text-gray-500">
            No {activeTab === "all" ? "" : activeTab} yatra bookings found.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-card-bg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Yatra</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((b) => {
                  const items = yatraItemsOf(b);
                  const first = items[0]?.yatra_package;
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {b.order_number || b.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDateTime(b.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">
                          {b.customer_name || "—"}
                        </div>
                        <div className="text-xs text-gray-400">
                          {b.customer_phone || b.customer_email || ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {first ? (
                          <div className="text-foreground">
                            {first.name}
                            <div className="text-xs text-gray-400">
                              {first.from_location} → {first.to_location}
                              {items.length > 1
                                ? ` +${items.length - 1} more`
                                : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">Package removed</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {b.total_amount != null
                          ? `₹${b.total_amount.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${paymentBadge[b.payment_status] || "bg-gray-100 text-gray-600"}`}
                        >
                          {b.payment_status}
                        </span>
                        {b.payment_method && (
                          <div className="mt-0.5 text-xs text-gray-400">
                            {b.payment_method}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[b.status] || "bg-gray-100 text-gray-600"}`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setSelected(b)}
                            className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleCancel(b)}
                            disabled={b.status === "cancelled"}
                            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail drawer/modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-card-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Booking {selected.order_number || selected.id.slice(0, 8)}
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

              {/* Yatra line items */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-500">
                  Yatra Details
                </h3>
                <div className="space-y-2">
                  {yatraItemsOf(selected).map((it) => (
                    <div
                      key={it.id}
                      className="rounded-md border border-gray-200 p-3 text-sm"
                    >
                      {it.yatra_package ? (
                        <>
                          <div className="font-medium text-foreground">
                            {it.yatra_package.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {it.yatra_package.from_location} →{" "}
                            {it.yatra_package.to_location} ·{" "}
                            {it.yatra_package.package_type}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span>Qty / Seats: {it.quantity}</span>
                            {it.yatra_package.departure_time && (
                              <span>Dep: {it.yatra_package.departure_time}</span>
                            )}
                            {it.yatra_package.arrival_time && (
                              <span>Arr: {it.yatra_package.arrival_time}</span>
                            )}
                            {it.yatra_package.vehicles && (
                              <span>
                                Vehicle: {it.yatra_package.vehicles.name}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-400">
                          Package no longer available (item {it.item_id.slice(0, 8)})
                        </span>
                      )}
                    </div>
                  ))}
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
                      Booking Status
                    </label>
                    <select
                      value={selected.status}
                      disabled={isSaving}
                      onChange={(e) =>
                        patchBooking(
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
                        patchBooking(
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

              {/* Notes */}
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
                  : "Cancel booking"}
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
