# Admin Creation Script

This branch contains an interactive script to create admin users for the Brajmarg Admin Panel.

## Prerequisites

1. Create the `admins` table in Supabase (run in SQL Editor):

```sql
CREATE TABLE admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admins_email_lower ON admins (LOWER(email));
```

2. Make sure `.env.local` has valid Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

## Usage

Run the script:

```bash
npx tsx scripts/db-utils.ts
```

You will be prompted to enter:

1. **Email** - Admin's email address
2. **Name** - Admin's display name
3. **Password** - Minimum 8 characters (hidden while typing)
4. **Confirm Password** - Re-enter to confirm

## Example

```
$ npx tsx scripts/db-utils.ts

🔐 Admin Creation Tool
──────────────────────────────

Enter admin email: admin@brajmarg.com
Enter admin name: John Doe
Enter password: ********
Confirm password: ********

⏳ Creating admin...

✅ Admin created successfully!
──────────────────────────────
   ID:    a1b2c3d4-...
   Email: admin@brajmarg.com
   Name:  John Doe
```

## Notes

- Email is stored in lowercase and checked case-insensitively
- Password is hashed with bcrypt before storage
- Duplicate emails are rejected
- This script is for local/manual use only — not exposed via API
