"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import Image from "next/image";

interface Vehicle {
  id: string;
  name: string;
  vehicle_type: string;
  seating_capacity: number;
  is_ac: boolean;
}

type PackageType = "solo" | "group";

interface YatraPackage {
  id: string;
  vehicle_id: string;
  name: string;
  from_location: string;
  to_location: string;
  distance_km: number | null;
  duration_days: number | null;
  duration_nights: number | null;
  price: number | null;
  price_per_km: number | null;
  route_description: string | null;
  inclusions: string[];
  exclusions: string[];
  itinerary: string | null;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  package_type: PackageType;
  weekdays: number[];
  departure_time: string | null;
  arrival_time: string | null;
  seats_total: number | null;
  allow_direct_payment: boolean;
  allow_cod: boolean;
  vehicles?: Vehicle;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A group yatra runs on consecutive days. The schedule is derived from a single
// start day + the trip duration (max 7), so it can never be non-continuous
// (e.g. Mon+Fri). start=Mon(1), count=2 -> [1,2]; start=Sat(6), count=3 -> [6,0,1].
function consecutiveWeekdays(start: number, count: number): number[] {
  const n = Math.min(Math.max(count, 1), 7); // clamp 1..7 (weekly schedule)
  return Array.from({ length: n }, (_, i) => (start + i) % 7);
}

// Recover the start day of an existing (already-consecutive) schedule for editing.
function scheduleStartOf(weekdays: number[]): number {
  if (!weekdays || weekdays.length === 0) return 1; // default Mon
  // The start is the day whose predecessor is NOT in the set (handles week wrap).
  const set = new Set(weekdays);
  const start = weekdays.find((d) => !set.has((d + 6) % 7));
  return start ?? weekdays[0];
}

export default function YatraPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [yatraPackages, setYatraPackages] = useState<YatraPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Step 1 of "Add": choose the package type before the form opens.
  const [isTypeSelectOpen, setIsTypeSelectOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<YatraPackage | null>(null);

  // Group schedule start day (0=Sun..6=Sat). The recurring weekdays are derived
  // from this + duration_days, so the schedule is always consecutive.
  const [scheduleStartDay, setScheduleStartDay] = useState(1); // Mon

  // For single image upload
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom inputs
  const [customInclusionInput, setCustomInclusionInput] = useState("");
  const [customExclusionInput, setCustomExclusionInput] = useState("");

  const [formData, setFormData] = useState({
    vehicle_id: "",
    name: "",
    from_location: "",
    to_location: "",
    distance_km: 0,
    duration_days: 0,
    duration_nights: 0,
    price: 0,
    price_per_km: 0,
    route_description: "",
    inclusions: [] as string[],
    exclusions: [] as string[],
    itinerary: "",
    is_active: true,
    displayOrder: 1,
    // Type is fixed once the form opens (chosen in the type-select step, or read
    // from the package being edited). Never editable in the form itself.
    package_type: "solo" as PackageType,
    weekdays: [] as number[],
    departure_time: "",
    arrival_time: "",
    seats_total: 0,
    allow_direct_payment: true,
    allow_cod: true,
  });

  useEffect(() => {
    fetchVehicles();
    fetchYatraPackages();
  }, []);

  // Keep the group schedule consecutive: whenever the start day or trip duration
  // changes, derive weekdays = N consecutive days from the start day. This makes
  // non-continuous schedules (e.g. Mon + Fri) impossible by construction.
  useEffect(() => {
    if (!isModalOpen || formData.package_type !== "group") return;
    const count = Math.min(Math.max(formData.duration_days || 1, 1), 7);
    const next = consecutiveWeekdays(scheduleStartDay, count);
    setFormData((prev) => {
      const same =
        prev.weekdays.length === next.length &&
        prev.weekdays.every((d, i) => d === next[i]);
      return same ? prev : { ...prev, weekdays: next };
    });
  }, [scheduleStartDay, formData.duration_days, formData.package_type, isModalOpen]);

  const fetchVehicles = async () => {
    try {
      const response = await fetch("/api/vehicles");
      const data = await response.json();
      if (data.vehicles) {
        // Only show active vehicles
        setVehicles(data.vehicles.filter((v: Vehicle & { is_active: boolean }) => v.is_active));
      }
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
    }
  };

  const fetchYatraPackages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/yatra");
      const data = await response.json();
      if (data.yatraPackages) {
        setYatraPackages(data.yatraPackages);
      }
    } catch (error) {
      console.error("Failed to fetch yatra packages:", error);
      showToast("error", "Failed to load yatra packages");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: clicking "Add Package" opens the type chooser first.
  const openTypeSelect = () => {
    setEditingPackage(null);
    setIsTypeSelectOpen(true);
  };

  // Step 2: a type is chosen -> open the form pre-set to that (now fixed) type.
  const openFormForType = (type: PackageType) => {
    setEditingPackage(null);
    // Group default: 2-day trip from Monday -> weekdays derived to [Mon, Tue].
    const days = type === "group" ? 2 : 0;
    setScheduleStartDay(1); // Mon
    setFormData({
      vehicle_id: vehicles.length > 0 ? vehicles[0].id : "",
      name: "",
      from_location: "",
      to_location: "",
      distance_km: 0,
      duration_days: days,
      duration_nights: days > 0 ? days - 1 : 0,
      price: 0,
      price_per_km: 0,
      route_description: "",
      inclusions: [],
      exclusions: [],
      itinerary: "",
      is_active: true,
      displayOrder: yatraPackages.length + 1,
      package_type: type,
      weekdays: type === "group" ? consecutiveWeekdays(1, days) : [],
      departure_time: "",
      arrival_time: "",
      seats_total: 0,
      allow_direct_payment: true,
      allow_cod: true,
    });
    setCustomInclusionInput("");
    setCustomExclusionInput("");
    setPendingImage(null);
    setIsTypeSelectOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: YatraPackage) => {
    setEditingPackage(pkg);
    // Recover the start day from the saved consecutive schedule for the picker.
    setScheduleStartDay(scheduleStartOf(pkg.weekdays || []));
    setFormData({
      vehicle_id: pkg.vehicle_id,
      name: pkg.name,
      from_location: pkg.from_location,
      to_location: pkg.to_location,
      distance_km: pkg.distance_km || 0,
      duration_days: pkg.duration_days || 0,
      duration_nights: pkg.duration_nights || 0,
      price: pkg.price || 0,
      price_per_km: pkg.price_per_km || 0,
      route_description: pkg.route_description || "",
      inclusions: pkg.inclusions || [],
      exclusions: pkg.exclusions || [],
      itinerary: pkg.itinerary || "",
      is_active: pkg.is_active,
      displayOrder: pkg.display_order,
      // Type comes from the existing package and cannot be changed here.
      package_type: pkg.package_type || "solo",
      weekdays: pkg.weekdays || [],
      departure_time: pkg.departure_time || "",
      arrival_time: pkg.arrival_time || "",
      seats_total: pkg.seats_total || 0,
      allow_direct_payment: pkg.allow_direct_payment ?? true,
      allow_cod: pkg.allow_cod ?? true,
    });
    setCustomInclusionInput("");
    setCustomExclusionInput("");
    setPendingImage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPackage(null);
    setPendingImage(null);
  };

  // Clicking a weekday sets it as the START day; the schedule (consecutive days)
  // is re-derived from it + duration by the effect above. No free multi-select.
  const selectStartDay = (day: number) => {
    setScheduleStartDay(day);
  };

  // Days drive nights automatically (nights = days - 1) and are capped at 7 to fit
  // a weekly schedule. The group weekday derivation reacts to duration_days.
  const handleDaysChange = (raw: number) => {
    const days = Math.min(Math.max(raw || 0, 0), 7);
    setFormData((prev) => ({
      ...prev,
      duration_days: days,
      duration_nights: days > 0 ? days - 1 : 0,
    }));
  };

  const addInclusion = () => {
    const trimmed = customInclusionInput.trim();
    if (trimmed && !formData.inclusions.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        inclusions: [...prev.inclusions, trimmed],
      }));
      setCustomInclusionInput("");
    }
  };

  const removeInclusion = (item: string) => {
    setFormData((prev) => ({
      ...prev,
      inclusions: prev.inclusions.filter((i) => i !== item),
    }));
  };

  const addExclusion = () => {
    const trimmed = customExclusionInput.trim();
    if (trimmed && !formData.exclusions.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        exclusions: [...prev.exclusions, trimmed],
      }));
      setCustomExclusionInput("");
    }
  };

  const removeExclusion = (item: string) => {
    setFormData((prev) => ({
      ...prev,
      exclusions: prev.exclusions.filter((e) => e !== item),
    }));
  };

  const handleInclusionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addInclusion();
    }
  };

  const handleExclusionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addExclusion();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingImage(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setPendingImage(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.vehicle_id) {
      showToast("error", "Please select a vehicle");
      return;
    }
    if (!formData.name.trim()) {
      showToast("error", "Please enter a package name");
      return;
    }
    if (!formData.from_location.trim()) {
      showToast("error", "Please enter from location");
      return;
    }
    if (!formData.to_location.trim()) {
      showToast("error", "Please enter to location");
      return;
    }
    if (formData.package_type === "group") {
      if (!formData.duration_days || formData.duration_days < 1) {
        showToast("error", "Set the trip duration (Days) for the group schedule");
        return;
      }
      if (formData.weekdays.length === 0) {
        showToast("error", "Select at least one recurring day for the group schedule");
        return;
      }
      if (!formData.departure_time) {
        showToast("error", "Please set a departure time");
        return;
      }
      if (!formData.seats_total || formData.seats_total < 1) {
        showToast("error", "Please set the number of seats available");
        return;
      }
    }

    // Payment options apply to both types; at least one must be enabled.
    if (!formData.allow_direct_payment && !formData.allow_cod) {
      showToast("error", "Select at least one payment method");
      return;
    }

    // Group-only fields, sent only for group packages.
    const groupFields =
      formData.package_type === "group"
        ? {
            weekdays: formData.weekdays,
            departure_time: formData.departure_time,
            arrival_time: formData.arrival_time || null,
            seats_total: formData.seats_total,
          }
        : {};

    // Payment fields sent on every request, both create and update.
    const paymentFields = {
      allow_direct_payment: formData.allow_direct_payment,
      allow_cod: formData.allow_cod,
    };

    setIsSaving(true);
    try {
      if (editingPackage) {
        // Update existing package
        const response = await fetch("/api/yatra", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingPackage.id,
            vehicle_id: formData.vehicle_id,
            name: formData.name,
            from_location: formData.from_location,
            to_location: formData.to_location,
            distance_km: formData.distance_km || null,
            duration_days: formData.duration_days || null,
            duration_nights: formData.duration_nights || null,
            price: formData.price || null,
            price_per_km: formData.price_per_km || null,
            route_description: formData.route_description || null,
            inclusions: formData.inclusions,
            exclusions: formData.exclusions,
            itinerary: formData.itinerary || null,
            image_url: editingPackage.image_url,
            is_active: formData.is_active,
            display_order: formData.displayOrder,
            ...groupFields,
            ...paymentFields,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to update package");
          return;
        }

        // Upload new image if selected
        if (pendingImage) {
          await uploadImage(editingPackage.id, formData.name);
        }

        showToast("success", "Yatra package updated successfully");
      } else {
        // Create new package
        const response = await fetch("/api/yatra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicle_id: formData.vehicle_id,
            name: formData.name,
            from_location: formData.from_location,
            to_location: formData.to_location,
            distance_km: formData.distance_km || null,
            duration_days: formData.duration_days || null,
            duration_nights: formData.duration_nights || null,
            price: formData.price || null,
            price_per_km: formData.price_per_km || null,
            route_description: formData.route_description || null,
            inclusions: formData.inclusions,
            exclusions: formData.exclusions,
            itinerary: formData.itinerary || null,
            is_active: formData.is_active,
            display_order: formData.displayOrder,
            package_type: formData.package_type,
            ...groupFields,
            ...paymentFields,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to create package");
          return;
        }

        const data = await response.json();
        const newPackageId = data.yatraPackage.id;

        // Upload image if selected
        if (pendingImage) {
          await uploadImage(newPackageId, formData.name);
        }

        showToast("success", "Yatra package created successfully");
      }

      await fetchYatraPackages();
      closeModal();
    } catch (error) {
      console.error("Failed to save package:", error);
      showToast("error", "Failed to save package");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadImage = async (yatraId: string, yatraName: string) => {
    if (!pendingImage) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", pendingImage);
      formDataUpload.append("yatraId", yatraId);
      formDataUpload.append("yatraName", yatraName);

      const response = await fetch("/api/yatra/upload", {
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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this yatra package?")) return;

    try {
      const response = await fetch(`/api/yatra?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", "Yatra package deleted successfully");
        await fetchYatraPackages();
      } else {
        const errorData = await response.json();
        showToast("error", errorData.error || "Failed to delete package");
      }
    } catch (error) {
      console.error("Failed to delete package:", error);
      showToast("error", "Failed to delete package");
    }
  };

  const handleReorder = async (packageId: string, newOrder: number) => {
    const pkg = yatraPackages.find((p) => p.id === packageId);
    if (!pkg) return;

    try {
      const response = await fetch("/api/yatra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: packageId,
          vehicle_id: pkg.vehicle_id,
          name: pkg.name,
          from_location: pkg.from_location,
          to_location: pkg.to_location,
          distance_km: pkg.distance_km,
          duration_days: pkg.duration_days,
          duration_nights: pkg.duration_nights,
          price: pkg.price,
          price_per_km: pkg.price_per_km,
          route_description: pkg.route_description,
          inclusions: pkg.inclusions,
          exclusions: pkg.exclusions,
          itinerary: pkg.itinerary,
          image_url: pkg.image_url,
          is_active: pkg.is_active,
          display_order: newOrder,
          // Preserve group schedule on reorder (server keeps the type fixed).
          weekdays: pkg.weekdays,
          departure_time: pkg.departure_time,
          arrival_time: pkg.arrival_time,
          seats_total: pkg.seats_total,
          // Preserve payment options too.
          allow_direct_payment: pkg.allow_direct_payment,
          allow_cod: pkg.allow_cod,
        }),
      });

      if (response.ok) {
        await fetchYatraPackages();
      }
    } catch (error) {
      console.error("Failed to reorder:", error);
    }
  };

  const toggleActive = async (pkg: YatraPackage) => {
    try {
      const response = await fetch("/api/yatra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pkg.id,
          vehicle_id: pkg.vehicle_id,
          name: pkg.name,
          from_location: pkg.from_location,
          to_location: pkg.to_location,
          distance_km: pkg.distance_km,
          duration_days: pkg.duration_days,
          duration_nights: pkg.duration_nights,
          price: pkg.price,
          price_per_km: pkg.price_per_km,
          route_description: pkg.route_description,
          inclusions: pkg.inclusions,
          exclusions: pkg.exclusions,
          itinerary: pkg.itinerary,
          image_url: pkg.image_url,
          is_active: !pkg.is_active,
          display_order: pkg.display_order,
          // Preserve group schedule on activate/deactivate.
          weekdays: pkg.weekdays,
          departure_time: pkg.departure_time,
          arrival_time: pkg.arrival_time,
          seats_total: pkg.seats_total,
          // Preserve payment options too.
          allow_direct_payment: pkg.allow_direct_payment,
          allow_cod: pkg.allow_cod,
        }),
      });

      if (response.ok) {
        showToast(
          "success",
          `Package ${!pkg.is_active ? "activated" : "deactivated"}`
        );
        await fetchYatraPackages();
      }
    } catch (error) {
      console.error("Failed to toggle active:", error);
      showToast("error", "Failed to update package status");
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

  // No vehicles state
  if (vehicles.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            No Vehicles Found
          </h2>
          <p className="mt-2 text-gray-500">
            You need to create at least one vehicle before adding yatra packages.
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/vehicles")}
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
          Add Vehicle
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yatra Packages</h1>
          <p className="text-sm text-gray-500">
            Manage yatra trip packages with vehicles.
          </p>
        </div>
        <button
          onClick={openTypeSelect}
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
          Add Package
        </button>
      </div>

      {/* Yatra Packages Grid */}
      {yatraPackages.length === 0 ? (
        <div className="rounded-lg bg-card-bg p-8 text-center shadow-sm">
          <p className="text-gray-500">
            No yatra packages found. Click "Add Package" to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {yatraPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative overflow-hidden rounded-lg bg-card-bg shadow-sm transition-shadow hover:shadow-md ${
                !pkg.is_active ? "opacity-60" : ""
              }`}
            >
              {/* Inactive Badge */}
              {!pkg.is_active && (
                <div className="absolute left-2 top-2 z-10 rounded-full bg-gray-500 px-2 py-1 text-xs font-medium text-white">
                  Inactive
                </div>
              )}

              {/* Display Order Badge */}
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-black/50 px-2 py-1">
                <button
                  onClick={() =>
                    pkg.display_order > 1 &&
                    handleReorder(pkg.id, pkg.display_order - 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={pkg.display_order <= 1}
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
                  #{pkg.display_order}
                </span>
                <button
                  onClick={() =>
                    pkg.display_order < yatraPackages.length &&
                    handleReorder(pkg.id, pkg.display_order + 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={pkg.display_order >= yatraPackages.length}
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

              {/* Image */}
              <div className="relative h-40 bg-gray-100">
                {pkg.image_url ? (
                  <Image
                    src={pkg.image_url}
                    alt={pkg.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1}
                      stroke="currentColor"
                      className="h-16 w-16"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                {/* Package type badge */}
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  {pkg.package_type === "group" ? (
                    <>
                      <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                        Shared Yatra
                      </span>
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Seat Booking
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="rounded bg-brand-red px-2 py-0.5 text-xs font-semibold text-white">
                        Private Vehicle
                      </span>
                      <span className="rounded bg-brand-red/10 px-2 py-0.5 text-xs font-medium text-brand-red">
                        Full Package
                      </span>
                    </>
                  )}
                </div>

                {/* Vehicle info */}
                {pkg.vehicles && (
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {pkg.vehicles.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {pkg.vehicles.seating_capacity} Seater
                    </span>
                  </div>
                )}

                <h3 className="text-lg font-semibold text-foreground">
                  {pkg.name}
                </h3>

                {/* Route */}
                <div className="mt-1 flex items-center gap-1 text-sm text-gray-600">
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
                      d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                    />
                  </svg>
                  {pkg.from_location} → {pkg.to_location}
                </div>

                {/* Duration & Distance */}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  {pkg.duration_days !== null && pkg.duration_days > 0 && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5">
                      {pkg.duration_days}D{pkg.duration_nights ? `/${pkg.duration_nights}N` : ""}
                    </span>
                  )}
                  {pkg.distance_km !== null && pkg.distance_km > 0 && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5">
                      {pkg.distance_km} km
                    </span>
                  )}
                </div>

                {/* Schedule / availability — differs by type */}
                {pkg.package_type === "group" ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-gray-700">
                      Runs On:{" "}
                      <span className="text-blue-700">
                        {(pkg.weekdays && pkg.weekdays.length > 0
                          ? pkg.weekdays.map((d) => WEEKDAY_LABELS[d])
                          : ["—"]
                        ).join(" · ")}
                      </span>
                    </p>
                    {pkg.seats_total !== null && (
                      <p className="text-xs text-gray-600">
                        {pkg.seats_total} Seats Available
                        {pkg.departure_time ? ` · Dep ${pkg.departure_time}` : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-medium text-green-700">
                    Available Any Day
                  </p>
                )}

                {/* Price — per seat for group, base (+per km) for solo */}
                <div className="mt-2">
                  {pkg.price !== null && pkg.price > 0 && (
                    <p className="text-lg font-bold text-brand-red">
                      ₹{pkg.price.toLocaleString()}
                      {pkg.package_type === "group" && (
                        <span className="text-sm font-medium text-gray-500">
                          {" "}
                          / Seat
                        </span>
                      )}
                    </p>
                  )}
                  {pkg.package_type === "solo" &&
                    pkg.price_per_km !== null &&
                    pkg.price_per_km > 0 && (
                      <p className="text-sm text-gray-600">
                        + ₹{pkg.price_per_km}/km
                      </p>
                    )}
                  {pkg.package_type === "group" &&
                    pkg.price !== null &&
                    pkg.price > 0 &&
                    pkg.seats_total !== null &&
                    pkg.seats_total > 0 && (
                      <p className="text-xs text-gray-500">
                        Total ₹{(pkg.price * pkg.seats_total).toLocaleString()} (
                        {pkg.seats_total} seats)
                      </p>
                    )}
                </div>

                {/* Payment methods */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {pkg.allow_direct_payment && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                      Direct Payment
                    </span>
                  )}
                  {pkg.allow_cod && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                      COD
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <button
                    onClick={() => toggleActive(pkg)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      pkg.is_active
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {pkg.is_active ? "Active" : "Inactive"}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(pkg)}
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
                      onClick={() => handleDelete(pkg.id)}
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

      {/* Step 1 — Package Type Selection Modal */}
      {isTypeSelectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-card-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-foreground">
                What do you want to create?
              </h2>
              <button
                onClick={() => setIsTypeSelectOpen(false)}
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
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              {/* Solo */}
              <button
                onClick={() => openFormForType("solo")}
                className="flex flex-col rounded-lg border-2 border-gray-200 p-5 text-left transition-colors hover:border-brand-red hover:bg-brand-red/5"
              >
                <span className="inline-flex w-fit rounded-full bg-brand-red/10 px-2.5 py-0.5 text-xs font-semibold text-brand-red">
                  Solo Package
                </span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  Private Vehicle (Full Package)
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Book an entire vehicle for a private group. Available any day.
                </p>
                <ul className="mt-3 space-y-1 text-xs text-gray-600">
                  <li>• Full vehicle booking</li>
                  <li>• No seat management</li>
                  <li>• One fixed package price</li>
                </ul>
                <span className="mt-4 inline-flex w-fit items-center gap-1 rounded-md bg-brand-red px-3 py-1.5 text-sm font-medium text-white">
                  Create Solo Package
                </span>
              </button>
              {/* Group */}
              <button
                onClick={() => openFormForType("group")}
                className="flex flex-col rounded-lg border-2 border-gray-200 p-5 text-left transition-colors hover:border-blue-600 hover:bg-blue-50"
              >
                <span className="inline-flex w-fit rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  Group Package
                </span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  Shared Yatra (Seat Booking)
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Book individual seats on a weekly recurring schedule.
                </p>
                <ul className="mt-3 space-y-1 text-xs text-gray-600">
                  <li>• Seat management enabled</li>
                  <li>• Weekly recurring schedule</li>
                  <li>• Per-seat pricing</li>
                </ul>
                <span className="mt-4 inline-flex w-fit items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
                  Create Group Package
                </span>
              </button>
            </div>
            <p className="border-t border-gray-200 px-6 py-3 text-center text-xs text-gray-400">
              Package type cannot be changed after creation.
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-card-bg shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingPackage ? "Edit" : "Add"}{" "}
                  {formData.package_type === "group" ? "Group" : "Solo"} Package
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    formData.package_type === "group"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-brand-red/10 text-brand-red"
                  }`}
                >
                  {formData.package_type === "group"
                    ? "GROUP · Shared Yatra"
                    : "SOLO · Private Vehicle"}
                </span>
              </div>
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
                {/* Type-immutability warning (edit only) */}
                {editingPackage && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                      className="mt-0.5 h-4 w-4 flex-shrink-0"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                      />
                    </svg>
                    <span>
                      <strong>Package type cannot be changed.</strong> This package
                      stays a {formData.package_type === "group" ? "Group" : "Solo"}{" "}
                      package to avoid pricing and booking conflicts.
                    </span>
                  </div>
                )}

                {/* Vehicle */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Vehicle <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) =>
                      setFormData({ ...formData, vehicle_id: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  >
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} ({vehicle.vehicle_type}, {vehicle.seating_capacity} Seater)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Package Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Nathdwara to Vrindavan Darshan"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                {/* From/To Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      From Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.from_location}
                      onChange={(e) =>
                        setFormData({ ...formData, from_location: e.target.value })
                      }
                      placeholder="e.g., Nathdwara"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      To Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.to_location}
                      onChange={(e) =>
                        setFormData({ ...formData, to_location: e.target.value })
                      }
                      placeholder="e.g., Vrindavan"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>
                </div>

                {/* Distance and Duration */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Distance (km)
                    </label>
                    <input
                      type="number"
                      value={formData.distance_km}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          distance_km: parseInt(e.target.value) || 0,
                        })
                      }
                      min="0"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Days <span className="text-xs font-normal text-gray-400">(max 7)</span>
                    </label>
                    <input
                      type="number"
                      value={formData.duration_days}
                      onChange={(e) => handleDaysChange(parseInt(e.target.value))}
                      min="0"
                      max="7"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Nights{" "}
                      <span className="text-xs font-normal text-gray-400">(auto)</span>
                    </label>
                    <input
                      type="number"
                      value={formData.duration_nights}
                      readOnly
                      tabIndex={-1}
                      min="0"
                      className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
                    />
                  </div>
                </div>

                {/* Price — label and fields differ by package type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      {formData.package_type === "group"
                        ? "Price Per Seat (₹)"
                        : "Base Price (₹)"}
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
                  {/* Price per km only applies to full-vehicle (solo) packages */}
                  {formData.package_type === "solo" && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Price per km (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.price_per_km}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            price_per_km: parseFloat(e.target.value) || 0,
                          })
                        }
                        min="0"
                        step="0.01"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>
                  )}
                  {/* Group: computed total = seats × price per seat (read-only) */}
                  {formData.package_type === "group" && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Total Package Price (₹)
                      </label>
                      <div className="flex h-[38px] items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-brand-red">
                        ₹
                        {(
                          (formData.price || 0) * (formData.seats_total || 0)
                        ).toLocaleString()}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {formData.seats_total || 0} seats × ₹
                        {(formData.price || 0).toLocaleString()}/seat
                      </p>
                    </div>
                  )}
                </div>

                {/* Weekly Schedule & Seat Management — GROUP packages only */}
                {formData.package_type === "group" && (
                  <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.8}
                        stroke="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                        />
                      </svg>
                      Weekly Schedule &amp; Seat Management
                    </h3>

                    {/* Available days — pick the START day; the trip runs that many
                        consecutive days (from "Days" above). Always continuous. */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="block text-xs font-medium text-gray-600">
                          Starting Day <span className="text-red-500">*</span>
                        </label>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          {formData.weekdays.length} day
                          {formData.weekdays.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_LABELS.map((label, idx) => {
                          const inRange = formData.weekdays.includes(idx);
                          const isStart = idx === scheduleStartDay;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => selectStartDay(idx)}
                              aria-pressed={isStart}
                              title={isStart ? "Start day" : inRange ? "Included" : "Set as start day"}
                              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                                isStart
                                  ? "bg-blue-600 text-white ring-2 ring-blue-300"
                                  : inRange
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {formData.weekdays.length > 0 ? (
                          <>
                            Runs every:{" "}
                            <span className="font-medium text-blue-700">
                              {formData.weekdays
                                .map((d) => WEEKDAY_LABELS[d])
                                .join(" · ")}
                            </span>{" "}
                            ({formData.duration_days || 0} consecutive day
                            {formData.duration_days === 1 ? "" : "s"} from{" "}
                            {WEEKDAY_LABELS[scheduleStartDay]})
                          </>
                        ) : (
                          "Set the number of Days above to build the schedule."
                        )}
                      </p>
                    </div>

                    {/* Departure / arrival time */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Departure Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="time"
                          value={formData.departure_time}
                          onChange={(e) =>
                            setFormData({ ...formData, departure_time: e.target.value })
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">
                          Arrival Time
                        </label>
                        <input
                          type="time"
                          value={formData.arrival_time}
                          onChange={(e) =>
                            setFormData({ ...formData, arrival_time: e.target.value })
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                        />
                      </div>
                    </div>

                    {/* Seats per week */}
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Seats Available (per week){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.seats_total}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            seats_total: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        These seats reset each week. Once a day&apos;s departure passes,
                        availability rolls forward to next week.
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment Options — applies to both Solo and Group packages */}
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
                          Cash payment option at the time of travel.
                        </span>
                      </span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-400">
                    Selected payment methods will be visible to users on the booking
                    page. At least one is required.
                  </p>
                </div>

                {/* Route Description */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Route Description
                  </label>
                  <textarea
                    value={formData.route_description}
                    onChange={(e) =>
                      setFormData({ ...formData, route_description: e.target.value })
                    }
                    placeholder="e.g., Via Jaipur, Agra with stops..."
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                {/* Inclusions */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Inclusions
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customInclusionInput}
                      onChange={(e) => setCustomInclusionInput(e.target.value)}
                      onKeyDown={handleInclusionKeyDown}
                      placeholder="Add inclusion (e.g., Fuel, Driver, Toll)..."
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                    <button
                      type="button"
                      onClick={addInclusion}
                      className="rounded-md bg-green-100 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-200"
                    >
                      Add
                    </button>
                  </div>
                  {formData.inclusions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {formData.inclusions.map((item) => (
                        <span
                          key={item}
                          className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"
                        >
                          ✓ {item}
                          <button
                            type="button"
                            onClick={() => removeInclusion(item)}
                            className="ml-0.5 hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Exclusions */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Exclusions
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customExclusionInput}
                      onChange={(e) => setCustomExclusionInput(e.target.value)}
                      onKeyDown={handleExclusionKeyDown}
                      placeholder="Add exclusion (e.g., Food, Hotel, Entry Tickets)..."
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                    <button
                      type="button"
                      onClick={addExclusion}
                      className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
                    >
                      Add
                    </button>
                  </div>
                  {formData.exclusions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {formData.exclusions.map((item) => (
                        <span
                          key={item}
                          className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700"
                        >
                          ✗ {item}
                          <button
                            type="button"
                            onClick={() => removeExclusion(item)}
                            className="ml-0.5 hover:text-red-800"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Itinerary */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Itinerary
                  </label>
                  <textarea
                    value={formData.itinerary}
                    onChange={(e) =>
                      setFormData({ ...formData, itinerary: e.target.value })
                    }
                    placeholder="Day 1: Departure from Nathdwara...&#10;Day 2: Visit temples...&#10;Day 3: Return..."
                    rows={4}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Package Image
                  </label>
                  {editingPackage?.image_url && !pendingImage && (
                    <div className="mb-2">
                      <Image
                        src={editingPackage.image_url}
                        alt="Current"
                        width={200}
                        height={120}
                        className="rounded object-cover"
                        unoptimized
                      />
                      <p className="mt-1 text-xs text-gray-500">Current image</p>
                    </div>
                  )}
                  {pendingImage ? (
                    <div className="relative inline-block">
                      <Image
                        src={URL.createObjectURL(pendingImage)}
                        alt="Preview"
                        width={200}
                        height={120}
                        className="rounded object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setPendingImage(null)}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"
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
                            d="M6 18 18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                        isDragging
                          ? "border-brand-red bg-brand-red/5"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="mx-auto h-8 w-8 text-gray-400"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                        />
                      </svg>
                      <p className="mt-1 text-sm text-gray-500">
                        Drop image or click to browse
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  )}
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
                disabled={isSaving || isUploading}
                className="flex items-center gap-2 rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark disabled:opacity-50"
              >
                {isSaving || isUploading ? (
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
                    {isUploading ? "Uploading..." : "Saving..."}
                  </>
                ) : (
                  <>{editingPackage ? "Update" : "Create"} Package</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
