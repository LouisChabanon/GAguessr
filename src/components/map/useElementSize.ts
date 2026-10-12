"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Size } from "@/lib/map/viewport";

/** Tracks an element's content box; null until first measured. */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width === 0 || height === 0) return;
      setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
