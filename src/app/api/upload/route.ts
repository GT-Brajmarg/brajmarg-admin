import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const BUCKET_NAME = "brajmarg_temple_images";

// POST - Upload image to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const templeId = formData.get("templeId") as string;
    const templeName = formData.get("templeName") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!templeId) {
      return NextResponse.json(
        { error: "Temple ID is required" },
        { status: 400 }
      );
    }

    if (!templeName) {
      return NextResponse.json(
        { error: "Temple name is required" },
        { status: 400 }
      );
    }

    // Sanitize temple name for folder path
    const sanitizedTempleName = templeName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .trim();

    // Get file extension
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    // Path: temple_name/{temple_id}.{ext}
    const filePath = `${sanitizedTempleName}/${templeId}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage with upsert to overwrite existing
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    // Get public URL with cache-busting timestamp
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Add cache-busting query param since we use upsert
    const publicUrlWithCacheBust = `${urlData.publicUrl}?t=${Date.now()}`;

    return NextResponse.json({
      url: publicUrlWithCacheBust,
      path: filePath,
    });
  } catch (error) {
    console.error("Error in POST /api/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete image from Supabase Storage
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
