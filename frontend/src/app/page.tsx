"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Root page: redirect based on auth state
export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(isAuthenticated ? "/gallery" : "/auth");
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg-base)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent"
          style={{
            borderColor: "var(--accent-violet)",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading Visual Vault...</p>
      </div>
    </div>
  );
}
