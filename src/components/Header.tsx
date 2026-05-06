"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface HeaderProps {
  adminName: string;
  onMenuClick: () => void;
}

export default function Header({ adminName, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 bg-header-bg px-4 shadow-sm">
      {/* Left side - Menu button & Logo */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-foreground hover:bg-gray-100 lg:hidden"
          aria-label="Toggle menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-6 w-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>

        {/* Logo */}
        <Image
          src="/brajmarg_login_logo.png"
          alt="Brajmarg"
          width={56}
          height={16}
          className="object-contain"
          priority
        />
      </div>

      {/* Right side - Admin info & Logout */}
      <div className="flex items-center gap-4">
        {/* Admin name */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-red text-sm font-medium text-white">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-sm font-medium text-foreground sm:block">
            {adminName}
          </span>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
            />
          </svg>
          <span className="hidden sm:inline">
            {isLoggingOut ? "Logging out..." : "Logout"}
          </span>
        </button>
      </div>
    </header>
  );
}
