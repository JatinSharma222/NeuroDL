/**
 * src/app/doctor/page.jsx
 * ───────────────────────
 * Doctor-only page. Redirects patients away automatically.
 * Place this file at:  frontend/src/app/doctor/page.jsx
 */
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import DoctorDashboard from "./DoctorDashboard";
import Navbar from "../components/Navbar";

export default function DoctorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user)              { router.push("/login");  return; }
    if (user.role !== "doctor") { router.push("/");   return; }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "doctor") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid var(--color-border)",
          borderTop: "3px solid var(--color-primary)",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 80 }}>
        <DoctorDashboard />
      </main>
    </>
  );
}