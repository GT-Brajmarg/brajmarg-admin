export default function OrdersPage() {
  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-sm text-gray-500">Manage and track all orders.</p>
      </div>

      {/* Placeholder */}
      <div className="flex h-64 items-center justify-center rounded-lg bg-card-bg shadow-sm">
        <div className="text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="mx-auto h-12 w-12 text-gray-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
            />
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-500">Orders page coming soon</p>
          <p className="mt-1 text-sm text-gray-400">
            This page will display all orders with filters and management options.
          </p>
        </div>
      </div>
    </div>
  );
}
