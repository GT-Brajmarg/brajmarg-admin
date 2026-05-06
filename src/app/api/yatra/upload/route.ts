import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// POST - Upload yatra package image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const yatraId = formData.get("yatraId") as string;
    const yatraName = formData.get("yatraName") as string;

    if (!file || !yatraId || !yatraName) {
      return NextResponse.json(
        { error: "file, yatraId, and yatraName are required" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${yatraName.replace(/[^a-zA-Z0-9]/g, "_")}/${Date.now()}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("brajmarg_yatra_images")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading image:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("brajmarg_yatra_images").getPublicUrl(fileName);

    // Update yatra package with image URL
    const { error: updateError } = await supabase
      .from("yatra_packages")
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", yatraId);

    if (updateError) {
      console.error("Error updating yatra package:", updateError);
      return NextResponse.json(
        { error: "Failed to update yatra package with image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error) {
    console.error("Error in POST /api/yatra/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete yatra package image
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yatraId = searchParams.get("yatraId");

    if (!yatraId) {
      return NextResponse.json(
        { error: "yatraId is required" },
        { status: 400 }
      );
    }

    // Get current image URL
    const { data: yatraPackage } = await supabase
      .from("yatra_packages")
      .select("image_url")
      .eq("id", yatraId)
      .single();

    if (yatraPackage?.image_url) {
      // Extract path from URL
      const urlParts = yatraPackage.image_url.split("/brajmarg_yatra_images/");
      if (urlParts[1]) {
        await supabase.storage
          .from("brajmarg_yatra_images")
          .remove([urlParts[1]]);
      }
    }

    // Clear image_url in database
    const { error } = await supabase
      .from("yatra_packages")
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq("id", yatraId);

    if (error) {
      console.error("Error clearing yatra package image:", error);
      return NextResponse.json(
        { error: "Failed to clear yatra package image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/yatra/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
