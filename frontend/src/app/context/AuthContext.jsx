"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * AuthContext.jsx
 * ───────────────
 * Global authentication state for NeuroDL.
 *
 * Stores JWT in localStorage under "neurodl_token".
 * Exposes: user, token, login(), logout(), loading
 *
 * Usage:
 *   const { user, login, logout, loading } = useAuth();
 */

const AuthContext = createContext(null);

const TOKEN_KEY = "neurodl_token";
const USER_KEY  = "neurodl_user";

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // ── Restore session from localStorage on mount ────────────────
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser  = localStorage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // Corrupted storage — clear it
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── login — called after successful /auth/login or /auth/register ──
  const login = (tokenStr, userData) => {
    localStorage.setItem(TOKEN_KEY, tokenStr);
    localStorage.setItem(USER_KEY,  JSON.stringify(userData));
    setToken(tokenStr);
    setUser(userData);
  };

  // ── logout — clear state and redirect to landing ──────────────
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    router.push("/");
  };

  // ── authFetch — wrapper that adds Authorization header ─────────
  const authFetch = async (url, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};