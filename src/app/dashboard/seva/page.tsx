"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

interface Temple {
  id: string;
  name: string;
  location: string;
}

interface SevaItem {
  id: string;
  temple_id: string;
  name: string;
  price: number;
  time: string | null;
  details: string | null;
  significance: string | null;
  is_active: boolean;
  display_order: number;
  allow_direct_payment: boolean;
  allow_cod: boolean;
  temples?: {
    name: string;
    location: string;
  };
}

// Helper to convert 24h time to 12h AM/PM format
const formatTo12Hour = (time24: string): string => {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
};

// Helper to convert 12h AM/PM format to 24h time
const parseTo24Hour = (time12: string): string => {
  if (!time12) return "";
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return "";
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
};

// Helper to parse time range string into start and end times
const parseTimeRange = (timeRange: string): { start: string; end: string } => {
  if (!timeRange) return { start: "", end: "" };
  const parts = timeRange.split("-").map((s) => s.trim());
  if (parts.length !== 2) return { start: "", end: "" };
  return {
    start: parseTo24Hour(parts[0]),
    end: parseTo24Hour(parts[1]),
  };
};

// Helper to format start and end times into time range string
const formatTimeRange = (start: string, end: string): string => {
  if (!start && !end) return "";
  const startFormatted = formatTo12Hour(start);
  const endFormatted = formatTo12Hour(end);
  if (startFormatted && endFormatted) {
    return `${startFormatted} - ${endFormatted}`;
  }
  return startFormatted || endFormatted;
};

