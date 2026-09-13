"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export interface HeaderConfig {
  eyebrow?: string;
  title?: string;
  highlight?: string;
  subtitle?: string;
}

interface HeaderContextType {
  headerConfig: HeaderConfig | null;
  setHeaderConfig: (config: HeaderConfig | null) => void;
}

const HeaderContext = createContext<HeaderContextType>({
  headerConfig: null,
  setHeaderConfig: () => {},
});

export function HeaderProvider({ children }: { children: React.ReactNode }) {
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null);
  const pathname = usePathname();

  // Reset custom header on route change
  useEffect(() => {
    setHeaderConfig(null);
  }, [pathname]);

  return (
    <HeaderContext.Provider value={{ headerConfig, setHeaderConfig }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  return useContext(HeaderContext);
}
