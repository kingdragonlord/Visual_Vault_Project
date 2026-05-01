"use client";
import { useState, useRef, useEffect } from "react";
import { SearchResult, searchApi, assetsApi } from "@/lib/api";
import AuthImage from "@/components/AuthImage";
import { useToast } from "@/components/ui/Toaster";

interface SearchDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelectAsset: (id: number) => void;
}

export default function SearchDrawer({ open, onClose, onSelectAsset }: SearchDrawerProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [minSim, setMinSim] = useState(0.20);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const r = await searchApi.text(query.trim(), 20, minSim);
      setResults(r);
      setSearched(true);
      if (r.length === 0) toast("No matches found. Try a different query.", "info");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Search failed";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: "min(440px, 100vw)",
          background: "rgba(12,15,28,0.95)",
          borderLeft: "1px solid var(--border)",
          backdropFilter: "blur(24px)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: open ? "-24px 0 80px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
              🧠 Semantic Search
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Powered by CLIP · Natural language
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm">✕</button>
        </div>

        {/* Search input */}
        <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2"
                width="16" height="16" viewBox="0 0 20 20" fill="none"
                style={{ color: "var(--text-muted)" }}
              >
                <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="e.g. a cat on a red sofa..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-violet)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>
            <button
              className="btn-primary text-sm"
              onClick={runSearch}
              disabled={loading || !query.trim()}
            >
              {loading ? <div className="spinner" /> : "Search"}
            </button>
          </div>

          {/* Similarity threshold */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Min similarity
            </span>
            <input
              type="range"
              min={0}
              max={60}
              value={minSim * 100}
              onChange={(e) => setMinSim(Number(e.target.value) / 100)}
              className="flex-1"
            />
            <span className="text-xs font-bold w-10 text-right"
              style={{ color: "var(--accent-cyan)" }}>
              {Math.round(minSim * 100)}%
            </span>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton rounded-xl h-20" />
              ))}
            </div>
          ) : searched && results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="text-4xl">🔍</span>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No images matched "{query}"
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Try a lower similarity threshold or different keywords
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {results.map(({ asset, similarity }) => (
                <button
                  key={asset.id}
                  onClick={() => { onSelectAsset(asset.id); onClose(); }}
                  className="w-full flex items-center gap-4 rounded-xl p-3 text-left transition-all"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(124,58,237,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                  }
                >
                  {/* Thumbnail */}
                  <div
                    className="rounded-lg overflow-hidden flex-shrink-0"
                    style={{ width: 60, height: 60 }}
                  >
                  <AuthImage
                    assetId={asset.id}
                    alt={asset.original_filename}
                    className="w-full h-full object-cover"
                  />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-sm truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {asset.original_filename}
                    </p>
                    {asset.ml_labels && asset.ml_labels.length > 0 && (
                      <p className="text-xs mt-0.5 truncate"
                        style={{ color: "var(--text-muted)" }}>
                        {asset.ml_labels.slice(0, 3).join(", ")}
                      </p>
                    )}
                    {/* Similarity bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full overflow-hidden"
                        style={{ background: "var(--border)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(similarity * 100, 100)}%`,
                            background: "linear-gradient(90deg, var(--accent-violet), var(--accent-cyan))",
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold"
                        style={{ color: "var(--accent-cyan)" }}>
                        {Math.round(similarity * 100)}%
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
