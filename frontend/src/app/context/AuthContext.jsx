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
  // On 401, attempts a silent token refresh once before giving up.
  const authFetch = async (url, options = {}) => {
    const makeHeaders = (tok) => ({
      ...(options.headers || {}),
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    });

    // First attempt
    let res = await fetch(url, { ...options, headers: makeHeaders(token) });

    // If 401, try to refresh the token silently
    if (res.status === 401 && token) {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (refreshRes.ok) {
          const data     = await refreshRes.json();
          const newToken = data.token;
          // Persist the new token
          localStorage.setItem(TOKEN_KEY, newToken);
          setToken(newToken);
          // Retry the original request with new token
          res = await fetch(url, { ...options, headers: makeHeaders(newToken) });
        } else {
          // Refresh also failed — force logout
          logout();
        }
      } catch {
        logout();
      }
    }

    return res;
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