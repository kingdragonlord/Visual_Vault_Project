"use client";
import { useState, useRef, useCallback } from "react";
import { Asset, assetsApi, getToken, inferenceApi, Detection } from "@/lib/api";
import AuthImage from "@/components/AuthImage";
import BBoxCanvas from "@/components/BBoxCanvas";
import { useToast } from "@/components/ui/Toaster";

interface AssetDetailModalProps {
  asset: Asset;
  onClose: () => void;
  onStyleStudio: (asset: Asset) => void;
}

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "badge-pending",
    processing: "badge-processing",
    completed: "badge-completed",
    failed: "badge-failed",
  };
  return <span className={`badge ${map[status] ?? "badge-pending"}`}>{status}</span>;
}

export default function AssetDetailModal({
  asset,
  onClose,
  onStyleStudio,
}: AssetDetailModalProps) {
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [bboxVisible, setBboxVisible] = useState(true);
  const [liveDetections, setLiveDetections] = useState<Detection[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const { toast } = useToast();

  const handleLiveDetection = async () => {
    if (!imgRef.current?.src) return;
    setDetecting(true);
    try {
      const res = await fetch(imgRef.current.src);
      const blob = await res.blob();
      const prediction = await inferenceApi.predict(blob);
      setLiveDetections(prediction.detections);
      setBboxVisible(true);
    } catch (err: unknown) {
      toast("Live detection failed.", "error");
    } finally {
      setDetecting(false);
    }
  };

  // Called when AuthImage finishes loading — lets BBoxCanvas know the img element is ready
  const handleImageLoad = useCallback(() => {
    setImageEl(imgRef.current);
  }, []);

  const handleDownload = async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(assetsApi.fileUrl(asset.id), { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = asset.original_filename; a.click();
    URL.revokeObjectURL(url);
  };

  const labels = asset.ml_labels ?? [];
  const colors = asset.ml_colors ?? [];
  const detectionsToShow = liveDetections ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-5xl glass-strong overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh", animation: "slideInScale 0.25s ease" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all"
          style={{
            color: "var(--text-muted)",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid var(--border)",
          }}
        >
          ✕
        </button>

        <div className="flex flex-col lg:flex-row overflow-hidden" style={{ flex: 1 }}>
          {/* ── Image panel ── */}
          <div
            className="flex-1 flex flex-col p-6 gap-4"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            <div
              className="relative rounded-2xl overflow-hidden flex-1 flex items-center justify-center"
              style={{
                background: "rgba(0,0,0,0.4)",
                minHeight: 300,
                maxHeight: 480,
              }}
            >
              <AuthImage
                assetId={asset.id}
                alt={asset.original_filename}
                ref={(el: HTMLImageElement | null) => { imgRef.current = el; }}
                onLoad={handleImageLoad}
                className="max-w-full max-h-full object-contain rounded-xl"
                style={{ display: "block" }}
              />
              <BBoxCanvas
                detections={detectionsToShow}
                imageEl={imageEl}
                visible={bboxVisible}
              />
            </div>

            {/* Image actions */}
            <div className="flex items-center gap-3 flex-wrap">
              {liveDetections ? (
                <button
                  className="btn-ghost text-sm"
                  onClick={() => setBboxVisible(!bboxVisible)}
                >
                  {bboxVisible ? "🔲 Hide Boxes" : "🔳 Show Boxes"}
                </button>
              ) : (
                <button
                  className="btn-cyan text-sm"
                  onClick={handleLiveDetection}
                  disabled={detecting}
                >
                  {detecting ? "⏳ Detecting..." : "🔍 Live Detection"}
                </button>
              )}
              <button
                className="btn-cyan text-sm"
                onClick={() => onStyleStudio(asset)}
              >
                🎨 Style Transfer
              </button>
              <button className="btn-ghost text-sm" onClick={handleDownload}>
                ⬇ Download
              </button>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div
            className="w-full lg:w-80 flex flex-col overflow-y-auto p-6 gap-6"
          >
            {/* Title */}
            <div>
              <h2
                className="font-bold text-lg mb-1 truncate"
                style={{ color: "var(--text-primary)" }}
                title={asset.original_filename}
              >
                {asset.original_filename}
              </h2>
              <StatusBadge status={asset.status} />
            </div>

            {/* Meta grid */}
            <div
              className="grid grid-cols-2 gap-3 rounded-xl p-4"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              {[
                { label: "Dimensions", value: asset.width && asset.height ? `${asset.width} × ${asset.height}` : "—" },
                { label: "File Size", value: formatBytes(asset.file_size) },
                { label: "Type", value: asset.content_type.split("/")[1]?.toUpperCase() ?? "—" },
                { label: "Detections", value: String(labels.length) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Detected labels */}
            {labels.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-muted)" }}>
                  Detected Objects
                </h4>
                <div className="flex flex-wrap gap-2">
                  {labels.map((l) => (
                    <span
                      key={l}
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: "rgba(124,58,237,0.15)",
                        color: "var(--accent-violet-light)",
                        border: "1px solid rgba(124,58,237,0.3)",
                      }}
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Color swatches */}
            {colors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-muted)" }}>
                  Dominant Colors
                </h4>
                <div className="flex gap-2 flex-wrap">
                  {colors.map((c, i) => (
                    <div
                      key={i}
                      title={typeof c === 'string' ? c : (c.hex || 'color')}
                      className="rounded-lg"
                      style={{
                        width: 36,
                        height: 36,
                        background: typeof c === 'string' ? c : (c.hex || '#000'),
                        border: "2px solid var(--border)",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Detection details */}
            {detectionsToShow.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-muted)" }}>
                  Live Detection Results
                </h4>
                <div className="flex flex-col gap-2">
                  {detectionsToShow.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-xl px-4 py-2.5"
                      style={{ background: "rgba(0,0,0,0.3)" }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold capitalize"
                          style={{ color: "var(--text-primary)" }}>
                          {d.label}
                        </span>
                        <span className="text-xs font-bold"
                          style={{ color: "var(--accent-cyan)" }}>
                          {Math.round(d.confidence * 100)}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden"
                        style={{ background: "var(--border)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${d.confidence * 100}%`,
                            background: "linear-gradient(90deg, var(--accent-violet), var(--accent-cyan))",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {asset.status === "pending" || asset.status === "processing" ? (
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  color: "#f59e0b",
                }}
              >
                <div className="spinner" style={{ borderTopColor: "#f59e0b", borderColor: "rgba(245,158,11,0.3)" }} />
                AI analysis in progress...
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInScale {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