export default function SevaPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [temples, setTemples] = useState<Temple[]>([]);
  const [sevaItems, setSevaItems] = useState<SevaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeva, setEditingSeva] = useState<SevaItem | null>(null);

  const [formData, setFormData] = useState({
    temple_id: "",
    name: "",
    price: 0,
    startTime: "",
    endTime: "",
    details: "",
    significance: "",
    is_active: true,
    displayOrder: 1,
    allow_direct_payment: true,
    allow_cod: true,
  });

  useEffect(() => {
    fetchTemples();
    fetchSevaItems();
  }, []);

  const fetchTemples = async () => {
    try {
      const response = await fetch("/api/temples");
      const data = await response.json();
      if (data.temples) {
        setTemples(data.temples);
      }
    } catch (error) {
      console.error("Failed to fetch temples:", error);
    }
  };

  const fetchSevaItems = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/seva");
      const data = await response.json();
      if (data.sevaItems) {
        setSevaItems(data.sevaItems);
      }
    } catch (error) {
      console.error("Failed to fetch seva items:", error);
      showToast("error", "Failed to load seva items");
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingSeva(null);
    setFormData({
      temple_id: temples.length > 0 ? temples[0].id : "",
      name: "",
      price: 0,
      startTime: "",
      endTime: "",
      details: "",
      significance: "",
      is_active: true,
      displayOrder: sevaItems.length + 1,
      allow_direct_payment: true,
      allow_cod: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (seva: SevaItem) => {
    setEditingSeva(seva);
    const { start, end } = parseTimeRange(seva.time || "");
    setFormData({
      temple_id: seva.temple_id,
      name: seva.name,
      price: seva.price,
      startTime: start,
      endTime: end,
      details: seva.details || "",
      significance: seva.significance || "",
      is_active: seva.is_active,
      displayOrder: seva.display_order,
      allow_direct_payment: seva.allow_direct_payment ?? true,
      allow_cod: seva.allow_cod ?? true,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSeva(null);
  };

  const handleSubmit = async () => {
    if (!formData.temple_id) {
      showToast("error", "Please select a temple");
      return;
    }
    if (!formData.name.trim()) {
      showToast("error", "Please enter a seva name");
      return;
    }
    if (formData.price <= 0) {
      showToast("error", "Please enter a valid price");
      return;
    }
    if (!formData.allow_direct_payment && !formData.allow_cod) {
      showToast("error", "Select at least one payment method");
      return;
    }

    setIsSaving(true);
    try {
      const timeRangeString = formatTimeRange(formData.startTime, formData.endTime);

      if (editingSeva) {
        // Update existing seva
        const response = await fetch("/api/seva", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingSeva.id,
            temple_id: formData.temple_id,
            name: formData.name,
            price: formData.price,
            time: timeRangeString || null,
            details: formData.details || null,
            significance: formData.significance || null,
            is_active: formData.is_active,
            display_order: formData.displayOrder,
            allow_direct_payment: formData.allow_direct_payment,
            allow_cod: formData.allow_cod,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to update seva");
          return;
        }

        showToast("success", "Seva updated successfully");
      } else {
        // Create new seva
        const response = await fetch("/api/seva", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temple_id: formData.temple_id,
            name: formData.name,
            price: formData.price,
            time: timeRangeString || null,
            details: formData.details || null,
            significance: formData.significance || null,
            is_active: formData.is_active,
            display_order: formData.displayOrder,
            allow_direct_payment: formData.allow_direct_payment,
            allow_cod: formData.allow_cod,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to create seva");
          return;
        }

        showToast("success", "Seva created successfully");
      }

      await fetchSevaItems();
      closeModal();
    } catch (error) {
      console.error("Failed to save seva:", error);
      showToast("error", "Failed to save seva");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this seva?")) return;

    try {
      const response = await fetch(`/api/seva?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", "Seva deleted successfully");
        await fetchSevaItems();
      } else {
        const errorData = await response.json();
        showToast("error", errorData.error || "Failed to delete seva");
      }
    } catch (error) {
      console.error("Failed to delete seva:", error);
      showToast("error", "Failed to delete seva");
    }
  };

  const handleReorder = async (sevaId: string, newOrder: number) => {
    const seva = sevaItems.find((s) => s.id === sevaId);
    if (!seva) return;

    try {
      const response = await fetch("/api/seva", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sevaId,
          temple_id: seva.temple_id,
          name: seva.name,
          price: seva.price,
          time: seva.time,
          details: seva.details,
          significance: seva.significance,
          is_active: seva.is_active,
          display_order: newOrder,
          allow_direct_payment: seva.allow_direct_payment,
          allow_cod: seva.allow_cod,
        }),
      });

      if (response.ok) {
        await fetchSevaItems();
      }
    } catch (error) {
      console.error("Failed to reorder:", error);
    }
  };

  const toggleActive = async (seva: SevaItem) => {
    try {
      const response = await fetch("/api/seva", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: seva.id,
          temple_id: seva.temple_id,
          name: seva.name,
          price: seva.price,
          time: seva.time,
          details: seva.details,
          significance: seva.significance,
          is_active: !seva.is_active,
          display_order: seva.display_order,
          allow_direct_payment: seva.allow_direct_payment,
          allow_cod: seva.allow_cod,
        }),
      });

      if (response.ok) {
        showToast(
          "success",
          `Seva ${!seva.is_active ? "activated" : "deactivated"}`
        );
        await fetchSevaItems();
      }
    } catch (error) {
      console.error("Failed to toggle active:", error);
      showToast("error", "Failed to update seva status");
    }
  };

  // Loading state
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

  // No temples state
  if (temples.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            No Temples Found
          </h2>
          <p className="mt-2 text-gray-500">
            You need to create a temple first before adding seva items.
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/temples?action=create")}
          className="flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2 font-medium text-white transition-colors hover:bg-brand-red-dark"
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
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Create Temple
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Seva Items</h1>
          <p className="text-sm text-gray-500">
            Manage seva offerings for temples.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2 font-medium text-white transition-colors hover:bg-brand-red-dark"
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
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Add Seva
        </button>
      </div>

      {/* Seva Items Grid */}
      {sevaItems.length === 0 ? (
        <div className="rounded-lg bg-card-bg p-8 text-center shadow-sm">
          <p className="text-gray-500">
            No seva items found. Click "Add Seva" to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sevaItems.map((seva) => (
            <div
              key={seva.id}
              className={`relative overflow-hidden rounded-lg bg-card-bg shadow-sm transition-shadow hover:shadow-md ${
                !seva.is_active ? "opacity-60" : ""
              }`}
            >
              {/* Inactive Badge */}
              {!seva.is_active && (
                <div className="absolute left-2 top-2 z-10 rounded-full bg-gray-500 px-2 py-1 text-xs font-medium text-white">
                  Inactive
                </div>
              )}

              {/* Display Order Badge */}
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-black/50 px-2 py-1">
                <button
                  onClick={() =>
                    seva.display_order > 1 &&
                    handleReorder(seva.id, seva.display_order - 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={seva.display_order <= 1}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 15.75l7.5-7.5 7.5 7.5"
                    />
                  </svg>
                </button>
                <span className="text-xs font-medium text-white">
                  #{seva.display_order}
                </span>
                <button
                  onClick={() =>
                    seva.display_order < sevaItems.length &&
                    handleReorder(seva.id, seva.display_order + 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={seva.display_order >= sevaItems.length}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>
              </div>

              {/* Card Content */}
              <div className="p-4 pt-12">
                <div className="mb-1 text-xs text-gray-500">
                  {seva.temples?.name}
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {seva.name}
                </h3>
                <p className="text-xl font-bold text-brand-red">₹{seva.price}</p>

                {seva.time && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-gray-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-4 w-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                      />
                    </svg>
                    {seva.time}
                  </div>
                )}

                {seva.details && (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                    {seva.details}
                  </p>
                )}

                {seva.significance && (
                  <p className="mt-1 line-clamp-2 text-xs italic text-gray-500">
                    {seva.significance}
                  </p>
                )}

                {/* Payment methods */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {seva.allow_direct_payment && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                      Direct Payment
                    </span>
                  )}
                  {seva.allow_cod && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                      COD
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <button
                    onClick={() => toggleActive(seva)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      seva.is_active
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {seva.is_active ? "Active" : "Inactive"}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(seva)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                      title="Edit"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(seva.id)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                      title="Delete"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-lg bg-card-bg shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-foreground">
                {editingSeva ? "Edit Seva" : "Add Seva"}
              </h2>
              <button
                onClick={closeModal}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
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

            {/* Modal Body */}
            <div
              className="overflow-y-auto p-6"
              style={{ maxHeight: "calc(90vh - 140px)" }}
            >
              <div className="space-y-4">
                {/* Temple */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Temple <span className="text-red-500">*</span>
                  </label>
                  {editingSeva ? (
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      {temples.find((t) => t.id === formData.temple_id)?.name ||
                        "Unknown Temple"}
                    </div>
                  ) : (
                    <select
                      value={formData.temple_id}
                      onChange={(e) =>
                        setFormData({ ...formData, temple_id: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      {temples.map((temple) => (
                        <option key={temple.id} value={temple.id}>
                          {temple.name} - {temple.location}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Abhishek, Aarti, Pooja"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    min="0"
                    step="0.01"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                {/* Time Range */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Time Range
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) =>
                          setFormData({ ...formData, startTime: e.target.value })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) =>
                          setFormData({ ...formData, endTime: e.target.value })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Details
                  </label>
                  <textarea
                    value={formData.details}
                    onChange={(e) =>
                      setFormData({ ...formData, details: e.target.value })
                    }
                    placeholder="Describe what this seva includes..."
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                {/* Significance */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Significance
                  </label>
                  <textarea
                    value={formData.significance}
                    onChange={(e) =>
                      setFormData({ ...formData, significance: e.target.value })
                    }
                    placeholder="Describe the spiritual significance..."
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                {/* Display Order and Active */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Display Order
                    </label>
                    <input
                      type="number"
                      value={formData.displayOrder}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          displayOrder: parseInt(e.target.value) || 1,
                        })
                      }
                      min="1"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            is_active: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
                      />
                      <span className="text-sm font-medium text-foreground">
                        Active
                      </span>
                    </label>
                  </div>
                </div>

                {/* Payment Options */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Payment Options for Users <span className="text-red-500">*</span>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border-2 p-3 transition-colors ${
                        formData.allow_direct_payment
                          ? "border-brand-red bg-brand-red/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.allow_direct_payment}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            allow_direct_payment: e.target.checked,
                          })
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          Direct Payment
                        </span>
                        <span className="block text-xs text-gray-500">
                          Online payments via UPI, Card, Net Banking, etc.
                        </span>
                      </span>
                    </label>
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border-2 p-3 transition-colors ${
                        formData.allow_cod
                          ? "border-brand-red bg-brand-red/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.allow_cod}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            allow_cod: e.target.checked,
                          })
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
                      />
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          Cash on Delivery (COD)
                        </span>
                        <span className="block text-xs text-gray-500">
                          Cash payment option at the time of the seva.
                        </span>
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-400">
                    Selected payment methods will be visible to users on the booking
                    page. At least one is required.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
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
                    Saving...
                  </>
                ) : (
                  <>{editingSeva ? "Update" : "Create"} Seva</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
