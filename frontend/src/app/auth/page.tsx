"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toaster";

// ── Particle Canvas ──────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124, 58, 237, ${p.alpha})`;
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(124, 58, 237, ${0.15 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.6 }}
    />
  );
}

// ── Auth Page ────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const { login, register, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/gallery");
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
        toast("Welcome back! 👋", "success");
      } else {
        await register(email, password);
        toast("Account created! Welcome to Visual Vault ✨", "success");
      }
      router.replace("/gallery");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--bg-base)" }}
    >
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex flex-1 relative flex-col items-start justify-center p-16 overflow-hidden"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        <ParticleCanvas />
        {/* Glow blobs */}
        <div
          className="absolute rounded-full blur-3xl pointer-events-none"
          style={{
            width: 400,
            height: 400,
            background: "rgba(124, 58, 237, 0.12)",
            top: "10%",
            left: "20%",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl pointer-events-none"
          style={{
            width: 300,
            height: 300,
            background: "rgba(6, 182, 212, 0.08)",
            bottom: "20%",
            right: "10%",
          }}
        />

        <div className="relative z-10 max-w-lg">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <LogoIcon size={44} />
            <span
              className="text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Visual Vault
            </span>
          </div>

          <h1
            className="text-5xl font-extrabold leading-tight mb-6"
            style={{ color: "var(--text-primary)" }}
          >
            See the world through{" "}
            <span className="gradient-text">artificial intelligence</span>
          </h1>
          <p
            className="text-lg mb-10"
            style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}
          >
            Upload images. Detect objects. Search with natural language. Transform
            with generative AI art styles.
          </p>

          <div className="flex flex-col gap-4">
            {[
              { icon: "⚡", label: "YOLOv8 Object Detection", desc: "Real-time bounding boxes" },
              { icon: "🧠", label: "CLIP Semantic Search", desc: "Find images with words" },
              { icon: "🎨", label: "AI Style Transfer", desc: "Stable Diffusion presets + VGG-19" },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-4 glass rounded-xl px-5 py-3"
              >
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p
                    className="font-semibold text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {f.label}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <LogoIcon size={36} />
            <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Visual Vault
            </span>
          </div>

          <div className="glass-strong p-8">
            {/* Tabs */}
            <div
              className="flex rounded-xl p-1 mb-8 gap-1"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setEmail(""); setPassword(""); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{
                    background: tab === t ? "rgba(124, 58, 237, 0.3)" : "transparent",
                    color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
                    border: tab === t ? "1px solid var(--border-accent)" : "1px solid transparent",
                  }}
                >
                  {t === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="auth-email"
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--accent-violet)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="auth-password"
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPw ? "text" : "password"}
                    autoComplete={tab === "login" ? "current-password" : "new-password"}
                    required
                    minLength={tab === "register" ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tab === "register" ? "At least 8 characters" : "••••••••"}
                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "var(--accent-violet)")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "var(--border)")
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lg"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center mt-2 py-3"
              >
                {loading ? (
                  <><div className="spinner" /> Processing...</>
                ) : tab === "login" ? (
                  "Sign In"
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#authGrad)" />
      <path
        d="M10 28L18 16L24 22L28 17L34 26"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="14" r="3" fill="white" fillOpacity="0.8" />
      <defs>
        <linearGradient id="authGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c3aed" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}
