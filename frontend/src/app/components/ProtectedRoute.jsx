"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute.jsx
 * ──────────────────
 * Wraps any page that requires authentication.
 * Redirects to /login if no valid JWT is found.
 *
 * Usage in a page:
 *   export default function HistoryPage() {
 *     return (
 *       <ProtectedRoute>
 *         <HistoryTable />
 *       </ProtectedRoute>
 *     );
 *   }
 */

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Show spinner while checking auth state
  if (loading) {
    return (
      <div
        style={{
          minHeight:      "100vh",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexDirection:  "column",
          gap:            16,
        }}
      >
        <div
          style={{
            width:        48,
            height:       48,
            borderRadius: "50%",
            border:       "3px solid var(--color-border)",
            borderTop:    "3px solid var(--color-primary)",
            animation:    "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "var(--color-text-light)", fontSize: "0.9rem" }}>
          Checking session...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not logged in — render nothing while redirect happens
  if (!user) return null;

  return <>{children}</>;
};

export default ProtectedRoute;