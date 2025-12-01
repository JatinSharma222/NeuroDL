"use client";

import React from "react";
import Link from "next/link";
import { cn } from "../lib/utils";

export default function Navbar({ className }) {
  return (
    <nav className={cn("fixed top-0 inset-x-0 mx-auto z-50 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 shadow-2xl p-5", className)}>
      <div className="flex justify-center">
        <Link 
          href="/" 
          className="px-8 py-3 text-2xl font-bold rounded-lg transition-all duration-300 text-white hover:bg-gray-700 hover:scale-105"
        >
          NeuroDL
        </Link>
      </div>
    </nav>
  );
}