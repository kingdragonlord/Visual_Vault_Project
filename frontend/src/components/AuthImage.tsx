"use client";
import { useState, useEffect, useRef, forwardRef } from "react";
import { assetsApi, getToken } from "@/lib/api";

interface AuthImageProps {
  assetId: number;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
}

// Module-level blob URL cache — persists across renders
const cache = new Map<number, string>();

/**
 * Fetches an image with the JWT Authorization header and renders it via a blob URL.
 * This is necessary because the FastAPI /assets/{id}/file endpoint requires auth
 * and <img src> tags cannot send Authorization headers.
 */
const AuthImage = forwardRef<HTMLImageElement, AuthImageProps>(function AuthImage(
  { assetId, alt, className, style, onLoad },
  ref
) {
  const [src, setSrc] = useState<string | null>(cache.get(assetId) ?? null);
  const [loading, setLoading] = useState(!cache.has(assetId));
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (cache.has(assetId)) {
      setSrc(cache.get(assetId)!);
      setLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    fetch(assetsApi.fileUrl(assetId), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        cache.set(assetId, url);
        if (mounted.current) {
          setSrc(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted.current) {
          setError(true);
          setLoading(false);
        }
      });
  }, [assetId]);

  if (loading) {
    return (
      <div
        className={`skeleton ${className ?? ""}`}
        style={{ ...style, display: "block", minHeight: 80 }}
      />
    );
  }

  if (error || !src) {
    return (
      <div
        className={className}
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.03)",
          flexDirection: "column",
          gap: 8,
          minHeight: 80,
        }}
      >
        <span style={{ fontSize: 28, opacity: 0.35 }}>🖼️</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Preview unavailable</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={className}
      style={style}
      onLoad={onLoad}
    />
  );
});

export default AuthImage;
