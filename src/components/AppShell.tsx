"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // La page de login s'affiche seule, sans nav ni layout applicatif.
  if (pathname === "/login" || pathname === "/accueil") {
    return <>{children}</>;
  }

  return (
    <div className="app">
      <Nav />
      <main className="content">{children}</main>
    </div>
  );
}
