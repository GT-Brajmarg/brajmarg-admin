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

interface TimingRow {
  id?: string;
  label: string;
  opening_time: string;
  closing_time: string;
  special_note: string;
  is_active: boolean;
}

interface GroupedTiming {
  temple_id: string;
  temple_name: string;
  temple_location: string;
  day_of_week: number;
  timings: DailyTiming[];
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
  const [filterTempleId, setFilterTempleId] = useState<string>("all");
  
  // Modal state
  const [isEditing, setIsEditing] = useState(false);
  const [modalTempleId, setModalTempleId] = useState("");
  const [modalDayOfWeek, setModalDayOfWeek] = useState(0);
  const [timingRows, setTimingRows] = useState<TimingRow[]>([]);

  // Group timings by temple+day
  const groupedTimings: GroupedTiming[] = [];
  const groupMap = new Map<string, GroupedTiming>();
  
  timings.forEach((timing) => {
    const key = `${timing.temple_id}-${timing.day_of_week}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        temple_id: timing.temple_id,
        temple_name: timing.temples?.name || "Unknown",
        temple_location: timing.temples?.location || "",
        day_of_week: timing.day_of_week,
        timings: [],
      });
    }
    groupMap.get(key)!.timings.push(timing);
  });
  
  groupMap.forEach((group) => groupedTimings.push(group));
  groupedTimings.sort((a, b) => {
    if (a.temple_name !== b.temple_name) return a.temple_name.localeCompare(b.temple_name);
    return a.day_of_week - b.day_of_week;
  });

  // Filter grouped timings
  const filteredGroupedTimings = filterTempleId === "all"
    ? groupedTimings
    : groupedTimings.filter((g) => g.temple_id === filterTempleId);

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
    setIsEditing(false);
    setModalTempleId("");
    setModalDayOfWeek(0);
    setTimingRows([{
      label: "",
      opening_time: "06:00",
      closing_time: "20:00",
      special_note: "",
      is_active: true,
    }]);
    setIsModalOpen(true);
  };

  const openEditModal = (group: GroupedTiming) => {
    setIsEditing(true);
    setModalTempleId(group.temple_id);
    setModalDayOfWeek(group.day_of_week);
    setTimingRows(group.timings.map((t) => ({
      id: t.id,
      label: t.label,
      opening_time: t.opening_time,
      closing_time: t.closing_time,
      special_note: t.special_note || "",
      is_active: t.is_active,
    })));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const addTimingRow = () => {
    setTimingRows([...timingRows, {
      label: "",
      opening_time: "06:00",
      closing_time: "20:00",
      special_note: "",
      is_active: true,
    }]);
  };

  const removeTimingRow = (index: number) => {
    const newRows = timingRows.filter((_, i) => i !== index);
    if (newRows.length === 0) {
      // Last row deleted - close modal (for add) or delete all (for edit)
      if (isEditing) {
        handleDeleteAll();
      } else {
        closeModal();
      }
    } else {
      setTimingRows(newRows);
    }
  };

  const updateTimingRow = (index: number, field: keyof TimingRow, value: string | boolean) => {
    const newRows = [...timingRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setTimingRows(newRows);
  };

  const handleSubmit = async () => {
    if (!modalTempleId) {
      showToast("error", "Please select a temple");
      return;
    }
    
    // Validate all rows have required fields
    for (let i = 0; i < timingRows.length; i++) {
      if (!timingRows[i].label.trim()) {
        showToast("error", `Please enter a label for timing ${i + 1}`);
        return;
      }
    }
    
    setIsSaving(true);
    try {
      if (isEditing) {
        // Update (PUT) - replaces all timings for temple+day
        const response = await fetch("/api/daily-timings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temple_id: modalTempleId,
            day_of_week: modalDayOfWeek,
            timings: timingRows.map((row) => ({
              label: row.label,
              opening_time: row.opening_time,
              closing_time: row.closing_time,
              special_note: row.special_note,
              is_active: row.is_active,
            })),
          }),
        });

        if (response.ok) {
          await fetchTimings();
          closeModal();
          showToast("success", "Timings updated successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to update timings");
        }
      } else {
        // Create (POST) - batch creation
        const response = await fetch("/api/daily-timings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temple_id: modalTempleId,
            day_of_week: modalDayOfWeek,
            timings: timingRows.map((row) => ({
              label: row.label,
              opening_time: row.opening_time,
              closing_time: row.closing_time,
              special_note: row.special_note,
              is_active: row.is_active,
            })),
          }),
        });

        if (response.ok) {
          await fetchTimings();
          closeModal();
          showToast("success", "Timings created successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to create timings");
        }
      }
    } catch (error) {
      console.error("Failed to save timings:", error);
      showToast("error", "Failed to save timings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (confirm(`Are you sure you want to delete all timings for ${DAYS_OF_WEEK[modalDayOfWeek]}?`)) {
      try {
        const response = await fetch(
          `/api/daily-timings?temple_id=${modalTempleId}&day_of_week=${modalDayOfWeek}`,
          { method: "DELETE" }
        );

        if (response.ok) {
          await fetchTimings();
          closeModal();
          showToast("success", "All timings deleted successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to delete timings");
        }
      } catch (error) {
        console.error("Failed to delete timings:", error);
        showToast("error", "Failed to delete timings");
      }
    }
  };

  const handleDeleteGroup = async (group: GroupedTiming) => {
    if (confirm(`Are you sure you want to delete all timings for ${group.temple_name} - ${DAYS_OF_WEEK[group.day_of_week]}?`)) {
      try {
        const response = await fetch(
          `/api/daily-timings?temple_id=${group.temple_id}&day_of_week=${group.day_of_week}`,
          { method: "DELETE" }
        );

        if (response.ok) {
          await fetchTimings();
          showToast("success", "Timings deleted successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to delete timings");
        }
      } catch (error) {
        console.error("Failed to delete timings:", error);
        showToast("error", "Failed to delete timings");
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

      {/* Filter by Temple */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Filter by Temple:</label>
        <select
          value={filterTempleId}
          onChange={(e) => setFilterTempleId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
        >
          <option value="all">All Temples ({groupedTimings.length} entries)</option>
          {temples.map((temple) => {
            const count = groupedTimings.filter((g) => g.temple_id === temple.id).length;
            return (
              <option key={temple.id} value={temple.id}>
                {temple.name} ({count})
              </option>
            );
          })}
        </select>
        {filterTempleId !== "all" && (
          <button
            onClick={() => setFilterTempleId("all")}
            className="text-sm text-brand-red hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Grouped Timings Table */}
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
                  Timings
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredGroupedTimings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    {filterTempleId === "all"
                      ? 'No timings found. Click "Add Timing" to create one.'
                      : "No timings found for this temple."}
                  </td>
                </tr>
              ) : (
                filteredGroupedTimings.map((group) => (
                  <tr
                    key={`${group.temple_id}-${group.day_of_week}`}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-4 text-sm">
                      <div className="font-medium text-foreground">
                        {group.temple_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {group.temple_location}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                        {DAYS_OF_WEEK[group.day_of_week]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {group.timings.map((timing) => (
                          <div
                            key={timing.id}
                            className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                              timing.is_active
                                ? "border-green-200 bg-green-50"
                                : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <span className="font-medium text-foreground">
                              {timing.label}
                            </span>
                            <span className="text-gray-500">
                              {timing.opening_time} - {timing.closing_time}
                            </span>
                            {timing.special_note && (
                              <span className="text-xs text-gray-400">
                                ({timing.special_note})
                              </span>
                            )}
                            {!timing.is_active && (
                              <span className="text-xs text-gray-500">(Inactive)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(group)}
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
                          onClick={() => handleDeleteGroup(group)}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                          title="Delete All"
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-card-bg p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {isEditing ? "Edit Timings" : "Add Timings"}
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
              {/* Temple and Day Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Temple <span className="text-red-500">*</span>
                  </label>
                  {isEditing ? (
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      {temples.find((t) => t.id === modalTempleId)?.name || "Unknown Temple"}
                    </div>
                  ) : (
                    <select
                      value={modalTempleId}
                      onChange={(e) => setModalTempleId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      {!modalTempleId && (
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
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Day of Week <span className="text-red-500">*</span>
                  </label>
                  {isEditing ? (
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      {DAYS_OF_WEEK[modalDayOfWeek]}
                    </div>
                  ) : (
                    <select
                      value={modalDayOfWeek}
                      onChange={(e) => setModalDayOfWeek(parseInt(e.target.value))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      {DAYS_OF_WEEK.map((day, index) => (
                        <option key={index} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="mb-3 text-sm font-medium text-gray-700">Timings</h3>
              </div>

              {/* Timing Rows */}
              <div className="space-y-3">
                {timingRows.map((row, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Timing {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTimingRow(index)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500"
                        title="Remove"
                      >
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
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="grid grid-cols-12 gap-3">
                      {/* Label */}
                      <div className="col-span-4">
                        <label className="mb-1 block text-xs text-gray-500">
                          Label <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={row.label}
                          onChange={(e) => updateTimingRow(index, "label", e.target.value)}
                          placeholder="e.g., Morning Darshan"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                        />
                      </div>

                      {/* Opening Time */}
                      <div className="col-span-2">
                        <label className="mb-1 block text-xs text-gray-500">
                          Opening
                        </label>
                        <input
                          type="time"
                          value={row.opening_time}
                          onChange={(e) => updateTimingRow(index, "opening_time", e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                        />
                      </div>

                      {/* Closing Time */}
                      <div className="col-span-2">
                        <label className="mb-1 block text-xs text-gray-500">
                          Closing
                        </label>
                        <input
                          type="time"
                          value={row.closing_time}
                          onChange={(e) => updateTimingRow(index, "closing_time", e.target.value)}
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                        />
                      </div>

                      {/* Special Note */}
                      <div className="col-span-3">
                        <label className="mb-1 block text-xs text-gray-500">
                          Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={row.special_note}
                          onChange={(e) => updateTimingRow(index, "special_note", e.target.value)}
                          placeholder="Special note"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                        />
                      </div>

                      {/* Active */}
                      <div className="col-span-1 flex items-end justify-center pb-2">
                        <label className="flex cursor-pointer items-center gap-1">
                          <input
                            type="checkbox"
                            checked={row.is_active}
                            onChange={(e) => updateTimingRow(index, "is_active", e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
                          />
                          <span className="text-xs text-gray-500">Active</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add More Button */}
              <button
                type="button"
                onClick={addTimingRow}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-brand-red hover:text-brand-red"
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
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Add More
              </button>
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
                disabled={isSaving || timingRows.length === 0}
                className="flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
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
                  isEditing ? "Update Timings" : "Create Timings"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
