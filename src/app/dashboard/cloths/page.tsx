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

interface ClothImage {
  id: string;
  cloth_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

interface ClothItem {
  id: string;
  temple_id: string;
  name: string;
  material: string | null;
  price: number;
  sizes: string[];
  colors: string[];
  quantity: number;
  image_url: string | null;
  in_stock: boolean;
  display_order: number;
  temples?: {
    name: string;
    location: string;
  };
  cloth_images?: ClothImage[];
}

// Size options (starting from 1)
const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "XS" },
  { value: "2", label: "S" },
  { value: "3", label: "M" },
  { value: "4", label: "L" },
  { value: "5", label: "XL" },
  { value: "6", label: "XXL" },
  { value: "7", label: "XXXL" },
  { value: "8", label: "Free Size" },
];

// Predefined colors
const PREDEFINED_COLORS = [
  { name: "Red", hex: "#EF4444" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Green", hex: "#22C55E" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#000000" },
  { name: "Orange", hex: "#F97316" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Purple", hex: "#A855F7" },
  { name: "Saffron", hex: "#FF9933" },
  { name: "Golden", hex: "#FFD700" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Maroon", hex: "#800000" },
  { name: "Cream", hex: "#FFFDD0" },
];

// Low stock warning threshold
const LOW_STOCK_THRESHOLD = 10;

export default function ClothsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [temples, setTemples] = useState<Temple[]>([]);
  const [clothItems, setClothItems] = useState<ClothItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [editingCloth, setEditingCloth] = useState<ClothItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // For image gallery modal
  const [galleryCloth, setGalleryCloth] = useState<ClothItem | null>(null);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  // Pending images for new cloth (before saving)
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);

  // Custom color input
  const [customColorInput, setCustomColorInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    temple_id: "",
    name: "",
    material: "",
    price: 0,
    quantity: 0,
    sizes: [] as string[],
    colors: [] as string[],
    in_stock: true,
    displayOrder: 1,
  });

  useEffect(() => {
    fetchTemples();
    fetchClothItems();
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

  const fetchClothItems = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/cloths");
      const data = await response.json();
      if (data.clothItems) {
        setClothItems(data.clothItems);
        return data.clothItems;
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch cloth items:", error);
      showToast("error", "Failed to load cloth items");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCloth(null);
    setFormData({
      temple_id: temples.length > 0 ? temples[0].id : "",
      name: "",
      material: "",
      price: 0,
      quantity: 0,
      sizes: [],
      colors: [],
      in_stock: true,
      displayOrder: clothItems.length + 1,
    });
    setCustomColorInput("");
    setPendingImages([]);
    setPrimaryImageIndex(0);
    setModalStep(1);
    setIsModalOpen(true);
  };

  const openEditModal = (cloth: ClothItem) => {
    setEditingCloth(cloth);
    setFormData({
      temple_id: cloth.temple_id,
      name: cloth.name,
      material: cloth.material || "",
      price: cloth.price,
      quantity: cloth.quantity,
      sizes: cloth.sizes || [],
      colors: cloth.colors || [],
      in_stock: cloth.in_stock,
      displayOrder: cloth.display_order,
    });
    setCustomColorInput("");
    setPendingImages([]);
    setPrimaryImageIndex(-1); // In edit mode, new images are not primary by default
    setModalStep(1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCloth(null);
    setPendingImages([]);
    setPrimaryImageIndex(0);
    setModalStep(1);
  };

  const toggleSize = (sizeValue: string) => {
    setFormData((prev) => ({
      ...prev,
      sizes: prev.sizes.includes(sizeValue)
        ? prev.sizes.filter((s) => s !== sizeValue)
        : [...prev.sizes, sizeValue],
    }));
  };

  const toggleColor = (colorName: string) => {
    setFormData((prev) => ({
      ...prev,
      colors: prev.colors.includes(colorName)
        ? prev.colors.filter((c) => c !== colorName)
        : [...prev.colors, colorName],
    }));
  };

  const addCustomColor = () => {
    const trimmed = customColorInput.trim();
    if (trimmed && !formData.colors.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        colors: [...prev.colors, trimmed],
      }));
      setCustomColorInput("");
    }
  };

  const handleCustomColorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomColor();
    }
  };

  const removeColor = (colorName: string) => {
    setFormData((prev) => ({
      ...prev,
      colors: prev.colors.filter((c) => c !== colorName),
    }));
  };

  const handleStep1Submit = () => {
    if (!formData.temple_id) {
      showToast("error", "Please select a temple");
      return;
    }
    if (!formData.name.trim()) {
      showToast("error", "Please enter a cloth name");
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
    setIsSaving(true);
    try {
      const temple = temples.find((t) => t.id === formData.temple_id);

      if (editingCloth) {
        // Update existing cloth
        const response = await fetch("/api/cloths", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCloth.id,
            temple_id: formData.temple_id,
            name: formData.name,
            material: formData.material || null,
            price: formData.price,
            sizes: formData.sizes,
            colors: formData.colors,
            quantity: formData.quantity,
            in_stock: formData.in_stock,
            display_order: formData.displayOrder,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to update cloth");
          return;
        }

        // Upload new images if any
        if (pendingImages.length > 0 && temple) {
          await uploadImages(editingCloth.id, formData.name, temple.name);
        }

        showToast("success", "Cloth updated successfully");
      } else {
        // Create new cloth
        const response = await fetch("/api/cloths", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            temple_id: formData.temple_id,
            name: formData.name,
            material: formData.material || null,
            price: formData.price,
            sizes: formData.sizes,
            colors: formData.colors,
            quantity: formData.quantity,
            in_stock: formData.in_stock,
            display_order: formData.displayOrder,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to create cloth");
          return;
        }

        const data = await response.json();
        const newClothId = data.cloth.id;

        // Upload images
        if (pendingImages.length > 0 && temple) {
          await uploadImages(newClothId, formData.name, temple.name);
        }

        showToast("success", "Cloth created successfully");
      }

      await fetchClothItems();
      closeModal();
    } catch (error) {
      console.error("Failed to save cloth:", error);
      showToast("error", "Failed to save cloth");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadImages = async (
    clothId: string,
    clothName: string,
    templeName: string
  ) => {
    if (pendingImages.length === 0) return;

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      pendingImages.forEach((file) => {
        formDataUpload.append("files", file);
      });
      formDataUpload.append("clothId", clothId);
      formDataUpload.append("clothName", clothName);
      formDataUpload.append("templeName", templeName);
      formDataUpload.append("primaryIndex", primaryImageIndex.toString());

      const response = await fetch("/api/cloths/upload", {
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
    if (!confirm("Are you sure you want to delete this cloth item?")) return;

    try {
      const response = await fetch(`/api/cloths?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showToast("success", "Cloth deleted successfully");
        await fetchClothItems();
      } else {
        const errorData = await response.json();
        showToast("error", errorData.error || "Failed to delete cloth");
      }
    } catch (error) {
      console.error("Failed to delete cloth:", error);
      showToast("error", "Failed to delete cloth");
    }
  };

  const handleReorder = async (clothId: string, newOrder: number) => {
    const cloth = clothItems.find((c) => c.id === clothId);
    if (!cloth) return;

    try {
      const response = await fetch("/api/cloths", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: clothId,
          temple_id: cloth.temple_id,
          name: cloth.name,
          material: cloth.material,
          price: cloth.price,
          sizes: cloth.sizes,
          colors: cloth.colors,
          quantity: cloth.quantity,
          in_stock: cloth.in_stock,
          display_order: newOrder,
        }),
      });

      if (response.ok) {
        await fetchClothItems();
      }
    } catch (error) {
      console.error("Failed to reorder:", error);
    }
  };

  const openGallery = (cloth: ClothItem) => {
    setGalleryCloth(cloth);
  };

  const closeGallery = () => {
    setGalleryCloth(null);
  };

  const setPrimaryImage = async (imageId: string, clothId: string) => {
    try {
      const response = await fetch("/api/cloths/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId, clothId }),
      });

      if (response.ok) {
        showToast("success", "Primary image updated");
        const updatedItems = await fetchClothItems();
        // Update gallery state with fresh data
        const updatedCloth = updatedItems.find((c: ClothItem) => c.id === clothId);
        if (updatedCloth) {
          setGalleryCloth(updatedCloth);
        }
      }
    } catch (error) {
      console.error("Failed to set primary image:", error);
      showToast("error", "Failed to set primary image");
    }
  };

  const deleteImage = async (imageId: string, clothId: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const response = await fetch(
        `/api/cloths/upload?imageId=${imageId}&clothId=${clothId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        showToast("success", "Image deleted");
        await fetchClothItems();
        closeGallery();
      }
    } catch (error) {
      console.error("Failed to delete image:", error);
      showToast("error", "Failed to delete image");
    }
  };

  const getSizeLabel = (sizeValue: string) => {
    const size = SIZE_OPTIONS.find((s) => s.value === sizeValue);
    return size?.label || sizeValue;
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
            You need to create a temple first before adding cloth items.
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
          <h1 className="text-2xl font-bold text-foreground">Cloth Items</h1>
          <p className="text-sm text-gray-500">
            Manage cloth offerings for temples.
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
          Add Cloth
        </button>
      </div>

      {/* Cloth Items Grid */}
      {clothItems.length === 0 ? (
        <div className="rounded-lg bg-card-bg p-8 text-center shadow-sm">
          <p className="text-gray-500">
            No cloth items found. Click "Add Cloth" to create one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clothItems.map((cloth) => (
            <div
              key={cloth.id}
              className="relative overflow-hidden rounded-lg bg-card-bg shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Low Stock Warning Badge */}
              {cloth.quantity > 0 &&
                cloth.quantity <= LOW_STOCK_THRESHOLD && (
                  <div className="absolute left-2 top-2 z-10 rounded-full bg-yellow-500 px-2 py-1 text-xs font-medium text-white">
                    Low Stock ({cloth.quantity})
                  </div>
                )}

              {/* Out of Stock Badge */}
              {(cloth.quantity === 0 || !cloth.in_stock) && (
                <div className="absolute left-2 top-2 z-10 rounded-full bg-red-500 px-2 py-1 text-xs font-medium text-white">
                  Out of Stock
                </div>
              )}

              {/* Display Order Badge */}
              <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded bg-black/50 px-2 py-1">
                <button
                  onClick={() =>
                    cloth.display_order > 1 &&
                    handleReorder(cloth.id, cloth.display_order - 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={cloth.display_order <= 1}
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
                  #{cloth.display_order}
                </span>
                <button
                  onClick={() =>
                    cloth.display_order < clothItems.length &&
                    handleReorder(cloth.id, cloth.display_order + 1)
                  }
                  className="text-white hover:text-gray-300 disabled:opacity-50"
                  disabled={cloth.display_order >= clothItems.length}
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
                onClick={() => openGallery(cloth)}
              >
                {cloth.image_url ? (
                  <Image
                    src={cloth.image_url}
                    alt={cloth.name}
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
                {cloth.cloth_images && cloth.cloth_images.length > 1 && (
                  <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                    +{cloth.cloth_images.length - 1} more
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="mb-1 text-xs text-gray-500">
                  {cloth.temples?.name}
                </div>
                <h3 className="font-semibold text-foreground">{cloth.name}</h3>
                <p className="text-lg font-bold text-brand-red">
                  ₹{cloth.price}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {cloth.sizes && cloth.sizes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cloth.sizes.slice(0, 4).map((size) => (
                        <span
                          key={size}
                          className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                        >
                          {getSizeLabel(size)}
                        </span>
                      ))}
                      {cloth.sizes.length > 4 && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          +{cloth.sizes.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {cloth.colors && cloth.colors.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cloth.colors.slice(0, 5).map((color) => {
                      const predefined = PREDEFINED_COLORS.find(
                        (c) => c.name === color
                      );
                      return (
                        <span
                          key={color}
                          className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                        >
                          {predefined && (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full border border-gray-300"
                              style={{ backgroundColor: predefined.hex }}
                            />
                          )}
                          {color}
                        </span>
                      );
                    })}
                    {cloth.colors.length > 5 && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                        +{cloth.colors.length - 5}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Qty: {cloth.quantity}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(cloth)}
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
                      onClick={() => handleDelete(cloth.id)}
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
                {editingCloth ? "Edit Cloth" : "Add Cloth"} - Step {modalStep}{" "}
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
                <div className="w-full flex-shrink-0 overflow-y-auto p-6" style={{ maxHeight: "calc(90vh - 180px)" }}>
                  <div className="space-y-4">
                    {/* Temple */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Temple <span className="text-red-500">*</span>
                      </label>
                      {editingCloth ? (
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
                        placeholder="e.g., Puja Dhoti, Chunri"
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

                    {/* Material */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Material
                      </label>
                      <input
                        type="text"
                        value={formData.material}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            material: e.target.value,
                          })
                        }
                        placeholder="e.g., Cotton, Silk, Polyester"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                      />
                    </div>

                    {/* Sizes */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Available Sizes
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SIZE_OPTIONS.map((size) => (
                          <button
                            key={size.value}
                            type="button"
                            onClick={() => toggleSize(size.value)}
                            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                              formData.sizes.includes(size.value)
                                ? "border-brand-red bg-brand-red text-white"
                                : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                            }`}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Colors */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Available Colors
                      </label>
                      {/* Predefined colors */}
                      <div className="flex flex-wrap gap-2">
                        {PREDEFINED_COLORS.map((color) => (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => toggleColor(color.name)}
                            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm transition-colors ${
                              formData.colors.includes(color.name)
                                ? "border-brand-red bg-brand-red/10"
                                : "border-gray-300 bg-white hover:border-gray-400"
                            }`}
                          >
                            <span
                              className="h-4 w-4 rounded-full border border-gray-300"
                              style={{ backgroundColor: color.hex }}
                            />
                            <span
                              className={
                                formData.colors.includes(color.name)
                                  ? "text-brand-red"
                                  : "text-gray-700"
                              }
                            >
                              {color.name}
                            </span>
                          </button>
                        ))}
                      </div>
                      {/* Custom color input */}
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={customColorInput}
                          onChange={(e) => setCustomColorInput(e.target.value)}
                          onKeyDown={handleCustomColorKeyDown}
                          placeholder="Add custom color..."
                          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
                        />
                        <button
                          type="button"
                          onClick={addCustomColor}
                          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                        >
                          Add
                        </button>
                      </div>
                      {/* Selected colors (including custom) */}
                      {formData.colors.length > 0 && (
                        <div className="mt-2">
                          <p className="mb-1 text-xs text-gray-500">
                            Selected colors:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {formData.colors.map((color) => {
                              const predefined = PREDEFINED_COLORS.find(
                                (c) => c.name === color
                              );
                              return (
                                <span
                                  key={color}
                                  className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs"
                                >
                                  {predefined && (
                                    <span
                                      className="h-3 w-3 rounded-full border border-gray-300"
                                      style={{ backgroundColor: predefined.hex }}
                                    />
                                  )}
                                  {color}
                                  <button
                                    type="button"
                                    onClick={() => removeColor(color)}
                                    className="ml-0.5 text-gray-500 hover:text-red-500"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
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
                  </div>
                </div>

                {/* Step 2: Images */}
                <div className="w-full flex-shrink-0 overflow-y-auto p-6" style={{ maxHeight: "calc(90vh - 180px)" }}>
                  <div className="space-y-4">
                    {/* Existing Images (for edit mode) */}
                    {editingCloth &&
                      editingCloth.cloth_images &&
                      editingCloth.cloth_images.length > 0 && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-foreground">
                            Existing Images
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {editingCloth.cloth_images.map((img) => (
                              <div key={img.id} className="relative">
                                <Image
                                  src={img.image_url}
                                  alt="Cloth"
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
                        {editingCloth ? "Add More Images" : "Upload Images"}
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
                        {editingCloth ? "Update" : "Create"} Cloth
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
      {galleryCloth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-card-bg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-foreground">
                {galleryCloth.name} - Images
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
              {galleryCloth.cloth_images &&
              galleryCloth.cloth_images.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {galleryCloth.cloth_images.map((img) => (
                    <div key={img.id} className="group relative">
                      <Image
                        src={img.image_url}
                        alt="Cloth"
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
                        <button
                          onClick={() => setViewingImageUrl(img.image_url)}
                          className="rounded bg-blue-500 p-2 text-white hover:bg-blue-600"
                          title="View full size"
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
                              d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                            />
                          </svg>
                        </button>
                        {!img.is_primary && (
                          <button
                            onClick={() =>
                              setPrimaryImage(img.id, galleryCloth.id)
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
                          onClick={() => deleteImage(img.id, galleryCloth.id)}
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
                  No images for this cloth item.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Size Image Viewer */}
      {viewingImageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setViewingImageUrl(null)}
        >
          <button
            onClick={() => setViewingImageUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
          <Image
            src={viewingImageUrl}
            alt="Full size"
            width={1200}
            height={800}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            unoptimized
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
