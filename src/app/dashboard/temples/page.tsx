"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

interface Temple {
  id: string;
  name: string;
  location: string;
  description: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
  is_coming_soon: boolean;
}

export default function TemplesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [temples, setTemples] = useState<Temple[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [editingTemple, setEditingTemple] = useState<Temple | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageModalTemple, setImageModalTemple] = useState<Temple | null>(null);
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageModalFileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    description: "",
    image: "",
    displayOrder: 1,
    active: true,
    comingSoon: false,
  });

  // Check for action query param to auto-open create modal
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "create" && !isLoading) {
      openAddModal();
      // Clear the query param from URL
      router.replace("/dashboard/temples");
    }
  }, [searchParams, isLoading]);

  // Fetch temples from DB on page load
  useEffect(() => {
    fetchTemples();
  }, []);

  const fetchTemples = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/temples");
      const data = await response.json();
      if (data.temples) {
        setTemples(data.temples);
      } else if (data.error) {
        showToast("error", data.error || "Failed to load temples");
      }
    } catch (error) {
      console.error("Failed to fetch temples:", error);
      showToast("error", "Failed to load temples");
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingTemple(null);
    setFormData({
      name: "",
      location: "",
      description: "",
      image: "",
      displayOrder: temples.length + 1,
      active: true,
      comingSoon: false,
    });
    setModalStep(1);
    setIsModalOpen(true);
  };

  const openEditModal = (temple: Temple) => {
    setEditingTemple(temple);
    setFormData({
      name: temple.name,
      location: temple.location,
      description: temple.description || "",
      image: temple.image_url,
      displayOrder: temple.display_order,
      active: temple.is_active,
      comingSoon: temple.is_coming_soon,
    });
    setModalStep(1);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    // Revoke object URL if it was a preview
    if (formData.image && formData.image.startsWith("blob:")) {
      URL.revokeObjectURL(formData.image);
    }
    setIsModalOpen(false);
    setEditingTemple(null);
    setModalStep(1);
    setPendingImageFile(null);
  };

  const goToStep2 = () => {
    if (formData.name && formData.location) {
      setModalStep(2);
    }
  };

  const goToStep1 = () => {
    setModalStep(1);
  };

  const handleFileSelect = async (file: File) => {
    if (file && file.type.startsWith("image/")) {
      if (editingTemple) {
        // Editing existing temple - upload immediately with temple ID
        setIsUploading(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append("file", file);
          uploadFormData.append("templeId", editingTemple.id);
          uploadFormData.append("templeName", formData.name);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: uploadFormData,
          });

          if (response.ok) {
            const data = await response.json();
            setImageLoadError(false);
            setFormData({ ...formData, image: data.url });
            showToast("success", "Image uploaded successfully");
          } else {
            const errorData = await response.json();
            showToast("error", errorData.error || "Failed to upload image");
          }
        } catch (error) {
          console.error("Upload error:", error);
          showToast("error", "Failed to upload image");
        } finally {
          setIsUploading(false);
        }
      } else {
        // Creating new temple - store file for upload after creation
        setPendingImageFile(file);
        // Create a preview URL
        const previewUrl = URL.createObjectURL(file);
        setImageLoadError(false);
        setFormData({ ...formData, image: previewUrl });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const removeImage = () => {
    // Revoke object URL if it was a preview
    if (formData.image && formData.image.startsWith("blob:")) {
      URL.revokeObjectURL(formData.image);
    }
    setFormData({ ...formData, image: "" });
    setPendingImageFile(null);
    setImageLoadError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      if (editingTemple) {
        // Update existing temple (image already uploaded if changed)
        const response = await fetch("/api/temples", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingTemple.id,
            name: formData.name,
            location: formData.location,
            description: formData.description,
            image_url: formData.image,
            display_order: formData.displayOrder,
            is_active: formData.active,
            is_coming_soon: formData.comingSoon,
          }),
        });

        if (response.ok) {
          await fetchTemples();
          closeModal();
          showToast("success", "Temple updated successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to update temple");
        }
      } else {
        // Create new temple first (without image)
        const createResponse = await fetch("/api/temples", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            location: formData.location,
            description: formData.description,
            image_url: "", // Will be updated after upload
            display_order: formData.displayOrder,
            is_active: formData.active,
            is_coming_soon: formData.comingSoon,
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          showToast("error", errorData.error || "Failed to create temple");
          return;
        }

        const { temple: newTemple } = await createResponse.json();

        // If there's a pending image, upload it with the new temple ID
        if (pendingImageFile && newTemple?.id) {
          const uploadFormData = new FormData();
          uploadFormData.append("file", pendingImageFile);
          uploadFormData.append("templeId", newTemple.id);
          uploadFormData.append("templeName", formData.name);

          const uploadResponse = await fetch("/api/upload", {
            method: "POST",
            body: uploadFormData,
          });

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json();
            // Update temple with the image URL
            await fetch("/api/temples", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: newTemple.id,
                name: formData.name,
                location: formData.location,
                description: formData.description,
                image_url: uploadData.url,
                display_order: formData.displayOrder,
                is_active: formData.active,
                is_coming_soon: formData.comingSoon,
              }),
            });
          }
        }

        await fetchTemples();
        closeModal();
        showToast("success", "Temple created successfully");
      }
    } catch (error) {
      console.error("Failed to save temple:", error);
      showToast("error", "Failed to save temple");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this temple?")) {
      try {
        const response = await fetch(`/api/temples?id=${id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          await fetchTemples();
          showToast("success", "Temple deleted successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to delete temple");
        }
      } catch (error) {
        console.error("Failed to delete temple:", error);
        showToast("error", "Failed to delete temple");
      }
    }
  };

  // Image modal handlers
  const handleImageModalFileSelect = async (file: File) => {
    if (file && file.type.startsWith("image/") && imageModalTemple) {
      setIsUploading(true);
      try {
        // Upload to Supabase storage with temple ID
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        uploadFormData.append("templeId", imageModalTemple.id);
        uploadFormData.append("templeName", imageModalTemple.name);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: uploadFormData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          const newImageUrl = uploadData.url;

          // Update the temple image in DB
          const response = await fetch("/api/temples", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: imageModalTemple.id,
              name: imageModalTemple.name,
              location: imageModalTemple.location,
              description: imageModalTemple.description,
              image_url: newImageUrl,
              display_order: imageModalTemple.display_order,
              is_active: imageModalTemple.is_active,
              is_coming_soon: imageModalTemple.is_coming_soon,
            }),
          });

          if (response.ok) {
            await fetchTemples();
            setImageModalTemple({ ...imageModalTemple, image_url: newImageUrl });
            showToast("success", "Image updated successfully");
          } else {
            const errorData = await response.json();
            showToast("error", errorData.error || "Failed to update image");
          }
        } else {
          const errorData = await uploadResponse.json();
          showToast("error", errorData.error || "Failed to upload image");
        }
      } catch (error) {
        console.error("Failed to update image:", error);
        showToast("error", "Failed to update image");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleImageModalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsImageDragging(true);
  };

  const handleImageModalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsImageDragging(false);
  };

  const handleImageModalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsImageDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageModalFileSelect(file);
    }
  };

  const handleImageModalFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageModalFileSelect(file);
    }
  };

  const handleRemoveImage = async () => {
    if (imageModalTemple && confirm("Are you sure you want to remove this image?")) {
      setIsUploading(true);
      try {
        // Extract path from URL if it's a Supabase storage URL
        const imageUrl = imageModalTemple.image_url;
        if (imageUrl && imageUrl.includes("brajmarg_temple_images")) {
          // Extract path: everything after "brajmarg_temple_images/" (excluding query params)
          const pathMatch = imageUrl.match(/brajmarg_temple_images\/([^?]+)/);
          if (pathMatch) {
            const storagePath = pathMatch[1];
            // Delete from storage
            await fetch(`/api/upload?path=${encodeURIComponent(storagePath)}`, {
              method: "DELETE",
            });
          }
        }

        // Update temple to remove image URL
        const response = await fetch("/api/temples", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: imageModalTemple.id,
            name: imageModalTemple.name,
            location: imageModalTemple.location,
            description: imageModalTemple.description,
            image_url: "",
            display_order: imageModalTemple.display_order,
            is_active: imageModalTemple.is_active,
            is_coming_soon: imageModalTemple.is_coming_soon,
          }),
        });
        if (response.ok) {
          await fetchTemples();
          setImageModalTemple({ ...imageModalTemple, image_url: "" });
          showToast("success", "Image removed successfully");
        } else {
          const errorData = await response.json();
          showToast("error", errorData.error || "Failed to remove image");
        }
      } catch (error) {
        console.error("Failed to remove image:", error);
        showToast("error", "Failed to remove image");
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Temples</h1>
          <p className="text-sm text-gray-500">Manage temple listings.</p>
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
          Add Temple
        </button>
      </div>

      {/* Temples Table */}
      <div className="rounded-lg bg-card-bg shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  #
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Name
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Location
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Display Order
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin text-brand-red" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading temples...</span>
                    </div>
                  </td>
                </tr>
              ) : temples.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="mx-auto h-12 w-12 text-gray-400"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z"
                      />
                    </svg>
                    <p className="mt-4 text-lg font-medium">No temples yet</p>
                    <p className="mt-1 text-sm">
                      Click &quot;Add Temple&quot; to create your first temple listing.
                    </p>
                  </td>
                </tr>
              ) : (
                temples.map((temple, index) => (
                  <tr key={temple.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-medium text-gray-600">
                      {index + 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-foreground">
                        {temple.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {temple.location}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {temple.display_order || 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {temple.is_active && (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                            Active
                          </span>
                        )}
                        {temple.is_coming_soon && (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            Coming Soon
                          </span>
                        )}
                        {!temple.is_active && !temple.is_coming_soon && (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setImageModalTemple(temple)}
                          className={`relative rounded p-1 hover:bg-gray-100 ${temple.image_url ? "text-green-600" : "text-gray-500 hover:text-blue-600"}`}
                          title={temple.image_url ? "View/Change Image" : "Add Image"}
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
                              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                            />
                          </svg>
                          {temple.image_url && (
                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-green-500"></span>
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(temple)}
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
                          onClick={() => handleDelete(temple.id)}
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
          <div className="relative w-full max-w-xl" style={{ perspective: "1000px" }}>
            <div
              className="relative transition-transform duration-500"
              style={{
                transformStyle: "preserve-3d",
                transform: modalStep === 2 ? "rotateY(180deg)" : "rotateY(0deg)",
                minHeight: "580px",
              }}
            >
              {/* Step 1: Details Form */}
              <div
                className="absolute inset-0 flex w-full flex-col overflow-y-auto rounded-lg bg-card-bg p-6 shadow-xl"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {editingTemple ? "Edit Temple" : "Add Temple"}
                    </h2>
                    <p className="text-sm text-gray-500">Step 1 of 2 - Details</p>
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

                <div className="flex flex-1 flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Temple Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                        placeholder="Enter temple name"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Location *
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) =>
                          setFormData({ ...formData, location: e.target.value })
                        }
                        className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                        placeholder="Enter location"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                        placeholder="Enter temple description"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-foreground">
                        Display Order
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={temples.length + (editingTemple ? 0 : 1)}
                        value={formData.displayOrder}
                        onChange={(e) =>
                          setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 1 })
                        }
                        className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {editingTemple 
                          ? `Current order: ${editingTemple.display_order}. Change to reorder temples.`
                          : `Will be added at position ${formData.displayOrder}. Other temples will shift accordingly.`
                        }
                      </p>
                    </div>

                    <div className="flex gap-6">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={formData.active}
                          onChange={(e) =>
                            setFormData({ ...formData, active: e.target.checked })
                          }
                          className="h-5 w-5 rounded border-gray-300 text-brand-red focus:ring-brand-red"
                        />
                        <span className="text-sm font-medium text-foreground">Active</span>
                      </label>

                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={formData.comingSoon}
                          onChange={(e) =>
                            setFormData({ ...formData, comingSoon: e.target.checked })
                          }
                          className="h-5 w-5 rounded border-gray-300 text-brand-red focus:ring-brand-red"
                        />
                        <span className="text-sm font-medium text-foreground">Coming Soon</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-md border border-gray-300 px-4 py-2 font-medium text-foreground hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={goToStep2}
                      disabled={!formData.name || !formData.location}
                      className="rounded-md bg-brand-red px-4 py-2 font-medium text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Image Upload */}
              <div
                className="absolute inset-0 flex w-full flex-col rounded-lg bg-card-bg p-6 shadow-xl"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {editingTemple ? "Edit Temple" : "Add Temple"}
                    </h2>
                    <p className="text-sm text-gray-500">Step 2 of 2 - Upload Image</p>
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

                <div className="flex flex-1 flex-col justify-between">
                  {/* Image Upload Area */}
                  {isUploading ? (
                    <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300">
                      <svg className="h-10 w-10 animate-spin text-brand-red" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="mt-3 text-sm text-gray-500">Uploading image...</p>
                    </div>
                  ) : formData.image ? (
                    <div className="relative">
                      {imageLoadError ? (
                        <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-red-300 bg-red-50">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mb-2 h-10 w-10 text-red-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                          </svg>
                          <p className="text-sm font-medium text-red-600">Image failed to load</p>
                          <p className="mt-1 text-xs text-red-500">Storage bucket may not be public</p>
                          <button
                            type="button"
                            onClick={removeImage}
                            className="mt-3 rounded-md bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                          >
                            Remove & Try Again
                          </button>
                        </div>
                      ) : (
                        <>
                          <img
                            src={formData.image}
                            alt="Temple preview"
                            className="h-64 w-full rounded-lg object-cover"
                            onError={() => setImageLoadError(true)}
                          />
                          <button
                            type="button"
                            onClick={removeImage}
                            className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
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
                        </>
                      )}
                    </div>
                  ) : (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                        isDragging
                          ? "border-brand-red bg-brand-red/5"
                          : "border-gray-300 hover:border-brand-red hover:bg-gray-50"
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="mb-3 h-12 w-12 text-gray-400"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                        />
                      </svg>
                      <p className="mb-1 text-sm font-medium text-foreground">
                        Drag & drop your image here
                      </p>
                      <p className="text-xs text-gray-500">or click to browse</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </div>
                  )}

                  <div className="flex justify-between gap-3 pt-4">
                    <button
                      type="button"
                      onClick={goToStep1}
                      disabled={isSaving || isUploading}
                      className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 font-medium text-foreground hover:bg-gray-50 disabled:opacity-50"
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
                          d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                        />
                      </svg>
                      Back
                    </button>
                    <div className="flex gap-3">
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
                        disabled={!formData.image || isSaving || isUploading}
                        className="flex items-center gap-2 rounded-md bg-brand-red px-4 py-2 font-medium text-white hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving && (
                          <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {isSaving ? "Saving..." : editingTemple ? "Update" : "Create"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image View/Edit Modal */}
      {imageModalTemple && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-card-bg p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Temple Image</h2>
                <p className="text-sm text-gray-500">{imageModalTemple.name}</p>
              </div>
              <button
                onClick={() => setImageModalTemple(null)}
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

            {isUploading ? (
              <div className="flex h-64 flex-col items-center justify-center">
                <svg className="h-10 w-10 animate-spin text-brand-red" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-3 text-sm text-gray-500">Uploading image...</p>
              </div>
            ) : imageModalTemple.image_url ? (
              <div className="space-y-4">
                <div className="relative">
                  <img
                    src={imageModalTemple.image_url}
                    alt={imageModalTemple.name}
                    className="h-64 w-full rounded-lg object-cover"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="flex-1 rounded-md border border-red-300 px-4 py-2 font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove Image
                  </button>
                  <button
                    type="button"
                    onClick={() => imageModalFileInputRef.current?.click()}
                    className="flex-1 rounded-md bg-brand-red px-4 py-2 font-medium text-white hover:bg-brand-red-dark"
                  >
                    Change Image
                  </button>
                </div>
                <input
                  ref={imageModalFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageModalFileInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  onDragOver={handleImageModalDragOver}
                  onDragLeave={handleImageModalDragLeave}
                  onDrop={handleImageModalDrop}
                  onClick={() => imageModalFileInputRef.current?.click()}
                  className={`flex h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                    isImageDragging
                      ? "border-brand-red bg-brand-red/5"
                      : "border-gray-300 hover:border-brand-red hover:bg-gray-50"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="mb-3 h-12 w-12 text-gray-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                    />
                  </svg>
                  <p className="mb-1 text-sm font-medium text-foreground">
                    Drag & drop your image here
                  </p>
                  <p className="text-xs text-gray-500">or click to browse</p>
                  <input
                    ref={imageModalFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageModalFileInputChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setImageModalTemple(null)}
                disabled={isUploading}
                className="rounded-md border border-gray-300 px-4 py-2 font-medium text-foreground hover:bg-gray-50 disabled:opacity-50"
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
