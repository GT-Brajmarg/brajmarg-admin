import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase, Admin } from "@/lib/supabase";
import { createToken, setAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Query admin by email (case-insensitive)
    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .ilike("email", email)
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const adminData = admin as Admin;

    // Verify password (case-sensitive)
    const isValidPassword = await bcrypt.compare(password, adminData.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await createToken({
      adminId: adminData.id,
      email: adminData.email,
      name: adminData.name,
    });

    // Set auth cookie
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      admin: {
        id: adminData.id,
        email: adminData.email,
        name: adminData.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
