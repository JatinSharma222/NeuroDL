"use client";
import React from "react";
import LoginForm from "../components/LoginForm";

const LoginPage = () => {
  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "var(--spacing-3xl) var(--spacing-lg)",
      }}
    >
      <LoginForm />
    </div>
  );
};

export default LoginPage;