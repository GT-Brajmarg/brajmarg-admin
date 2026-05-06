"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin");

  useEffect(() => {
    // Fetch admin info from API
    const fetchAdminInfo = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          setAdminName(data.name || "Admin");
        }
      } catch (error) {
        console.error("Failed to fetch admin info:", error);
      }
    };

    fetchAdminInfo();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header
        adminName={adminName}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <main className="pt-16 lg:pl-64">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
