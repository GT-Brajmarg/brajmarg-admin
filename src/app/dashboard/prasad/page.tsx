"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import Image from "next/image";

interface Temple {
  id: string;
  name: string;
  location: string;
}

interface PrasadImage {
  id: string;
  prasad_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

interface PrasadItem {
  id: string;
  temple_id: string;
  name: string;
  price: number;
  quantity: number;
  ingredients: string | null;
  image_url: string | null;
  in_stock: boolean;
  display_order: number;
  allow_direct_payment: boolean;
  allow_cod: boolean;
  temples?: {
    name: string;
    location: string;
  };
  prasad_images?: PrasadImage[];
}

// Low stock warning threshold
const LOW_STOCK_THRESHOLD = 10;

export default function PrasadPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [temples, setTemples] = useState<Temple[]>([]);
  const [prasadItems, setPrasadItems] = useState<PrasadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [editingPrasad, setEditingPrasad] = useState<PrasadItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // For image gallery modal
  const [galleryPrasad, setGalleryPrasad] = useState<PrasadItem | null>(null);

  // Pending images for new prasad (before saving)
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    temple_id: "",
    name: "",
    price: 0,
    quantity: 0,
    ingredients: "",
    in_stock: true,
    displayOrder: 1,
    allow_direct_payment: true,
    allow_cod: true,
  });

  useEffect(() => {
    fetchTemples();
    fetchPrasadItems();
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

  const fetchPrasadItems = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/prasad");
      const data = await response.json();
      if (data.prasadItems) {
        setPrasadItems(data.prasadItems);
      }
    } catch (error) {
      console.error("Failed to fetch prasad items:", error);
      showToast("error", "Failed to load prasad items");
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingPrasad(null);
    setFormData({
      temple_id: temples.length > 0 ? temples[0].id : "",
      name: "",
      price: 0,
      quantity: 0,
      ingredients: "",
      in_stock: true,
      displayOrder: prasadItems.length + 1,
      allow_direct_payment: true,
      allow_cod: true,
    });
    setPendingImages([]);
    setPrimaryImageIndex(0);
    setModalStep(1);
    setIsModalOpen(true);
  };

  const openEditModal = (prasad: PrasadItem) => {
    setEditingPrasad(prasad);
    setFormData({
      temple_id: prasad.temple_id,
      name: prasad.name,
      price: prasad.price,
      quantity: prasad.quantity,
      ingredients: prasad.ingredients || "",
      in_stock: prasad.in_stock,
      displayOrder: prasad.display_order,
      allow_direct_payment: prasad.allow_direct_payment ?? true,
      allow_cod: prasad.allow_cod ?? true,
    });
    setPendingImages([]);
    setPrimaryImageIndex(0);
    setModalStep(1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPrasad(null);
    setPendingImages([]);
    setPrimaryImageIndex(0);
    setModalStep(1);
  };

  const handleStep1Submit = () => {
    if (!formData.temple_id) {
      showToast("error", "Please select a temple");
      return;
    }
    if (!formData.name.trim()) {
      showToast("error", "Please enter a prasad name");
      return;
    }
    if (formData.price <= 0) {
      showToast("error", "Please enter a valid price");
      return;
    }
    setModalStep(2);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setPendingImages((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files) {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      setPendingImages((prev) => [...prev, ...imageFiles]);
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
    if (primaryImageIndex === index) {
      setPrimaryImageIndex(0);
    } else if (primaryImageIndex > index) {
      setPrimaryImageIndex((prev) => prev - 1);
    }
  };

  const handleFinalSubmit = async () => {
    // At least one payment method must be enabled.
    if (!formData.allow_direct_payment && !formData.allow_cod) {
      showToast("error", "Select at least one payment method");
      return;
    }

    setIsSaving(true);
    try {
      const temple = temples.find((t) => t.id === formData.temple_id);

      if (editingPrasad) {
        // Update existing prasad
        const response = await fetch("/api/prasad", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingPrasad.id,
            temple_id: formData.temple_id,
            name: formData.name,
            price: formData.price,
            quantity: formData.quantity,
            ingredients: formData.ingredients || null,
            in_stock: formData.in_stock,
            display_order: formData.displayOrder,
            allow_direct_payment: formData.allow_direct_payment,
            allow_cod: formData.allow_cod,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to update prasad");
          return;
        }

        // Upload new images if any
        if (pendingImages.length > 0 && temple) {
          await uploadImages(editingPrasad.id, formData.name, temple.name);
        }

        showToast("success", "Prasad updated successfully");
      } else {
        // Create new prasad
        const response = await fetch("/api/prasad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temple_id: formData.temple_id,
            name: formData.name,
            price: formData.price,
            quantity: formData.quantity,
            ingredients: formData.ingredients || null,
            in_stock: formData.in_stock,
            display_order: formData.displayOrder,
            allow_direct_payment: formData.allow_direct_payment,
            allow_cod: formData.allow_cod,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to create prasad");
          return;
        }

        const data = await response.json();
        const newPrasadId = data.prasad.id;

        // Upload images
        if (pendingImages.length > 0 && temple) {
          await uploadImages(newPrasadId, formData.name, temple.name);
        }

        showToast("success", "Prasad created successfully");
      }

      await fetchPrasadItems();
      closeModal();
    } catch (error) {
      console.error("Failed to save prasad:", error);
      showToast("error", "Failed to save prasad");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadImages = async (
    prasadId: string,
    prasadName: string,
    templeName: string
  ) => {
    if (pendingImages.length === 0) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      pendingImages.forEach((file) => {
        formDataUpload.append("files", file);
      });
      formDataUpload.append("prasadId", prasadId);
      formDataUpload.append("prasadName", prasadName);
      formDataUpload.append("templeName", templeName);
      formDataUpload.append("primaryIndex", primaryImageIndex.toString());

      const response = await fetch("/api/prasad/upload", {
        method: "POST",
        body: formDataUpload,
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast("error", errorData.error || "Failed to upload images");
      }
    } catch (error) {
      console.error("Failed to upload images:", error);
      showToast("error", "Failed to upload images");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this prasad item?")) return;

    try {
      const response = await fetch(`/api/prasad?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", "Prasad deleted successfully");
        await fetchPrasadItems();
      } else {
        const errorData = await response.json();
        showToast("error", errorData.error || "Failed to delete prasad");
      }
    } catch (error) {
      console.error("Failed to delete prasad:", error);
      showToast("error", "Failed to delete prasad");
    }
  };

  const handleReorder = async (prasadId: string, newOrder: number) => {
    const prasad = prasadItems.find((p) => p.id === prasadId);
    if (!prasad) return;

    try {
      const response = await fetch("/api/prasad", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: prasadId,
          temple_id: prasad.temple_id,
          name: prasad.name,
          price: prasad.price,
          quantity: prasad.quantity,
          ingredients: prasad.ingredients,
          in_stock: prasad.in_stock,
          display_order: newOrder,
          allow_direct_payment: prasad.allow_direct_payment,
          allow_cod: prasad.allow_cod,
        }),
      });

      if (response.ok) {
        await fetchPrasadItems();
      }
    } catch (error) {
      console.error("Failed to reorder:", error);
    }
  };

  const openGallery = (prasad: PrasadItem) => {
    setGalleryPrasad(prasad);
  };

  const closeGallery = () => {
    setGalleryPrasad(null);
  };

  const setPrimaryImage = async (imageId: string, prasadId: string) => {
    try {
      const response = await fetch("/api/prasad/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, prasadId }),
      });

      if (response.ok) {
        showToast("success", "Primary image updated");
        await fetchPrasadItems();
        // Update gallery state
        const updatedPrasad = prasadItems.find((p) => p.id === prasadId);
        if (updatedPrasad) {
          setGalleryPrasad(updatedPrasad);
        }
      }
    } catch (error) {
      console.error("Failed to set primary image:", error);
      showToast("error", "Failed to set primary image");
    }
  };

  const deleteImage = async (imageId: string, prasadId: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const response = await fetch(
        `/api/prasad/upload?imageId=${imageId}&prasadId=${prasadId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        showToast("success", "Image deleted");
        await fetchPrasadItems();
        closeGallery();
      }
    } catch (error) {
      console.error("Failed to delete image:", error);
      showToast("error", "Failed to delete image");
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
            You need to create a temple first before adding prasad items.
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
          <h1 className="text-2xl font-bold text-foreground">Prasad Items</h1>
          <p className="text-sm text-gray-500">
            Manage prasad offerings for temples.
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
          Add Prasad
        </button>
      </div>

      {/* Prasad Items Grid */}
      {prasadItems.length === 0 ? (
        <div className="rounded-lg bg-card-bg p-8 text-center shadow-sm">
          <p className="text-gray-500">
            No prasad items found. Click "Add Prasad" to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prasadItems.map((prasad) => (
            <div
              key={prasad.id}
              className="relative overflow-hidden rounded-lg bg-card-bg shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Low Stock Warning Badge */}
              {prasad.quantity > 0 &&
                prasad.quantity <= LOW_STOCK_THRESHOLD && (
                  <div className="absolute left-2 top-2 z-10 rounded-full bg-yellow-500 px-2 py-1 text-xs font-medium text-white">
                    Low Stock ({prasad.quantity})
                  </div>
                )}

              {/* Out of Stock Badge */}
              {(prasad.quantity === 0 || !prasad.in_stock) && (
                <div className="absolute left-2 top-2 z-10 rounded-full bg-red-500 px-2 py-1 text-xs font-medium text-white">
                  Out of Stock
                </div>
              )}

              {/* Display Order Badge */}
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-black/50 px-2 py-1">
                <button
                  onClick={() =>
                    prasad.display_order > 1 &&
                    handleReorder(prasad.id, prasad.display_order - 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={prasad.display_order <= 1}
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
                  #{prasad.display_order}
                </span>
                <button
                  onClick={() =>
                    prasad.display_order < prasadItems.length &&
                    handleReorder(prasad.id, prasad.display_order + 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={prasad.display_order >= prasadItems.length}
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
              <div
                className="relative h-48 cursor-pointer bg-gray-100"
                onClick={() => openGallery(prasad)}
              >
                {prasad.image_url ? (
                  <Image
                    src={prasad.image_url}
                    alt={prasad.name}
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
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                      />
                    </svg>
                  </div>
                )}
                {/* Image count badge */}
                {prasad.prasad_images && prasad.prasad_images.length > 1 && (
                  <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                    +{prasad.prasad_images.length - 1} more
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="mb-1 text-xs text-gray-500">
                  {prasad.temples?.name}
                </div>
                <h3 className="font-semibold text-foreground">{prasad.name}</h3>
                <p className="text-lg font-bold text-brand-red">
                  ₹{prasad.price}
                </p>
                {prasad.ingredients && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                    {prasad.ingredients}
                  </p>
                )}
                {/* Payment methods */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {prasad.allow_direct_payment && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                      Direct Payment
                    </span>
                  )}
                  {prasad.allow_cod && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                      COD
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Qty: {prasad.quantity}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(prasad)}
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
                      onClick={() => handleDelete(prasad.id)}
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
          <div className="w-full max-w-lg overflow-hidden rounded-lg bg-card-bg shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-foreground">
                {editingPrasad ? "Edit Prasad" : "Add Prasad"} - Step {modalStep}{" "}
                of 2
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

            {/* Step Progress */}
            <div className="flex border-b border-gray-200">
              <div
                className={`flex-1 py-2 text-center text-sm font-medium ${
                  modalStep === 1
                    ? "border-b-2 border-brand-red text-brand-red"
                    : "text-gray-500"
                }`}
              >
                Details
              </div>
              <div
                className={`flex-1 py-2 text-center text-sm font-medium ${
                  modalStep === 2
                    ? "border-b-2 border-brand-red text-brand-red"
                    : "text-gray-500"
                }`}
              >
                Images
              </div>
            </div>

            {/* Modal Body with Sliding Animation */}
            <div className="relative overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{
                  transform: `translateX(-${(modalStep - 1) * 100}%)`,
                }}
              >
                {/* Step 1: Details */}
                <div className="w-full flex-shrink-0 p-6">
                  <div className="space-y-4">
                    {/* Temple */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Temple <span className="text-red-500">*</span>
                      </label>
                      {editingPrasad ? (
                        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                          {temples.find((t) => t.id === formData.temple_id)
                            ?.name || "Unknown Temple"}
                        </div>
                      ) : (
                        <select
                          value={formData.temple_id}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              temple_id: e.target.value,
                            })
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
                        placeholder="e.g., Laddu, Peda"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>

                    {/* Price and Quantity */}
                    <div className="grid grid-cols-2 gap-4">
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
                      <div>
                        <label className="mb-1 block text-sm font-medium text-foreground">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={formData.quantity}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              quantity: parseInt(e.target.value) || 0,
                            })
                          }
                          min="0"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                        />
                      </div>
                    </div>

                    {/* Ingredients */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Ingredients
                      </label>
                      <textarea
                        value={formData.ingredients}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ingredients: e.target.value,
                          })
                        }
                        placeholder="e.g., Besan, Sugar, Ghee"
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>

                    {/* Display Order and In Stock */}
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
                            checked={formData.in_stock}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                in_stock: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-gray-300 text-brand-red focus:ring-brand-red"
                          />
                          <span className="text-sm font-medium text-foreground">
                            In Stock
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Payment Options — applies to all prasad items */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-foreground">
                        Payment Options for Users{" "}
                        <span className="text-red-500">*</span>
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
                              Cash payment option at the time of delivery.
                            </span>
                          </span>
                        </label>
                      </div>
                      <p className="text-xs text-gray-400">
                        Selected payment methods will be visible to users on the
                        checkout page. At least one is required.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2: Images */}
                <div className="w-full flex-shrink-0 p-6">
                  <div className="space-y-4">
                    {/* Existing Images (for edit mode) */}
                    {editingPrasad &&
                      editingPrasad.prasad_images &&
                      editingPrasad.prasad_images.length > 0 && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-foreground">
                            Existing Images
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {editingPrasad.prasad_images.map((img) => (
                              <div key={img.id} className="relative">
                                <Image
                                  src={img.image_url}
                                  alt="Prasad"
                                  width={100}
                                  height={100}
                                  className="h-24 w-full rounded object-cover"
                                  unoptimized
                                />
                                {img.is_primary && (
                                  <div className="absolute left-1 top-1 rounded bg-yellow-500 px-1 py-0.5 text-xs text-white">
                                    Primary
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            Manage existing images from the gallery view.
                          </p>
                        </div>
                      )}

                    {/* Upload New Images */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        {editingPrasad ? "Add More Images" : "Upload Images"}
                      </label>
                      <div
                        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
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
                          className="mx-auto h-10 w-10 text-gray-400"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                          />
                        </svg>
                        <p className="mt-2 text-sm text-gray-500">
                          Drag & drop images or click to browse
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Pending Images Preview */}
                    {pendingImages.length > 0 && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Selected Images (click star to set primary)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {pendingImages.map((file, index) => (
                            <div key={index} className="group relative">
                              <Image
                                src={URL.createObjectURL(file)}
                                alt={`Preview ${index + 1}`}
                                width={100}
                                height={100}
                                className="h-24 w-full rounded object-cover"
                              />
                              {/* Primary star */}
                              <button
                                type="button"
                                onClick={() => setPrimaryImageIndex(index)}
                                className={`absolute left-1 top-1 rounded p-1 ${
                                  primaryImageIndex === index
                                    ? "bg-yellow-500 text-white"
                                    : "bg-black/50 text-white hover:bg-yellow-500"
                                }`}
                                title="Set as primary"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="h-4 w-4"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                              {/* Remove button */}
                              <button
                                type="button"
                                onClick={() => removePendingImage(index)}
                                className="absolute right-1 top-1 rounded bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
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
                              {/* Primary label */}
                              {primaryImageIndex === index && (
                                <div className="absolute bottom-1 left-1 rounded bg-yellow-500 px-1 py-0.5 text-xs text-white">
                                  Primary
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between border-t border-gray-200 px-6 py-4">
              {modalStep === 1 ? (
                <>
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStep1Submit}
                    className="rounded-lg bg-brand-red px-4 py-2 text-sm font-medium text-white hover:bg-brand-red-dark"
                  >
                    Next: Images
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setModalStep(1)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinalSubmit}
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
                      <>
                        {editingPrasad ? "Update" : "Create"} Prasad
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Modal */}
      {galleryPrasad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-card-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-foreground">
                {galleryPrasad.name} - Images
              </h2>
              <button
                onClick={closeGallery}
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
            <div className="p-6">
              {galleryPrasad.prasad_images &&
              galleryPrasad.prasad_images.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {galleryPrasad.prasad_images.map((img) => (
                    <div key={img.id} className="group relative">
                      <Image
                        src={img.image_url}
                        alt="Prasad"
                        width={200}
                        height={200}
                        className="h-40 w-full rounded-lg object-cover"
                        unoptimized
                      />
                      {img.is_primary && (
                        <div className="absolute left-2 top-2 rounded bg-yellow-500 px-2 py-1 text-xs font-medium text-white">
                          Primary
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        {!img.is_primary && (
                          <button
                            onClick={() =>
                              setPrimaryImage(img.id, galleryPrasad.id)
                            }
                            className="rounded bg-yellow-500 p-2 text-white hover:bg-yellow-600"
                            title="Set as primary"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="h-5 w-5"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => deleteImage(img.id, galleryPrasad.id)}
                          className="rounded bg-red-500 p-2 text-white hover:bg-red-600"
                          title="Delete"
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
                              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  No images for this prasad item.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
