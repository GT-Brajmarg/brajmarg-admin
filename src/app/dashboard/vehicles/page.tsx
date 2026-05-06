"use client";

import { useState, useRef, useEffect } from "react";
import { useToast } from "@/components/Toast";
import Image from "next/image";

interface Vehicle {
  id: string;
  name: string;
  vehicle_type: string;
  seating_capacity: number;
  is_ac: boolean;
  features: string[];
  image_url: string | null;
  is_active: boolean;
  display_order: number;
}

// Vehicle type options
const VEHICLE_TYPES = ["SUV", "Sedan", "Tempo Traveller", "Mini Bus", "Bus"];

export default function VehiclesPage() {
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // For single image upload
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom feature input
  const [customFeatureInput, setCustomFeatureInput] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    vehicle_type: "SUV",
    seating_capacity: 7,
    is_ac: true,
    features: [] as string[],
    is_active: true,
    displayOrder: 1,
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/vehicles");
      const data = await response.json();
      if (data.vehicles) {
        setVehicles(data.vehicles);
      }
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
      showToast("error", "Failed to load vehicles");
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormData({
      name: "",
      vehicle_type: "SUV",
      seating_capacity: 7,
      is_ac: true,
      features: [],
      is_active: true,
      displayOrder: vehicles.length + 1,
    });
    setCustomFeatureInput("");
    setPendingImage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      name: vehicle.name,
      vehicle_type: vehicle.vehicle_type,
      seating_capacity: vehicle.seating_capacity,
      is_ac: vehicle.is_ac,
      features: vehicle.features || [],
      is_active: vehicle.is_active,
      displayOrder: vehicle.display_order,
    });
    setCustomFeatureInput("");
    setPendingImage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
    setPendingImage(null);
  };

  const addFeature = () => {
    const trimmed = customFeatureInput.trim();
    if (trimmed && !formData.features.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, trimmed],
      }));
      setCustomFeatureInput("");
    }
  };

  const removeFeature = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f !== feature),
    }));
  };

  const handleFeatureKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFeature();
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
    if (!formData.name.trim()) {
      showToast("error", "Please enter a vehicle name");
      return;
    }
    if (!formData.vehicle_type) {
      showToast("error", "Please select a vehicle type");
      return;
    }
    if (formData.seating_capacity <= 0) {
      showToast("error", "Please enter a valid seating capacity");
      return;
    }

    setIsSaving(true);
    try {
      if (editingVehicle) {
        // Update existing vehicle
        const response = await fetch("/api/vehicles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingVehicle.id,
            name: formData.name,
            vehicle_type: formData.vehicle_type,
            seating_capacity: formData.seating_capacity,
            is_ac: formData.is_ac,
            features: formData.features,
            image_url: editingVehicle.image_url,
            is_active: formData.is_active,
            display_order: formData.displayOrder,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to update vehicle");
          return;
        }

        // Upload new image if selected
        if (pendingImage) {
          await uploadImage(editingVehicle.id, formData.name);
        }

        showToast("success", "Vehicle updated successfully");
      } else {
        // Create new vehicle
        const response = await fetch("/api/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            vehicle_type: formData.vehicle_type,
            seating_capacity: formData.seating_capacity,
            is_ac: formData.is_ac,
            features: formData.features,
            is_active: formData.is_active,
            display_order: formData.displayOrder,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to create vehicle");
          return;
        }

        const data = await response.json();
        const newVehicleId = data.vehicle.id;

        // Upload image if selected
        if (pendingImage) {
          await uploadImage(newVehicleId, formData.name);
        }

        showToast("success", "Vehicle created successfully");
      }

      await fetchVehicles();
      closeModal();
    } catch (error) {
      console.error("Failed to save vehicle:", error);
      showToast("error", "Failed to save vehicle");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadImage = async (vehicleId: string, vehicleName: string) => {
    if (!pendingImage) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", pendingImage);
      formDataUpload.append("vehicleId", vehicleId);
      formDataUpload.append("vehicleName", vehicleName);

      const response = await fetch("/api/vehicles/upload", {
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
    if (!confirm("Are you sure you want to delete this vehicle? This will also delete all yatra packages using this vehicle.")) return;

    try {
      const response = await fetch(`/api/vehicles?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", "Vehicle deleted successfully");
        await fetchVehicles();
      } else {
        const errorData = await response.json();
        showToast("error", errorData.error || "Failed to delete vehicle");
      }
    } catch (error) {
      console.error("Failed to delete vehicle:", error);
      showToast("error", "Failed to delete vehicle");
    }
  };

  const handleReorder = async (vehicleId: string, newOrder: number) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return;

    try {
      const response = await fetch("/api/vehicles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: vehicleId,
          name: vehicle.name,
          vehicle_type: vehicle.vehicle_type,
          seating_capacity: vehicle.seating_capacity,
          is_ac: vehicle.is_ac,
          features: vehicle.features,
          image_url: vehicle.image_url,
          is_active: vehicle.is_active,
          display_order: newOrder,
        }),
      });

      if (response.ok) {
        await fetchVehicles();
      }
    } catch (error) {
      console.error("Failed to reorder:", error);
    }
  };

  const toggleActive = async (vehicle: Vehicle) => {
    try {
      const response = await fetch("/api/vehicles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: vehicle.id,
          name: vehicle.name,
          vehicle_type: vehicle.vehicle_type,
          seating_capacity: vehicle.seating_capacity,
          is_ac: vehicle.is_ac,
          features: vehicle.features,
          image_url: vehicle.image_url,
          is_active: !vehicle.is_active,
          display_order: vehicle.display_order,
        }),
      });

      if (response.ok) {
        showToast(
          "success",
          `Vehicle ${!vehicle.is_active ? "activated" : "deactivated"}`
        );
        await fetchVehicles();
      }
    } catch (error) {
      console.error("Failed to toggle active:", error);
      showToast("error", "Failed to update vehicle status");
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vehicles</h1>
          <p className="text-sm text-gray-500">
            Manage your fleet of vehicles for yatra packages.
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
          Add Vehicle
        </button>
      </div>

      {/* Vehicles Grid */}
      {vehicles.length === 0 ? (
        <div className="rounded-lg bg-card-bg p-8 text-center shadow-sm">
          <p className="text-gray-500">
            No vehicles found. Click "Add Vehicle" to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className={`relative overflow-hidden rounded-lg bg-card-bg shadow-sm transition-shadow hover:shadow-md ${
                !vehicle.is_active ? "opacity-60" : ""
              }`}
            >
              {/* Inactive Badge */}
              {!vehicle.is_active && (
                <div className="absolute left-2 top-2 z-10 rounded-full bg-gray-500 px-2 py-1 text-xs font-medium text-white">
                  Inactive
                </div>
              )}

              {/* Display Order Badge */}
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-black/50 px-2 py-1">
                <button
                  onClick={() =>
                    vehicle.display_order > 1 &&
                    handleReorder(vehicle.id, vehicle.display_order - 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={vehicle.display_order <= 1}
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
                  #{vehicle.display_order}
                </span>
                <button
                  onClick={() =>
                    vehicle.display_order < vehicles.length &&
                    handleReorder(vehicle.id, vehicle.display_order + 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={vehicle.display_order >= vehicles.length}
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
                {vehicle.image_url ? (
                  <Image
                    src={vehicle.image_url}
                    alt={vehicle.name}
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
                        d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {vehicle.vehicle_type}
                  </span>
                  {vehicle.is_ac && (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      AC
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {vehicle.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {vehicle.seating_capacity} Seater
                </p>

                {vehicle.features && vehicle.features.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {vehicle.features.slice(0, 3).map((feature) => (
                      <span
                        key={feature}
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                      >
                        {feature}
                      </span>
                    ))}
                    {vehicle.features.length > 3 && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        +{vehicle.features.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <button
                    onClick={() => toggleActive(vehicle)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      vehicle.is_active
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {vehicle.is_active ? "Active" : "Inactive"}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(vehicle)}
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
                      onClick={() => handleDelete(vehicle.id)}
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
                {editingVehicle ? "Edit Vehicle" : "Add Vehicle"}
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
                {/* Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Vehicle Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Innova Crysta, Force Urbania"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                  />
                </div>

                {/* Vehicle Type and Seating */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Vehicle Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.vehicle_type}
                      onChange={(e) =>
                        setFormData({ ...formData, vehicle_type: e.target.value })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    >
                      {VEHICLE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-foreground">
                      Seating Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.seating_capacity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seating_capacity: parseInt(e.target.value) || 0,
                        })
                      }
                      min="1"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                  </div>
                </div>

                {/* AC Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_ac"
                    checked={formData.is_ac}
                    onChange={(e) =>
                      setFormData({ ...formData, is_ac: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
                  />
                  <label htmlFor="is_ac" className="text-sm font-medium text-foreground">
                    Air Conditioned (AC)
                  </label>
                </div>

                {/* Features */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Features
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customFeatureInput}
                      onChange={(e) => setCustomFeatureInput(e.target.value)}
                      onKeyDown={handleFeatureKeyDown}
                      placeholder="Add a feature (e.g., WiFi, Music System)..."
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                    />
                    <button
                      type="button"
                      onClick={addFeature}
                      className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                    >
                      Add
                    </button>
                  </div>
                  {formData.features.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {formData.features.map((feature) => (
                        <span
                          key={feature}
                          className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                        >
                          {feature}
                          <button
                            type="button"
                            onClick={() => removeFeature(feature)}
                            className="ml-0.5 text-gray-500 hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Image Upload */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Vehicle Image
                  </label>
                  {editingVehicle?.image_url && !pendingImage && (
                    <div className="mb-2">
                      <Image
                        src={editingVehicle.image_url}
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
                  <>{editingVehicle ? "Update" : "Create"} Vehicle</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
