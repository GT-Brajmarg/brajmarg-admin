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
- Trip packages linking to vehicles
- From/To locations with distance and duration
- Base price + per km pricing options
- Inclusions/Exclusions management
- Itinerary planning

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
│   │   └── yatra/
│   ├── dashboard/        # Dashboard pages
│   │   ├── temples/
│   │   ├── daily-timing/
│   │   ├── prasad/
│   │   ├── seva/
│   │   ├── frames/
│   │   ├── cloths/
│   │   ├── vehicles/
│   │   └── yatra/
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

## License

Private - Gelora Tech
