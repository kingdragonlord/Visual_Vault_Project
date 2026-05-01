import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/Toaster";

export const metadata: Metadata = {
  title: "Visual Vault — AI Image Intelligence",
  description:
    "Upload images. Detect objects with YOLOv8. Search with natural language via CLIP. Transform with Stable Diffusion AI style transfer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
