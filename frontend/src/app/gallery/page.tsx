"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { assetsApi, Asset, AssetUploadResponse } from "@/lib/api";
import AuthImage from "@/components/AuthImage";
import UploadModal from "@/components/UploadModal";
import AssetDetailModal from "@/components/AssetDetailModal";
import StyleStudioModal from "@/components/StyleStudioModal";
import SearchDrawer from "@/components/SearchDrawer";
import { useToast } from "@/components/ui/Toaster";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; dot: string }> = {
    pending:    { cls: "badge-pending",    dot: "#f59e0b" },
    processing: { cls: "badge-processing", dot: "#06b6d4" },
    completed:  { cls: "badge-completed",  dot: "#10b981" },
    failed:     { cls: "badge-failed",     dot: "#ef4444" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`badge ${s.cls}`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: s.dot,
        animation: status === "processing" ? "pulse 1.5s infinite" : "none"
      }} />
      {status}
    </span>
  );
}

// ── Asset Card ────────────────────────────────────────────────────────────────
function AssetCard({ asset, onClick }: { asset: Asset; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative text-left rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(12, 16, 32, 0.9)",
        border: `1px solid ${hovered ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.07)"}`,
        transform: hovered ? "translateY(-5px) scale(1.01)" : "translateY(0) scale(1)",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: hovered
          ? "0 20px 60px rgba(124,58,237,0.25), 0 0 0 1px rgba(124,58,237,0.15)"
          : "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
        <AuthImage
          assetId={asset.id}
          alt={asset.original_filename}
          className="w-full h-full"
          style={{
            objectFit: "cover",
            transform: hovered ? "scale(1.08)" : "scale(1)",
            transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)",
            display: "block",
          }}
        />

        {/* Dark gradient overlay on hover */}
        <div
          className="absolute inset-0 flex flex-col justify-between p-3"
          style={{
            background: hovered
              ? "linear-gradient(to top, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.2) 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.5) 30%, transparent 70%)",
            transition: "background 0.3s ease",
          }}
        >
          {/* Top: status */}
          <div className="flex justify-end">
            <StatusBadge status={asset.status} />
          </div>

          {/* Bottom: hover CTA */}
          <div
            style={{
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(6px)",
              transition: "all 0.25s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 10,
              background: "rgba(124,58,237,0.85)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              alignSelf: "center",
              width: "fit-content",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7.5" stroke="white" strokeWidth="1.5"/>
              <path d="M7 10h6M10 7v6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Open Details
          </div>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-start justify-between gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
            title={asset.original_filename}
          >
            {asset.original_filename}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {asset.file_size && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {formatBytes(asset.file_size)}
              </span>
            )}
            {asset.width && asset.height && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                · {asset.width}×{asset.height}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Label chips */}
      {asset.ml_labels && asset.ml_labels.length > 0 && (
        <div className="px-3.5 pb-3.5 flex flex-wrap gap-1.5">
          {asset.ml_labels.slice(0, 3).map((l) => (
            <span
              key={l}
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                background: "rgba(124,58,237,0.12)",
                color: "#a78bfa",
                border: "1px solid rgba(124,58,237,0.25)",
              }}
            >
              {l}
            </span>
          ))}
          {asset.ml_labels.length > 3 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs"
              style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)" }}
            >
              +{asset.ml_labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Shimmer border accent on hover */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s",
          background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(6,182,212,0.04))",
        }}
      />
    </button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="skeleton" style={{ aspectRatio: "4/3" }} />
      <div className="p-3.5 flex flex-col gap-2">
        <div className="skeleton h-4 rounded-lg" style={{ width: "70%" }} />
        <div className="skeleton h-3 rounded-lg" style={{ width: "45%" }} />
      </div>
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-5 py-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xl font-bold" style={{ color: "var(--text-primary)", lineHeight: 1.1 }}>
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </div>
  );
}

