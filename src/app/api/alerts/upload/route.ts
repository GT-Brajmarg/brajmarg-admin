import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createServiceClient } from "@/lib/supabase-admin";

// POST - Upload alert image
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const alertId = formData.get("alertId") as string;
    const alertTitle = formData.get("alertTitle") as string;

    if (!file || !alertId || !alertTitle) {
      return NextResponse.json(
        { error: "file, alertId, and alertTitle are required" },
        { status: 400 }
      );
    }

    // Storage writes need the service-role client: the publishable/anon key is
    // blocked by storage RLS on the brajmarg_alert_images bucket (insert denied).
    // Server-side only — never exposed to the browser. Falls back to the anon
    // client if the key isn't configured (will still fail RLS, but explicitly).
    const db = createServiceClient() ?? supabase;

    const fileExt = file.name.split(".").pop();
    const fileName = `${alertTitle.replace(/[^a-zA-Z0-9]/g, "_")}/${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await db.storage
      .from("brajmarg_alert_images")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading alert image:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = db.storage.from("brajmarg_alert_images").getPublicUrl(fileName);

    const imageUrl = `${publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await db
      .from("alerts")
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq("id", alertId);

    if (updateError) {
      console.error("Error updating alert with image:", updateError);
      return NextResponse.json(
        { error: "Failed to update alert with image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Error in POST /api/alerts/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Remove alert image
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get("alertId");

    if (!alertId) {
      return NextResponse.json(
        { error: "alertId is required" },
        { status: 400 }
      );
    }

    const db = createServiceClient() ?? supabase;

    const { data: alert } = await db
      .from("alerts")
      .select("image_url")
      .eq("id", alertId)
      .single();

    if (alert?.image_url) {
      const urlParts = alert.image_url.split("/brajmarg_alert_images/");
      if (urlParts[1]) {
        const path = urlParts[1].split("?")[0];
        await db.storage.from("brajmarg_alert_images").remove([path]);
      }
    }

    const { error } = await db
      .from("alerts")
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq("id", alertId);

    if (error) {
      console.error("Error clearing alert image:", error);
      return NextResponse.json(
        { error: "Failed to clear alert image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/alerts/upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
