"use client";

import { useCallback, useEffect, useState } from "react";
import type { MobileTab } from "@/types";

const MOBILE_BREAKPOINT = 768;

export function useMobileNav() {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("browse");

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const switchTab = useCallback((tab: MobileTab) => {
    setMobileTab(tab);
    // Scroll to top when switching tabs on mobile
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return {
    isMobile,
    mobileTab,
    setMobileTab: switchTab,
  };
}
