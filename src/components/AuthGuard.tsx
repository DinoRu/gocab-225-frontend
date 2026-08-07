"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/components/ui";

// Pages réservées à l'admin (préfixes de chemin).
const ADMIN_ONLY = [
  "/paiements",
  "/statistiques",
  "/utilisateurs",
  "/fournisseurs",
  "/bons-de-commande",
];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) {
      router.replace("/login");
    }
    // Magazinier tentant une page admin → renvoyé à l'accueil.
    if (user && !isAdmin && ADMIN_ONLY.some((p) => pathname.startsWith(p))) {
      router.replace("/");
    }
  }, [user, loading, isAdmin, pathname, isLoginPage, router]);

  // La page de login s'affiche sans layout ni garde.
  if (isLoginPage) return <>{children}</>;

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Loading />
      </div>
    );
  }

  // Magazinier sur une page admin : on n'affiche rien le temps de la redirection.
  if (!isAdmin && ADMIN_ONLY.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return <>{children}</>;
}
