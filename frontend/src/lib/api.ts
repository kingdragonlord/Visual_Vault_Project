// Central API client for the Visual Vault FastAPI backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vv_token");
}

export function setToken(token: string): void {
  localStorage.setItem("vv_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("vv_token");
}

// ─── Base fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `API error ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("image/") || contentType.includes("application/octet-stream")) {
    return res.blob() as unknown as T;
  }

  return res.json() as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  email: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<TokenResponse>(
      "/api/v1/auth/login",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) },
      false
    ),

  register: (email: string, password: string) =>
    apiFetch<UserResponse>(
      "/api/v1/auth/register",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) },
      false
    ),
};

// ─── Assets ───────────────────────────────────────────────────────────────────

export interface MlColor {
  hex?: string;
  rgb?: number[];
  percentage?: number;
  // fallback — sometimes stored as plain string
  [key: string]: unknown;
}

// Matches the ACTUAL fields returned by the API (AssetResponse + AssetDetail schemas)
export interface Asset {
  id: number;
  filename: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  status: "pending" | "processing" | "completed" | "failed";
  width?: number;
  height?: number;
  created_at?: string;
  processed_at?: string | null;
  // AssetDetail fields (only present when fetching a single asset via GET /assets/{id})
  ml_labels?: string[] | null;     // YOLO detected labels, e.g. ["dog","person"]
  ml_colors?: MlColor[] | null;    // Dominant colors extracted by Pillow
  error_message?: string | null;
  // CLIP embedding — not shown in UI but needed for search
  embedding_vector?: string | null;
}

export interface AssetUploadResponse {
  id: number;
  filename: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  status: string;
  message: string;
}

export const assetsApi = {
  list: () => apiFetch<Asset[]>("/api/v1/assets/"),
  get:  (id: number) => apiFetch<Asset>(`/api/v1/assets/${id}`),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<AssetUploadResponse>("/api/v1/assets/upload", { method: "POST", body: form });
  },
  fileUrl: (id: number) => `${API_BASE}/api/v1/assets/${id}/file`,
};

// ─── YOLO Detection ──────────────────────────────────────────────────────────

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  label: string;
  confidence: number;
  bbox: BBox;
}

export interface DetectionResponse {
  message: string;
  model_used: string;
  detections: Detection[];
}

export const inferenceApi = {
  /**
   * Run live YOLO detection on a blob (fetched with auth headers from assetsApi.fileUrl).
   * Uses the synchronous /predict endpoint which returns full bbox coordinates.
   */
  predict: async (imageBlob: Blob): Promise<DetectionResponse> => {
    const form = new FormData();
    form.append("file", imageBlob, "image.jpg");
    return apiFetch<DetectionResponse>("/api/v1/predict", { method: "POST", body: form });
  },
};

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  asset: Asset;
  similarity: number;
}

export const searchApi = {
  text: (query: string, limit = 20, minSimilarity = 0.2) =>
    apiFetch<SearchResult[]>("/api/v1/search/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, min_similarity: minSimilarity }),
    }),
};

// ─── Style Transfer ───────────────────────────────────────────────────────────

export interface StylePreset {
  name: string;
  prompt: string;
  artist: string;
  description: string;
}

export const analysisApi = {
  listStyles: () =>
    apiFetch<{ presets: Record<string, StylePreset> }>("/api/v1/analysis/styles"),

  applyPreset: (assetId: number, preset: string, alpha: number) =>
    apiFetch<Blob>(`/api/v1/analysis/style/${assetId}?preset=${preset}&alpha=${alpha}`),

  applyCustom: (assetId: number, styleFile: File, alpha: number) => {
    const form = new FormData();
    form.append("style_file", styleFile);
    return apiFetch<Blob>(`/api/v1/analysis/style/${assetId}/custom?alpha=${alpha}`, {
      method: "POST",
      body: form,
    });
  },
};
