import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "brajmarg_prasad_images";

// POST - Upload multiple images to Supabase Storage and save to prasad_images table
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const prasadId = formData.get("prasadId") as string;
    const prasadName = formData.get("prasadName") as string;
    const templeName = formData.get("templeName") as string;
    const primaryIndex = parseInt(formData.get("primaryIndex") as string) || 0;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    if (!prasadId || !prasadName || !templeName) {
      return NextResponse.json(
        { error: "Prasad ID, prasad name, and temple name are required" },
        { status: 400 }
      );
    }

    // Sanitize names for folder path
    const sanitizedTempleName = templeName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .trim();
    const sanitizedPrasadName = prasadName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .trim();

    const uploadedImages: { url: string; isPrimary: boolean; displayOrder: number }[] = [];

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const imageId = crypto.randomUUID();
      // Path: temple_name/prasad_name/{image_id}.{ext}
      const filePath = `${sanitizedTempleName}/${sanitizedPrasadName}/${imageId}.${fileExt}`;

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error for file:", file.name, uploadError);
        continue; // Skip this file and continue with others
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const isPrimary = i === primaryIndex;

      // Insert into prasad_images table
      const { error: dbError } = await supabase
        .from("prasad_images")
        .insert({
          prasad_id: prasadId,
          image_url: publicUrl,
          is_primary: isPrimary,
          display_order: i,
        });

      if (dbError) {
        console.error("DB error for image:", dbError);
        // Try to delete the uploaded file since DB insert failed
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        continue;
      }

      uploadedImages.push({
        url: publicUrl,
        isPrimary,
        displayOrder: i,
      });

      // If this is the primary image, update the prasad_items.image_url
      if (isPrimary) {
        await supabase
          .from("prasad_items")
          .update({ image_url: publicUrl })
          .eq("id", prasadId);
      }
    }

    if (uploadedImages.length === 0) {
      return NextResponse.json(
        { error: "Failed to upload any images" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      images: uploadedImages,
      primaryUrl: uploadedImages.find((img) => img.isPrimary)?.url || uploadedImages[0]?.url,
    });
  } catch (error) {
    console.error("Error in POST /api/prasad/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific prasad image
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");
    const prasadId = searchParams.get("prasadId");

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    // Get the image data
    const { data: image } = await supabase
      .from("prasad_images")
      .select("image_url, is_primary")
      .eq("id", imageId)
      .single();

    if (!image) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Extract storage path from URL
    if (image.image_url && image.image_url.includes("brajmarg_prasad_images")) {
      const pathMatch = image.image_url.match(/brajmarg_prasad_images\/([^?]+)/);
      if (pathMatch) {
        const storagePath = pathMatch[1];
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      }
    }

    // Delete from database
    const { error } = await supabase
      .from("prasad_images")
      .delete()
      .eq("id", imageId);

    if (error) {
      console.error("Error deleting image:", error);
      return NextResponse.json(
        { error: "Failed to delete image" },
        { status: 500 }
      );
    }

    // If this was the primary image, set another image as primary or clear prasad_items.image_url
    if (image.is_primary && prasadId) {
      const { data: remainingImages } = await supabase
        .from("prasad_images")
        .select("id, image_url")
        .eq("prasad_id", prasadId)
        .order("display_order", { ascending: true })
        .limit(1);

      if (remainingImages && remainingImages.length > 0) {
        // Set the first remaining image as primary
        await supabase
          .from("prasad_images")
          .update({ is_primary: true })
          .eq("id", remainingImages[0].id);

        await supabase
          .from("prasad_items")
          .update({ image_url: remainingImages[0].image_url })
          .eq("id", prasadId);
      } else {
        // No more images, clear the image_url
        await supabase
          .from("prasad_items")
          .update({ image_url: null })
          .eq("id", prasadId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/prasad/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Set a new primary image
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageId, prasadId } = body;

    if (!imageId || !prasadId) {
      return NextResponse.json(
        { error: "Image ID and Prasad ID are required" },
        { status: 400 }
      );
    }

    // Get the new primary image URL
    const { data: newPrimaryImage } = await supabase
      .from("prasad_images")
      .select("image_url")
      .eq("id", imageId)
      .single();

    if (!newPrimaryImage) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Unset all other images as non-primary
    await supabase
      .from("prasad_images")
      .update({ is_primary: false })
      .eq("prasad_id", prasadId);

    // Set the new primary
    await supabase
      .from("prasad_images")
      .update({ is_primary: true })
      .eq("id", imageId);

    // Update prasad_items.image_url
    await supabase
      .from("prasad_items")
      .update({ image_url: newPrimaryImage.image_url })
      .eq("id", prasadId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in PUT /api/prasad/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
