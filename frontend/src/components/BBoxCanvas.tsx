"use client";
import { useEffect, useRef, useState } from "react";
import { Detection } from "@/lib/api";

interface BBoxCanvasProps {
  detections: Detection[];
  imageEl: HTMLImageElement | null;
  visible: boolean;
}

const LABEL_COLORS: Record<string, string> = {
  person: "#7c3aed",
  car: "#06b6d4",
  dog: "#10b981",
  cat: "#f59e0b",
  bird: "#ef4444",
  default: "#7c3aed",
};

function getColor(label: string) {
  return LABEL_COLORS[label.toLowerCase()] ?? LABEL_COLORS.default;
}

export default function BBoxCanvas({ detections, imageEl, visible }: BBoxCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageEl || !visible) {
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    if (!detections || detections.length === 0) return;

    const { naturalWidth, naturalHeight, offsetWidth, offsetHeight } = imageEl;
    canvas.width = offsetWidth;
    canvas.height = offsetHeight;

    const scaleX = offsetWidth / naturalWidth;
    const scaleY = offsetHeight / naturalHeight;

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach(({ label, confidence, bbox }) => {
      const x = bbox.x1 * scaleX;
      const y = bbox.y1 * scaleY;
      const w = (bbox.x2 - bbox.x1) * scaleX;
      const h = (bbox.y2 - bbox.y1) * scaleY;
      const color = getColor(label);

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      // Corner accents
      const cl = 12;
      ctx.lineWidth = 3;
      [[x, y, cl, 0, 0, cl], [x + w - cl, y, cl, 0, 0, cl],
       [x, y + h - cl, cl, 0, 0, -cl], [x + w - cl, y + h - cl, cl, 0, 0, -cl]
      ].forEach(([cx, cy, dx1, dy1, dx2, dy2]) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy + dy1);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + dx1, cy);
        ctx.strokeStyle = color;
        ctx.stroke();
        void (dx2 + dy2); // unused suppressor
      });

      // Label pill
      const text = `${label} ${Math.round(confidence * 100)}%`;
      ctx.font = "bold 11px Inter, sans-serif";
      const textW = ctx.measureText(text).width;
      const padH = 6;
      const padV = 4;
      const pillH = 20;
      const pillY = y - pillH - 4 > 0 ? y - pillH - 4 : y + 4;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, pillY, textW + padH * 2, pillH, 4);
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.fillText(text, x + padH, pillY + pillH - padV);
    });
  }, [detections, imageEl, visible]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ display: visible ? "block" : "none" }}
    />
  );
}
