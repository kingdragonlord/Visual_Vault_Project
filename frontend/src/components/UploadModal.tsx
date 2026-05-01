"use client";
import { useState, useCallback, useRef } from "react";
import { assetsApi, AssetUploadResponse } from "@/lib/api";
import { useToast } from "@/components/ui/Toaster";

interface UploadModalProps {
  onClose: () => void;
  onUploaded: (asset: AssetUploadResponse) => void;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      toast("Only image files are accepted", "error");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) accept(f);
  }, [accept]);

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await assetsApi.upload(file);
      toast("Image uploaded! Analysis queued ✨", "success");
      onUploaded(result);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast(msg, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg glass-strong overflow-hidden"
        style={{ animation: "slideInScale 0.25s ease" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
            Upload Image
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{
              color: "var(--text-muted)",
              background: "transparent",
              border: "1px solid var(--border)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Drop zone */}
          <div
            className="rounded-2xl cursor-pointer transition-all duration-200 relative overflow-hidden"
            style={{
              border: `2px dashed ${dragging ? "var(--accent-violet)" : file ? "var(--accent-cyan)" : "var(--border)"}`,
              background: dragging
                ? "rgba(124,58,237,0.07)"
                : file
                ? "rgba(6,182,212,0.05)"
                : "rgba(255,255,255,0.02)",
              minHeight: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            {file && preview ? (
              <div className="flex flex-col items-center gap-3 p-4 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Preview"
                  className="rounded-lg object-contain"
                  style={{ maxHeight: 160, maxWidth: "100%" }}
                />
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {file.name}
                  </span>
                  <span className="badge badge-completed">{formatBytes(file.size)}</span>
                  <button
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                    onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(124,58,237,0.15)" }}
                >
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 4v16M14 4L9 9M14 4l5 5" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 22h20" stroke="#06b6d4" strokeWidth="2.2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                    {dragging ? "Drop it!" : "Drop your image here"}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    or click to browse · JPG, PNG, WEBP · up to 10 MB
                  </p>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f); }}
          />
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!file || uploading}
            onClick={handleSubmit}
          >
            {uploading ? <><div className="spinner" /> Uploading...</> : "Upload & Analyze"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInScale {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
