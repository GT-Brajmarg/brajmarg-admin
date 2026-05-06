"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

interface Temple {
  id: string;
  name: string;
  location: string;
}

interface DailyTiming {
  id: string;
  temple_id: string;
  day_of_week: number;
  opening_time: string;
  closing_time: string;
  label: string;
  special_note: string;
  is_active: boolean;
  temples?: {
    name: string;
    location: string;
  };
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function DailyTimingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [temples, setTemples] = useState<Temple[]>([]);
  const [timings, setTimings] = useState<DailyTiming[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTiming, setEditingTiming] = useState<DailyTiming | null>(null);
  const [formData, setFormData] = useState({
    temple_id: "",
    day_of_week: 0,
    opening_time: "06:00",
    closing_time: "20:00",
    label: "",
    special_note: "",
    is_active: true,
  });

  useEffect(() => {
    fetchTemples();
    fetchTimings();
  }, []);

  const fetchTemples = async () => {
    try {
      const response = await fetch("/api/temples");
      const data = await response.json();
      if (data.temples && data.temples.length > 0) {
        setTemples(data.temples);
      } else {
        setTemples([]);
      }
    } catch (error) {
      console.error("Failed to fetch temples:", error);
      showToast("error", "Failed to load temples");
    }
  };

  const fetchTimings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/daily-timings");
      const data = await response.json();
      if (data.timings) {
        setTimings(data.timings);
      } else {
        setTimings([]);
      }
    } catch (error) {
      console.error("Failed to fetch timings:", error);
      showToast("error", "Failed to load timings");
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingTiming(null);
    setFormData({
      temple_id: "",
      day_of_week: 0,
      opening_time: "06:00",
      closing_time: "20:00",
      label: "",
      special_note: "",
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (timing: DailyTiming) => {
    setEditingTiming(timing);
    setFormData({
      temple_id: timing.temple_id,
      day_of_week: timing.day_of_week,
      opening_time: timing.opening_time,
      closing_time: timing.closing_time,
      label: timing.label || "",
      special_note: timing.special_note || "",
      is_active: timing.is_active,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTiming(null);
  };

  const handleSubmit = async () => {
    if (!formData.temple_id) {
      showToast("error", "Please select a temple");
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingTiming) {
        const response = await fetch("/api/daily-timings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingTiming.id,
            day_of_week: formData.day_of_week,
            opening_time: formData.opening_time,
            closing_time: formData.closing_time,
            label: formData.label,
            special_note: formData.special_note,
            is_active: formData.is_active,
          }),
        });

        if (response.ok) {
          await fetchTimings();
          closeModal();
          showToast("success", "Timing updated successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to update timing");
        }
      } else {
        const response = await fetch("/api/daily-timings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temple_id: formData.temple_id,
            day_of_week: formData.day_of_week,
            opening_time: formData.opening_time,
            closing_time: formData.closing_time,
            label: formData.label,
            special_note: formData.special_note,
            is_active: formData.is_active,
          }),
        });

        if (response.ok) {
          await fetchTimings();
          closeModal();
          showToast("success", "Timing created successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to create timing");
        }
      }
    } catch (error) {
      console.error("Failed to save timing:", error);
      showToast("error", "Failed to save timing");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this timing?")) {
      try {
        const response = await fetch(`/api/daily-timings?id=${id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          await fetchTimings();
          showToast("success", "Timing deleted successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to delete timing");
        }
      } catch (error) {
        console.error("Failed to delete timing:", error);
        showToast("error", "Failed to delete timing");
      }
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

  // No temples exist - show prompt to create temple first
  if (temples.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Timing</h1>
          <p className="text-sm text-gray-500">
            Manage temple opening and closing times.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg bg-card-bg p-12 shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="mb-4 h-16 w-16 text-gray-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z"
            />
          </svg>
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            No Temples Found
          </h2>
          <p className="mb-6 text-center text-gray-500">
            You need to create a temple first before adding daily timings.
          </p>
          <button
            onClick={() => router.push("/dashboard/temples?action=create")}
            className="flex items-center gap-2 rounded-lg bg-brand-red px-6 py-3 font-medium text-white transition-colors hover:bg-brand-red-dark"
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
      </div>
    );
  }

  // Main content - temples exist
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Timing</h1>
          <p className="text-sm text-gray-500">
            Manage temple opening and closing times.
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
          Add Timing
        </button>
      </div>

      {/* Timings Table */}
      <div className="rounded-lg bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Temple
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Day
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Opening Time
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Closing Time
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Label
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Special Note
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {timings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No timings found. Click "Add Timing" to create one.
                  </td>
                </tr>
              ) : (
                timings.map((timing) => (
                  <tr
                    key={timing.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-4 text-sm">
                      <div className="font-medium text-foreground">
                        {timing.temples?.name || "Unknown"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {timing.temples?.location}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-foreground">
                      {DAYS_OF_WEEK[timing.day_of_week]}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {timing.opening_time}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {timing.closing_time}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {timing.label || "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {timing.special_note || "-"}
                    </td>
                    <td className="px-4 py-4">
                      {timing.is_active ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(timing)}
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
                          onClick={() => handleDelete(timing.id)}
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-card-bg p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {editingTiming ? "Edit Timing" : "Add Timing"}
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

            <div className="space-y-4">
              {/* Temple Selector */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Temple <span className="text-red-500">*</span>
                </label>
                {editingTiming ? (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                    {temples.find((t) => t.id === formData.temple_id)?.name || "Unknown Temple"}
                  </div>
                ) : (
                  <select
                    value={formData.temple_id}
                    onChange={(e) =>
                      setFormData({ ...formData, temple_id: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  >
                    {!formData.temple_id && (
                      <option value="">Select a temple</option>
                    )}
                    {temples.map((temple) => (
                      <option key={temple.id} value={temple.id}>
                        {temple.name} - {temple.location}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Day of Week */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Day of Week
                </label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) =>
                    setFormData({ ...formData, day_of_week: parseInt(e.target.value) })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                >
                  {DAYS_OF_WEEK.map((day, index) => (
                    <option key={index} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opening Time */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Opening Time
                </label>
                <input
                  type="time"
                  value={formData.opening_time}
                  onChange={(e) =>
                    setFormData({ ...formData, opening_time: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              {/* Closing Time */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Closing Time
                </label>
                <input
                  type="time"
                  value={formData.closing_time}
                  onChange={(e) =>
                    setFormData({ ...formData, closing_time: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              {/* Label */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Label (Optional)
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) =>
                    setFormData({ ...formData, label: e.target.value })
                  }
                  placeholder="e.g., Morning Darshan"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              {/* Special Note */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Special Note (Optional)
                </label>
                <input
                  type="text"
                  value={formData.special_note}
                  onChange={(e) =>
                    setFormData({ ...formData, special_note: e.target.value })
                  }
                  placeholder="e.g., Special aarti at 7 AM"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
                />
                <label htmlFor="is_active" className="text-sm text-foreground">
                  Active
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="rounded-md border border-gray-300 px-4 py-2 font-medium text-foreground hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {isSaving && (
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
                )}
                {isSaving ? "Saving..." : editingTiming ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
