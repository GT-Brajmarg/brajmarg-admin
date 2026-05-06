"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [gstPercentage, setGstPercentage] = useState(18);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setMessage(null);

    // TODO: Implement actual save logic
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setMessage({ type: "success", text: "Settings saved successfully!" });
    setIsSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match!" });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters!" });
      return;
    }

    setIsSaving(true);

    // TODO: Implement actual password change logic
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setMessage({ type: "success", text: "Password changed successfully!" });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-gray-500">Manage your admin panel preferences.</p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded-md p-4 ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Low Stock Threshold */}
      <div className="rounded-lg bg-card-bg p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Stock Settings</h2>
        <div className="max-w-md">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Low Stock Threshold
          </label>
          <p className="mb-3 text-sm text-gray-500">
            Alert when product quantity falls below this number.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              max="100"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 1)}
              className="w-24 rounded-md border border-gray-300 px-4 py-2 text-foreground focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
            <span className="text-sm text-gray-500">units</span>
          </div>
        </div>
      </div>

      {/* Tax Settings */}
      <div className="rounded-lg bg-card-bg p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Tax Settings</h2>
        <div className="max-w-md">
          <label className="mb-2 block text-sm font-medium text-foreground">
            GST Percentage
          </label>
          <p className="mb-3 text-sm text-gray-500">
            Default GST percentage applied to products.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={gstPercentage}
              onChange={(e) => setGstPercentage(parseFloat(e.target.value) || 0)}
              className="w-24 rounded-md border border-gray-300 px-4 py-2 text-foreground focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="mt-6 rounded-md bg-brand-red px-6 py-2 font-medium text-white transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Change Password */}
      <div className="rounded-lg bg-card-bg p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Change Password</h2>
        <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-foreground focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-foreground focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-foreground focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-brand-red px-6 py-2 font-medium text-white transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
