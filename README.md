# Brajmarg Admin Panel

Admin dashboard for managing Brajmarg temple services, offerings, and yatra packages.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage

## Features

### Temple Management
- Create and manage multiple temples
- Temple images, descriptions, and display order
- Active/Coming Soon status

### Daily Timing
- Configure opening/closing times per day of week
- Special notes and labels for each timing slot

### Prasad Management
- Multi-image upload with primary image selection
- Ingredients, pricing, and stock tracking
- Low stock warnings (≤10) and out of stock badges

### Seva Management
- Seva offerings with time, details, and significance
- Pricing and active status management

### Frames Management
- Photo frames with material and size options
- Multi-image support with stock tracking

### Cloths Management
- Multiple sizes (XS to Free Size)
- Color options with predefined palette + custom colors
- Multi-image upload with quantity tracking

### Vehicles Management
- Fleet management for yatra services
- Vehicle type, seating capacity, AC status
- Custom features list

### Yatra Packages
- Two package types, chosen on **Add Package** and **fixed for life**:
  - **Solo** — full private vehicle, available any day, single base price (+ per km).
  - **Group** — seat-based shared yatra on a weekly recurring schedule, priced per seat.
- Group packages add a Weekly Schedule & Seat Management section: recurring weekdays
  (with a "starts on X, runs N days" auto-selector), departure/arrival times, and a
  per-week seat count (rolling: availability resets each week).
- Package type cannot be changed after creation (enforced in the API, not just the UI)
  to prevent pricing/booking conflicts.
- From/To locations with distance and duration
- Inclusions/Exclusions management and itinerary planning

### Alerts / Notifications
- Time-bound announcements (festival, closure, darshan, timing, general)
- Global or temple-specific alerts
- Priority levels (info, important, urgent)
- Optional image and CTA link
- Active status and display order

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project with required tables and storage buckets

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret
JWT_ALGORITHM=HS256
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
```

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/
│   │   ├── temples/
│   │   ├── daily-timing/
│   │   ├── prasad/
│   │   ├── seva/
│   │   ├── frames/
│   │   ├── cloths/
│   │   ├── vehicles/
│   │   ├── yatra/
│   │   └── alerts/
│   ├── dashboard/        # Dashboard pages
│   │   ├── temples/
│   │   ├── daily-timing/
│   │   ├── prasad/
│   │   ├── seva/
│   │   ├── frames/
│   │   ├── cloths/
│   │   ├── vehicles/
│   │   ├── yatra/
│   │   └── alerts/
│   └── page.tsx          # Login page
├── components/           # Reusable components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Toast.tsx
└── lib/
    └── supabase.ts       # Supabase client & types
```

## Supabase Storage Buckets

- `brajmarg_temple_images`
- `brajmarg_prasad_images`
- `brajmarg_frames_images`
- `brajmarg_cloth_images`
- `brajmarg_vehicle_images`
- `brajmarg_yatra_images`
- `brajmarg_alert_images`

## Database Setup (Alerts)

Run `supabase/alerts.sql` in the Supabase SQL Editor to create the `alerts` table and policies.

## Database Setup (Group Yatra Packages)

Run the **UP** block of `supabase/yatra_group_packages.sql` in the Supabase SQL Editor.
It adds `package_type` (defaults all existing rows to `solo`) plus the group-only
scheduling columns to `yatra_packages`. Apply it **before** deploying the matching code.
The file also contains a commented **DOWN** block for rollback.

## Database Setup (Product Payment Options)

Run the **UP** block of `supabase/product_payment_options.sql` in the Supabase SQL Editor.
It adds `allow_direct_payment` + `allow_cod` flags (both default `true`) to `cloth_items`,
`prasad_items`, `frame_items`, and `seva_items`, so the admin can set which payment methods
each item accepts. The storefront reads these at checkout; order-level payment status lives
on the `orders` table and is unaffected. Apply **before** deploying the matching code.

## License

Private - Gelora Tech
