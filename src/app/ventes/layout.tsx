"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function VentesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      router.replace("/"); // un magazinier ne peut pas entrer dans le monde ventes
    }
  }, [loading, user, isAdmin, router]);

  if (loading || !user) return null;
  if (!isAdmin) return null;

  return <>{children}</>;
}
