import { useCallback, useEffect, useRef } from "react";

type LiveRegionMode = "polite" | "assertive";

const visuallyHiddenStyles: Partial<CSSStyleDeclaration> = {
  position: "fixed",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: "0",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: "0",
};

export const useLiveRegion = (mode: LiveRegionMode = "polite") => {
  const regionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const region = document.createElement("div");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", mode);
    region.setAttribute("aria-atomic", "true");

    Object.assign(region.style, visuallyHiddenStyles);

    document.body.appendChild(region);
    regionRef.current = region;

    return () => {
      regionRef.current = null;
      if (region.parentElement) {
        region.parentElement.removeChild(region);
      }
    };
  }, [mode]);

  return useCallback((message: string) => {
    const region = regionRef.current;

    if (!region || typeof message !== "string") {
      return;
    }

    region.textContent = "";

    requestAnimationFrame(() => {
      if (regionRef.current === region) {
        region.textContent = message;
      }
    });
  }, []);
};

export default useLiveRegion;
