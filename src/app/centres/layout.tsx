"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CentresLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isCentre, loading } = useAuth();
  const router = useRouter();
  const allowed = isAdmin || isCentre;

  useEffect(() => {
    if (!loading && user && !allowed) {
      router.replace("/"); // magazinier → renvoyé au monde pièces
    }
  }, [loading, user, allowed, router]);

  if (loading || !user) return null;
  if (!allowed) return null;

  return <>{children}</>;
}