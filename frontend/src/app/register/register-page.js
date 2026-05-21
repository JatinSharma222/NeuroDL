"use client";
import React from "react";
import RegisterForm from "../components/RegisterForm";

const RegisterPage = () => {
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
      <RegisterForm />
    </div>
  );
};

export default RegisterPage;