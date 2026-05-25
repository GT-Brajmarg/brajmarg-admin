"use client";

import { useState, useRef, useEffect } from "react";
import { useToast } from "@/components/Toast";
import Image from "next/image";
import type { Alert, AlertPriority, AlertType } from "@/lib/supabase";

interface Temple {
  id: string;
  name: string;
  location: string;
}

const ALERT_TYPES: { value: AlertType; label: string }[] = [
  { value: "festival", label: "Festival" },
  { value: "special_darshan", label: "Special Darshan" },
  { value: "closure", label: "Closure" },
  { value: "timing_change", label: "Timing Change" },
  { value: "general", label: "General" },
];

const PRIORITIES: { value: AlertPriority; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
];

const ALERT_TYPE_BADGE: Record<AlertType, string> = {
  festival: "bg-purple-100 text-purple-800",
  special_darshan: "bg-blue-100 text-blue-800",
  closure: "bg-red-100 text-red-800",
  timing_change: "bg-amber-100 text-amber-800",
  general: "bg-gray-100 text-gray-800",
};

const PRIORITY_BADGE: Record<AlertPriority, string> = {
  info: "bg-sky-100 text-sky-800",
  important: "bg-amber-100 text-amber-900",
  urgent: "bg-red-600 text-white ring-2 ring-red-300",
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

function formatDateRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt).toLocaleString();
  if (!endsAt) return `${start} → Open-ended`;
  return `${start} → ${new Date(endsAt).toLocaleString()}`;
}

function isAlertLive(alert: Alert): boolean {
  if (!alert.is_active) return false;
  const now = Date.now();
  const start = new Date(alert.starts_at).getTime();
  if (now < start) return false;
  if (!alert.ends_at) return true;
  return now <= new Date(alert.ends_at).getTime();
}

