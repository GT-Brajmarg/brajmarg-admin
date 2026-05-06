"use client";

import { useState } from "react";

// Empty data - will be populated from API later
const stats = {
  totalUsers: 0,
  totalOrders: 0,
  totalRevenue: 0,
  activeOrders: 0,
};

const stockAlerts = {
  outOfStock: [] as { id: number; name: string }[],
  lowStock: [] as { id: number; name: string; quantity: number }[],
};

const recentOrders: { id: string; customer: string; amount: number; status: string; date: string }[] = [];

export default function DashboardPage() {
  const [dateFilter, setDateFilter] = useState<"all" | "custom">("all");
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Processing":
        return "bg-yellow-100 text-yellow-800";
      case "Shipped":
        return "bg-blue-100 text-blue-800";
      case "Delivered":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome back! Here&apos;s your store overview.</p>
      </div>

      {/* Date Filter */}
      <div className="rounded-lg bg-card-bg p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-gray-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span className="text-sm font-medium text-foreground">Date Filter:</span>
          </div>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as "all" | "custom")}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
          >
            <option value="all">All Time</option>
            <option value="custom">Custom Range</option>
          </select>

          {dateFilter === "custom" && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <div className="rounded-lg bg-card-bg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {stats.totalUsers.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-blue-100 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-blue-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
          </div>
          {dateFilter === "custom" && (
            <p className="mt-2 text-xs text-gray-400">Filtered by date range</p>
          )}
        </div>

        {/* Total Orders */}
        <div className="rounded-lg bg-card-bg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Orders</p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {stats.totalOrders.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-green-100 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-green-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
          </div>
          {dateFilter === "custom" && (
            <p className="mt-2 text-xs text-gray-400">Filtered by date range</p>
          )}
        </div>

        {/* Total Revenue */}
        <div className="rounded-lg bg-card-bg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {formatCurrency(stats.totalRevenue)}
              </p>
            </div>
            <div className="rounded-full bg-purple-100 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-purple-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9m6 3H9m3 6-3-3h1.5a3 3 0 1 0 0-6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
          </div>
          {dateFilter === "custom" && (
            <p className="mt-2 text-xs text-gray-400">Filtered by date range</p>
          )}
        </div>

        {/* Active Orders */}
        <div className="rounded-lg bg-card-bg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Orders</p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {stats.activeOrders}
              </p>
            </div>
            <div className="rounded-full bg-orange-100 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6 text-orange-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">Pending delivery</p>
        </div>
      </div>

      {/* Stock Alerts */}
      <div className="rounded-lg bg-card-bg p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-yellow-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <h2 className="text-lg font-semibold text-foreground">Stock Alerts</h2>
        </div>

        <div className="space-y-4">
          {stockAlerts.outOfStock.length === 0 && stockAlerts.lowStock.length === 0 ? (
            <p className="text-sm text-gray-500">No stock alerts at this time.</p>
          ) : (
            <>
              {/* Out of Stock */}
              {stockAlerts.outOfStock.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                      {stockAlerts.outOfStock.length}
                    </span>
                    <span className="text-sm font-medium text-red-600">Out of Stock</span>
                  </div>
                  <div className="ml-7 space-y-1">
                    {stockAlerts.outOfStock.map((item) => (
                      <p key={item.id} className="text-sm text-gray-600">
                        • {item.name}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Low Stock */}
              {stockAlerts.lowStock.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-white">
                      {stockAlerts.lowStock.length}
                    </span>
                    <span className="text-sm font-medium text-yellow-600">Low Stock</span>
                  </div>
                  <div className="ml-7 space-y-1">
                    {stockAlerts.lowStock.slice(0, 3).map((item) => (
                      <p key={item.id} className="text-sm text-gray-600">
                        • {item.name} <span className="text-yellow-600">({item.quantity} left)</span>
                      </p>
                    ))}
                    {stockAlerts.lowStock.length > 3 && (
                      <p className="text-sm text-gray-400">
                        ... and {stockAlerts.lowStock.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="rounded-lg bg-card-bg p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-gray-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">Recent Orders</h2>
          </div>
          <a
            href="/dashboard/orders"
            className="text-sm font-medium text-brand-red hover:text-brand-red-dark"
          >
            View All →
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-left text-xs font-medium uppercase text-gray-500">
                  Order ID
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase text-gray-500">
                  Customer
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase text-gray-500">
                  Amount
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="pb-3 text-left text-xs font-medium uppercase text-gray-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                    No orders yet
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="py-3 text-sm font-medium text-foreground">
                      #{order.id}
                    </td>
                    <td className="py-3 text-sm text-gray-600">{order.customer}</td>
                    <td className="py-3 text-sm font-medium text-foreground">
                      {formatCurrency(order.amount)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-500">{order.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
