import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// POST - Upload vehicle image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const vehicleId = formData.get("vehicleId") as string;
    const vehicleName = formData.get("vehicleName") as string;

    if (!file || !vehicleId || !vehicleName) {
      return NextResponse.json(
        { error: "file, vehicleId, and vehicleName are required" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${vehicleName.replace(/[^a-zA-Z0-9]/g, "_")}/${Date.now()}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("brajmarg_vehicle_images")
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
    } = supabase.storage.from("brajmarg_vehicle_images").getPublicUrl(fileName);

    // Update vehicle with image URL
    const { error: updateError } = await supabase
      .from("vehicles")
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", vehicleId);

    if (updateError) {
      console.error("Error updating vehicle:", updateError);
      return NextResponse.json(
        { error: "Failed to update vehicle with image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error) {
    console.error("Error in POST /api/vehicles/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete vehicle image
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get("vehicleId");

    if (!vehicleId) {
      return NextResponse.json(
        { error: "vehicleId is required" },
        { status: 400 }
      );
    }

    // Get current image URL
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("image_url")
      .eq("id", vehicleId)
      .single();

    if (vehicle?.image_url) {
      // Extract path from URL
      const urlParts = vehicle.image_url.split("/brajmarg_vehicle_images/");
      if (urlParts[1]) {
        await supabase.storage
          .from("brajmarg_vehicle_images")
          .remove([urlParts[1]]);
      }
    }

    // Clear image_url in database
    const { error } = await supabase
      .from("vehicles")
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq("id", vehicleId);

    if (error) {
      console.error("Error clearing vehicle image:", error);
      return NextResponse.json(
        { error: "Failed to clear vehicle image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/vehicles/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