// ── Gallery Page ──────────────────────────────────────────────────────────────
export default function GalleryPage() {
  const { isAuthenticated, loading: authLoading, userEmail, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("date");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [styleAsset, setStyleAsset] = useState<Asset | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/auth");
  }, [authLoading, isAuthenticated, router]);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await assetsApi.list();
      setAssets(data);
    } catch {
      toast("Failed to load assets", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAuthenticated) loadAssets();
  }, [isAuthenticated, loadAssets]);

  const handleUploaded = (result: AssetUploadResponse) => {
    setAssets((prev) => [
      { ...result, status: result.status as Asset["status"], ml_labels: [], ml_colors: [] },
      ...prev,
    ]);
    setTimeout(loadAssets, 3000);
  };

  const openDetail = async (id: number) => {
    try {
      const asset = await assetsApi.get(id);
      setDetailAsset(asset);
    } catch {
      toast("Failed to load asset details", "error");
    }
  };

  // Computed values
  const completed = assets.filter((a) => a.status === "completed").length;
  const pending = assets.filter((a) => a.status === "pending" || a.status === "processing").length;
  const totalLabels = new Set(assets.flatMap((a) => a.ml_labels ?? [])).size;

  const filteredAssets = assets.filter((a) => {
    if (activeFilter === "all") return true;
    return a.status === activeFilter;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (sort === "date")  return (b.id ?? 0) - (a.id ?? 0);
    if (sort === "size")  return b.file_size - a.file_size;
    if (sort === "name")  return a.original_filename.localeCompare(b.original_filename);
    return 0;
  });

  const initials = userEmail ? userEmail[0].toUpperCase() : "U";

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      {/* Background glow blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{
          position: "absolute", width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)",
          top: -200, left: -100,
        }}/>
        <div style={{
          position: "absolute", width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 70%)",
          bottom: 0, right: -100,
        }}/>
      </div>

      {/* ── Navbar ── */}
      <nav
        className="sticky top-0 z-30 flex items-center gap-4 px-6 py-3"
        style={{
          background: "rgba(8,11,20,0.85)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <LogoIcon size={32} />
          <span className="font-bold text-base hidden sm:block gradient-text">
            Visual Vault
          </span>
        </div>

        {/* Search */}
        <div className="flex-1 flex justify-center px-4">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl w-full max-w-sm transition-all duration-200 group"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(124,58,237,0.08)";
              e.currentTarget.style.borderColor = "rgba(124,58,237,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
              <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-sm flex-1 text-left" style={{ color: "var(--text-muted)" }}>
              Search with AI...
            </span>
            <kbd
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa", fontFamily: "monospace" }}
            >
              CLIP
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button className="btn-ghost text-sm py-2" onClick={loadAssets} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M4 10a6 6 0 1 0 1.5-4L4 4M4 4v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button className="btn-primary text-sm py-2" onClick={() => setUploadOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M10 3v11M10 3L6.5 6.5M10 3l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 16h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span className="hidden sm:inline">Upload</span>
          </button>
          <button
            onClick={logout}
            title={`${userEmail ?? ""} — Click to sign out`}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all"
            style={{ background: "linear-gradient(135deg,#7c3aed,#5b21b6)", color: "#fff" }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {initials}
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 relative z-10 px-6 py-8 max-w-screen-xl mx-auto w-full">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
            Your Vault
          </h1>
          <p className="text-base" style={{ color: "var(--text-secondary)" }}>
            {userEmail && <span style={{ color: "var(--accent-violet-light)" }}>{userEmail}</span>}
            {userEmail && " · "}
            {assets.length} image{assets.length !== 1 ? "s" : ""} stored
          </p>
        </div>

        {/* Stat chips */}
        {!loading && assets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
            <StatChip icon="🖼️" label="Total Assets" value={assets.length} />
            <StatChip icon="✅" label="Analyzed" value={completed} />
            <StatChip icon="⏳" label="Processing" value={pending} />
            <StatChip icon="🏷️" label="Unique Labels" value={totalLabels} />
          </div>
        )}

        {/* Controls row */}
        <div
          className="flex items-center gap-3 mb-6 flex-wrap"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 20 }}
        >
          {/* Filter tabs */}
          <div
            className="flex gap-1 rounded-xl p-1"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {["all", "completed", "pending", "failed"].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                style={{
                  background: activeFilter === f ? "rgba(124,58,237,0.3)" : "transparent",
                  color: activeFilter === f ? "#c4b5fd" : "var(--text-muted)",
                  border: activeFilter === f ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm outline-none cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-secondary)",
            }}
          >
            <option value="date">Latest first</option>
            <option value="size">Largest first</option>
            <option value="name">A → Z</option>
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : sortedAssets.length === 0 ? (
          <EmptyState onUpload={() => setUploadOpen(true)} hasFilter={activeFilter !== "all"} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {sortedAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onClick={() => openDetail(asset.id)} />
            ))}
          </div>
        )}
      </main>

      {/* ── Modals ── */}
      {uploadOpen && (
        <UploadModal onClose={() => setUploadOpen(false)} onUploaded={handleUploaded} />
      )}
      {detailAsset && (
        <AssetDetailModal
          asset={detailAsset}
          onClose={() => setDetailAsset(null)}
          onStyleStudio={(a) => { setDetailAsset(null); setStyleAsset(a); }}
        />
      )}
      {styleAsset && (
        <StyleStudioModal asset={styleAsset} onClose={() => setStyleAsset(null)} />
      )}
      <SearchDrawer
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectAsset={(id) => { setSearchOpen(false); openDetail(id); }}
      />

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onUpload, hasFilter }: { onUpload: () => void; hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 gap-6 text-center">
      <div
        className="w-28 h-28 rounded-3xl flex items-center justify-center text-5xl"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))",
          border: "1px solid rgba(124,58,237,0.2)",
        }}
      >
        {hasFilter ? "🔍" : "🖼️"}
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          {hasFilter ? "No images match this filter" : "Your vault is empty"}
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>
          {hasFilter
            ? "Try a different filter or upload more images"
            : "Upload your first image to get started with AI analysis"}
        </p>
      </div>
      {!hasFilter && (
        <button className="btn-primary" onClick={onUpload}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M10 3v11M10 3L6.5 6.5M10 3l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 16h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Upload an Image
        </button>
      )}
    </div>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function LogoIcon({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#galGrad)" />
      <path d="M10 28L18 16L24 22L28 17L34 26" stroke="white" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="14" cy="14" r="3" fill="white" fillOpacity="0.8"/>
      <defs>
        <linearGradient id="galGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed"/>
          <stop offset="1" stopColor="#06b6d4"/>
        </linearGradient>
      </defs>
    </svg>
  );
}
