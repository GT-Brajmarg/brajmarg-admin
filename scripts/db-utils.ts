/**
 * Data maintenance utility
 * Run: npx ts-node scripts/db-utils.ts
 */

import * as readline from "readline";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("   Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

function questionHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    
    let password = "";
    
    const onData = (char: Buffer) => {
      const c = char.toString("utf8");
      
      switch (c) {
        case "\n":
        case "\r":
        case "\u0004": // Ctrl+D
          if (stdin.isTTY) {
            stdin.setRawMode(wasRaw ?? false);
          }
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(password);
          break;
        case "\u0003": // Ctrl+C
          process.exit();
          break;
        case "\u007F": // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(prompt + "*".repeat(password.length));
          }
          break;
        default:
          password += c;
          process.stdout.write("*");
          break;
      }
    };
    
    stdin.on("data", onData);
  });
}

async function createAdmin() {
  console.log("\n🔐 Admin Creation Tool");
  console.log("─".repeat(30) + "\n");

  try {
    // Get email
    const email = await question("Enter admin email: ");
    if (!email || !email.includes("@")) {
      console.error("❌ Invalid email address");
      rl.close();
      process.exit(1);
    }

    // Check if email already exists
    const { data: existingAdmin } = await supabase
      .from("admins")
      .select("id")
      .ilike("email", email)
      .single();

    if (existingAdmin) {
      console.error("❌ An admin with this email already exists");
      rl.close();
      process.exit(1);
    }

    // Get name
    const name = await question("Enter admin name: ");
    if (!name || name.trim().length === 0) {
      console.error("❌ Name cannot be empty");
      rl.close();
      process.exit(1);
    }

    // Get password
    const password = await questionHidden("Enter password: ");
    if (!password || password.length < 8) {
      console.error("❌ Password must be at least 8 characters");
      rl.close();
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await questionHidden("Confirm password: ");
    if (password !== confirmPassword) {
      console.error("❌ Passwords do not match");
      rl.close();
      process.exit(1);
    }

    // Hash password
    console.log("\n⏳ Creating admin...");
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert into database
    const { data, error } = await supabase
      .from("admins")
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name: name.trim(),
      })
      .select("id, email, name")
      .single();

    if (error) {
      console.error("❌ Failed to create admin:", error.message);
      rl.close();
      process.exit(1);
    }

    console.log("\n✅ Admin created successfully!");
    console.log("─".repeat(30));
    console.log(`   ID:    ${data.id}`);
    console.log(`   Email: ${data.email}`);
    console.log(`   Name:  ${data.name}`);
    console.log("");

  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    rl.close();
  }
}

// Run
createAdmin();