function formatAlertType(type: AlertType): string {
  return ALERT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export default function AlertsPage() {
  const { showToast } = useToast();
  const [temples, setTemples] = useState<Temple[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    temple_id: "",
    alert_type: "general" as AlertType,
    priority: "info" as AlertPriority,
    title: "",
    description: "",
    starts_at: "",
    ends_at: "",
    cta_label: "",
    cta_url: "",
    is_active: true,
    displayOrder: 0,
  });

  useEffect(() => {
    fetchTemples();
    fetchAlerts();
  }, []);

  const fetchTemples = async () => {
    try {
      const response = await fetch("/api/temples");
      const data = await response.json();
      setTemples(data.temples ?? []);
    } catch (error) {
      console.error("Failed to fetch temples:", error);
      showToast("error", "Failed to load temples");
    }
  };

  const fetchAlerts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/alerts");
      const data = await response.json();
      setAlerts(data.alerts ?? []);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
      showToast("error", "Failed to load alerts");
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingAlert(null);
    const defaultStart = toDatetimeLocal(new Date().toISOString());
    setFormData({
      temple_id: "",
      alert_type: "general",
      priority: "info",
      title: "",
      description: "",
      starts_at: defaultStart,
      ends_at: "",
      cta_label: "",
      cta_url: "",
      is_active: true,
      displayOrder: alerts.length,
    });
    setPendingImage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (alert: Alert) => {
    setEditingAlert(alert);
    setFormData({
      temple_id: alert.temple_id ?? "",
      alert_type: alert.alert_type,
      priority: alert.priority,
      title: alert.title,
      description: alert.description,
      starts_at: toDatetimeLocal(alert.starts_at),
      ends_at: toDatetimeLocal(alert.ends_at),
      cta_label: alert.cta_label ?? "",
      cta_url: alert.cta_url ?? "",
      is_active: alert.is_active,
      displayOrder: alert.display_order,
    });
    setPendingImage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAlert(null);
    setPendingImage(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingImage(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) setPendingImage(file);
  };

  const uploadImage = async (alertId: string, alertTitle: string) => {
    if (!pendingImage) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", pendingImage);
      formDataUpload.append("alertId", alertId);
      formDataUpload.append("alertTitle", alertTitle);

      const response = await fetch("/api/alerts/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast("error", errorData.error || "Failed to upload image");
      }
    } catch (error) {
      console.error("Failed to upload image:", error);
      showToast("error", "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      showToast("error", "Please enter a title");
      return;
    }
    if (!formData.description.trim()) {
      showToast("error", "Please enter a description");
      return;
    }
    if (!formData.starts_at) {
      showToast("error", "Please select a start date and time");
      return;
    }

    const startsAtIso = fromDatetimeLocal(formData.starts_at);
    const endsAtIso = formData.ends_at
      ? fromDatetimeLocal(formData.ends_at)
      : null;

    if (
      endsAtIso &&
      new Date(endsAtIso).getTime() <= new Date(startsAtIso).getTime()
    ) {
      showToast("error", "End date must be after start date");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        temple_id: formData.temple_id || null,
        alert_type: formData.alert_type,
        priority: formData.priority,
        title: formData.title,
        description: formData.description,
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        cta_label: formData.cta_label || null,
        cta_url: formData.cta_url || null,
        is_active: formData.is_active,
        display_order: formData.displayOrder,
        image_url: editingAlert?.image_url ?? null,
      };

      if (editingAlert) {
        const response = await fetch("/api/alerts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingAlert.id, ...payload }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to update alert");
          return;
        }

        if (pendingImage) {
          await uploadImage(editingAlert.id, formData.title);
        }

        showToast("success", "Alert updated successfully");
      } else {
        const response = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to create alert");
          return;
        }

        const data = await response.json();
        if (pendingImage && data.alert?.id) {
          await uploadImage(data.alert.id, formData.title);
        }

        showToast("success", "Alert created successfully");
      }

      await fetchAlerts();
      closeModal();
    } catch (error) {
      console.error("Failed to save alert:", error);
      showToast("error", "Failed to save alert");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this alert?")) return;

    try {
      const response = await fetch(`/api/alerts?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", "Alert deleted successfully");
        await fetchAlerts();
      } else {
        const errorData = await response.json();
        showToast("error", errorData.error || "Failed to delete alert");
      }
    } catch (error) {
      console.error("Failed to delete alert:", error);
      showToast("error", "Failed to delete alert");
    }
  };

  const toggleActive = async (alert: Alert) => {
    try {
      const response = await fetch("/api/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: alert.id,
          temple_id: alert.temple_id,
          alert_type: alert.alert_type,
          priority: alert.priority,
          title: alert.title,
          description: alert.description,
          starts_at: alert.starts_at,
          ends_at: alert.ends_at,
          image_url: alert.image_url,
          cta_label: alert.cta_label,
          cta_url: alert.cta_url,
          display_order: alert.display_order,
          is_active: !alert.is_active,
        }),
      });

      if (response.ok) {
        showToast(
          "success",
          alert.is_active ? "Alert deactivated" : "Alert activated"
        );
        await fetchAlerts();
      } else {
        const errorData = await response.json();
        showToast("error", errorData.error || "Failed to update alert status");
      }
    } catch (error) {
      console.error("Failed to toggle alert:", error);
      showToast("error", "Failed to update alert status");
    }
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
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
          <p className="text-sm text-gray-500">
            Manage festival notices, closures, darshan updates, and urgent
            announcements.
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
          Add Alert
        </button>
      </div>

      <div className="rounded-lg bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Title
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Type
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Priority
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Temple
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Date Range
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No alerts found. Click &quot;Add Alert&quot; to create one.
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {alert.image_url && (
                          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
                            <Image
                              src={alert.image_url}
                              alt={alert.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-foreground">
                            {alert.title}
                          </div>
                          {isAlertLive(alert) && (
                            <span className="mt-1 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                              Live now
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${ALERT_TYPE_BADGE[alert.alert_type]}`}
                      >
                        {formatAlertType(alert.alert_type)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ${PRIORITY_BADGE[alert.priority]}`}
                      >
                        {alert.priority}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {alert.temple_id ? (
                        <div>
                          <div className="font-medium text-foreground">
                            {alert.temples?.name ?? "Unknown"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {alert.temples?.location}
                          </div>
                        </div>
                      ) : (
                        <span className="font-medium text-foreground">
                          All Temples
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {alert.is_active ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-4 text-xs text-gray-600">
                      {formatDateRange(alert.starts_at, alert.ends_at)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(alert)}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-amber-600"
                          title={
                            alert.is_active ? "Deactivate" : "Activate"
                          }
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
                              d={
                                alert.is_active
                                  ? "M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
                                  : "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                              }
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => openEditModal(alert)}
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
                          onClick={() => handleDelete(alert.id)}
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-2xl rounded-lg bg-card-bg p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {editingAlert ? "Edit Alert" : "Add Alert"}
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

            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Temple
                </label>
                <select
                  value={formData.temple_id}
                  onChange={(e) =>
                    setFormData({ ...formData, temple_id: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                >
                  <option value="">All Temples (Global)</option>
                  {temples.map((temple) => (
                    <option key={temple.id} value={temple.id}>
                      {temple.name} - {temple.location}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Alert Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.alert_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        alert_type: e.target.value as AlertType,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  >
                    {ALERT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value as AlertPriority,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  {formData.priority === "urgent" && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      Urgent alerts are highlighted prominently for end users.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Temple closed for maintenance"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                  placeholder="Full announcement details for devotees..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Starts At <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) =>
                      setFormData({ ...formData, starts_at: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Ends At (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={(e) =>
                      setFormData({ ...formData, ends_at: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Leave empty for open-ended alerts.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    CTA Label (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.cta_label}
                    onChange={(e) =>
                      setFormData({ ...formData, cta_label: e.target.value })
                    }
                    placeholder="e.g., View Details"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    CTA URL (optional)
                  </label>
                  <input
                    type="url"
                    value={formData.cta_url}
                    onChange={(e) =>
                      setFormData({ ...formData, cta_url: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Display Order
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.displayOrder}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      displayOrder: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Image (optional)
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                    isDragging
                      ? "border-brand-red bg-red-50"
                      : "border-gray-300 hover:border-brand-red"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {pendingImage ? (
                    <div
                      className="flex flex-col items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Preview the just-selected file before it's uploaded. */}
                      <div className="relative h-32 w-full max-w-xs">
                        <Image
                          src={URL.createObjectURL(pendingImage)}
                          alt="Selected preview"
                          fill
                          className="rounded object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="max-w-[14rem] truncate text-xs text-gray-500">
                          {pendingImage.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingImage(null)}
                          className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded px-2 py-0.5 text-xs font-medium text-brand-red hover:bg-red-50"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : editingAlert?.image_url ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="relative h-24 w-full max-w-xs">
                        <Image
                          src={editingAlert.image_url}
                          alt="Alert"
                          fill
                          className="rounded object-cover"
                          unoptimized
                        />
                      </div>
                      <span className="text-xs text-gray-400">
                        Current image — click to replace
                      </span>
                    </div>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="mb-2 h-8 w-8 text-gray-400"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                        />
                      </svg>
                      <p className="text-sm text-gray-500">
                        Drag & drop or click to upload
                      </p>
                    </>
                  )}
                </div>
              </div>

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

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving || isUploading}
                className="rounded-md border border-gray-300 px-4 py-2 font-medium text-foreground hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving || isUploading}
                className="flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {(isSaving || isUploading) && (
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                {isSaving || isUploading
                  ? "Saving..."
                  : editingAlert
                    ? "Update"
                    : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
