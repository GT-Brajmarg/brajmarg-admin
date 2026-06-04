"use client";

import { useState } from "react";

import OrdersPage from "../orders/page";
import YatraBookingsPage from "../yatra-bookings/page";
import PrasadOrdersPage from "../transactions/prasad-orders/page";
import SevaOrdersPage from "../transactions/seva-orders/page";

type Tab = "orders" | "prasad" | "seva" | "bookings";

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  const [stats, setStats] = useState({
    totalOrders: 0,
    revenue: 0,
    onlineOrders: 0,
    codOrders: 0,
    pendingOrders: 0,
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            Orders & Bookings
          </h1>

          <p className="mt-2 text-gray-500">
            Manage product orders, prasad orders, seva bookings, and yatra
            bookings from one place.
          </p>
        </div>

        {/* <div className="flex gap-3">
          <button className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm">
            Date Range
          </button>

          <button className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium shadow-sm">
            Export
          </button>
        </div> */}
      </div>

      {/* TABS */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all ${
            activeTab === "orders"
              ? "bg-brand-red text-white"
              : "border border-gray-200 bg-white"
          }`}
        >
          Product Orders
        </button>

        <button
          onClick={() => setActiveTab("bookings")}
          className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all ${
            activeTab === "bookings"
              ? "bg-brand-red text-white"
              : "border border-gray-200 bg-white"
          }`}
        >
          Yatra Bookings
        </button>
        <button
          onClick={() => setActiveTab("prasad")}
          className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all ${
            activeTab === "prasad"
              ? "bg-brand-red text-white"
              : "border border-gray-200 bg-white"
          }`}
        >
          Prasad Orders
        </button>

        <button
          onClick={() => setActiveTab("seva")}
          className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all ${
            activeTab === "seva"
              ? "bg-brand-red text-white"
              : "border border-gray-200 bg-white"
          }`}
        >
          Seva Orders
        </button>
      </div>

      {/* STATS CARDS */}
      {["orders"].includes(activeTab) && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon="📦"
            title="Total Orders"
            value={stats.totalOrders.toString()}
            subtitle="All product orders"
          />

          <StatCard
            icon="💰"
            title="Revenue"
            value={`₹${stats.revenue.toLocaleString()}`}
            subtitle="From all orders"
          />

          <StatCard
            icon="💳"
            title="Online Orders"
            value={stats.onlineOrders.toString()}
            subtitle="Paid online"
          />

          <StatCard
            icon="🚚"
            title="COD Orders"
            value={stats.codOrders.toString()}
            subtitle="Cash on delivery"
          />

          <StatCard
            icon="⏳"
            title="Pending Orders"
            value={stats.pendingOrders.toString()}
            subtitle="Awaiting confirmation"
          />
        </div>
      )}

      {/* CONTENT */}
      <div className="overflow-hidden rounded-2xl">
        {activeTab === "orders" && <OrdersPage onStatsChange={setStats} />}

        {activeTab === "prasad" && <PrasadOrdersPage />}

        {activeTab === "seva" && <SevaOrdersPage />}

        {activeTab === "bookings" && <YatraBookingsPage />}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: string;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-base">
        {icon}
      </div>

      <p className="text-[11px] font-medium text-gray-500">{title}</p>

      <h3 className="mt-1 text-xl font-bold">{value}</h3>

      <p className="text-[10px] text-gray-400">{subtitle}</p>
    </div>
  );
}
