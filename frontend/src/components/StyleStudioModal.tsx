"use client";
import { useState, useEffect, useRef } from "react";
import { Asset, analysisApi, assetsApi, StylePreset } from "@/lib/api";
import AuthImage from "@/components/AuthImage";
import { useToast } from "@/components/ui/Toaster";

interface StyleStudioModalProps {
  asset: Asset;
  onClose: () => void;
}

const EMOJI_MAP: Record<string, string> = {
  mosaic: "🔷",
  watercolor: "💧",
  cyberpunk: "⚡",
  van_gogh: "🌻",
};

export default function StyleStudioModal({ asset, onClose }: StyleStudioModalProps) {
  const { toast } = useToast();
  const [presets, setPresets] = useState<Record<string, StylePreset>>({});
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [alpha, setAlpha] = useState(0.75);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Generating...");
  const [inferenceTime, setInferenceTime] = useState<string | null>(null);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customPreview, setCustomPreview] = useState<string | null>(null);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    analysisApi.listStyles().then((r) => setPresets(r.presets)).catch(() => {});
    return () => { if (loadingInterval.current) clearInterval(loadingInterval.current); };
  }, []);

  const startLoadingAnimation = () => {
    const msgs = [
      "Initializing Stable Diffusion...",
      "Running img2img pipeline...",
      "Applying style...",
      "Blending content & style...",
      "Almost done...",
    ];
    let i = 0;
    setLoadingText(msgs[0]);
    loadingInterval.current = setInterval(() => {
      i = (i + 1) % msgs.length;
      setLoadingText(msgs[i]);
    }, 3000);
  };

  const stopLoading = () => {
    if (loadingInterval.current) {
      clearInterval(loadingInterval.current);
      loadingInterval.current = null;
    }
  };

  const applyPreset = async (presetKey: string) => {
    setSelectedPreset(presetKey);
    setOutputUrl(null);
    setInferenceTime(null);
    setLoading(true);
    startLoadingAnimation();
    const start = Date.now();
    try {
      const blob = await analysisApi.applyPreset(asset.id, presetKey, alpha);
      const url = URL.createObjectURL(blob as Blob);
      setOutputUrl(url);
      setInferenceTime(`${((Date.now() - start) / 1000).toFixed(1)}s`);
      toast("Style applied! ✨", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Style transfer failed";
      toast(msg, "error");
    } finally {
      stopLoading();
      setLoading(false);
    }
  };

  const applyCustom = async () => {
    if (!customFile) { toast("Upload a style image first", "error"); return; }
    setOutputUrl(null);
    setInferenceTime(null);
    setLoading(true);
    startLoadingAnimation();
    const start = Date.now();
    try {
      const blob = await analysisApi.applyCustom(asset.id, customFile, alpha);
      const url = URL.createObjectURL(blob as Blob);
      setOutputUrl(url);
      setInferenceTime(`${((Date.now() - start) / 1000).toFixed(1)}s`);
      toast("Custom style applied! 🎨", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Style transfer failed";
      toast(msg, "error");
    } finally {
      stopLoading();
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-4xl glass-strong overflow-y-auto flex flex-col"
        style={{ maxHeight: "92vh", animation: "slideInScale 0.25s ease" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <h2 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
              🎨 Style Transfer Studio
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {asset.original_filename}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm">✕ Close</button>
        </div>

        {/* Image comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Original */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--text-muted)" }}>
              Original
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(0,0,0,0.3)", aspectRatio: "4/3" }}>
              <AuthImage
                assetId={asset.id}
                alt="Original"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Output */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}>
                Styled Output
              </span>
              {inferenceTime && (
                <span className="badge badge-completed">{inferenceTime}</span>
              )}
            </div>
            <div
              className="rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.3)", aspectRatio: "4/3" }}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-4 p-8">
                  <div
                    className="w-12 h-12 rounded-full"
                    style={{
                      border: "3px solid rgba(124,58,237,0.2)",
                      borderTop: "3px solid var(--accent-violet)",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                  <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                    {loadingText}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    This can take 30–120s on CPU
                  </p>
                </div>
              ) : outputUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={outputUrl} alt="Styled" className="w-full h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-3 p-8 text-center">
                  <span className="text-4xl">✨</span>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Select a preset or upload a custom style below
                  </p>
                </div>
              )}
            </div>
            {outputUrl && (
              <a
                href={outputUrl}
                download="visual-vault-styled.png"
                className="btn-ghost w-full justify-center mt-3 text-sm"
              >
                ⬇ Download Styled Image
              </a>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 pb-6 flex flex-col gap-6">
          {/* Strength slider */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(0,0,0,0.3)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Style Strength
              </span>
              <span className="font-bold" style={{ color: "var(--accent-violet)" }}>
                {Math.round(alpha * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={95}
              value={alpha * 100}
              onChange={(e) => setAlpha(Number(e.target.value) / 100)}
              className="w-full"
            />
            <div className="flex justify-between text-xs mt-1.5"
              style={{ color: "var(--text-muted)" }}>
              <span>Subtle</span>
              <span>Intense</span>
            </div>
          </div>

          {/* AI Presets */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h4 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                AI Presets
              </h4>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: "rgba(124,58,237,0.2)",
                  color: "var(--accent-violet-light)",
                  border: "1px solid var(--border-accent)",
                }}
              >
                Stable Diffusion
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(presets).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  disabled={loading}
                  className="rounded-xl p-4 text-left transition-all duration-200 flex flex-col gap-2"
                  style={{
                    background: selectedPreset === key
                      ? "rgba(124,58,237,0.2)"
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${selectedPreset === key ? "var(--accent-violet)" : "var(--border)"}`,
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading && selectedPreset !== key ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (selectedPreset !== key)
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (selectedPreset !== key)
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  }}
                >
                  <span className="text-2xl">{EMOJI_MAP[key] ?? "✨"}</span>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {p.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom style */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <h4 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                Custom Style
              </h4>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: "rgba(6,182,212,0.2)",
                  color: "var(--accent-cyan)",
                  border: "1px solid rgba(6,182,212,0.3)",
                }}
              >
                VGG-19
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div
                className="rounded-xl overflow-hidden flex items-center justify-center cursor-pointer transition-all"
                style={{
                  width: 100,
                  height: 80,
                  background: customPreview ? "transparent" : "rgba(255,255,255,0.03)",
                  border: "2px dashed var(--border)",
                  flexShrink: 0,
                }}
                onClick={() => document.getElementById("custom-style-input")?.click()}
              >
                {customPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={customPreview} alt="Custom style" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl">📎</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Upload</span>
                  </div>
                )}
              </div>
              <input
                id="custom-style-input"
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setCustomFile(f);
                  const r = new FileReader();
                  r.onload = (ev) => setCustomPreview(ev.target?.result as string);
                  r.readAsDataURL(f);
                }}
              />
              <div className="flex flex-col gap-2 flex-1">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {customFile ? customFile.name : "Upload any image to steal its artistic style"}
                </p>
                <button
                  className="btn-cyan text-sm self-start"
                  onClick={applyCustom}
                  disabled={loading || !customFile}
                >
                  Apply Custom Style
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInScale {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
