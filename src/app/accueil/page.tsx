"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccueilPage() {
  const { user, isAdmin, isCentre } = useAuth();

  const router = useRouter();

  // Un centre n'a qu'un module : on l'y envoie, il n'a rien à faire sur l'accueil.
  useEffect(() => {
    if (isCentre) router.replace("/centres");
  }, [isCentre, router]);

  if (isCentre) return null; // évite le flash de l'accueil avant la redirection

  return (
    <div className="home-wrap">
      <div className="home-head">
        <div className="home-brand">
          GOCAB<span> 225</span>
        </div>
        <p className="home-welcome">
          Bonjour {user?.full_name || user?.username} — choisissez votre espace
          de travail.
        </p>
      </div>

      <div className="home-tiles">
        {/* Pièces et Ventes : admin uniquement (le centre n'y a pas accès) */}
        {!isCentre && (
          <Link href="/" className="home-tile">
            <span className="home-tile-icon pieces">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </span>
            <span className="home-tile-title">Gestion des pièces</span>
            <span className="home-tile-sub">
              Inventaire, commandes, besoins, bons de commande
            </span>
          </Link>
        )}

        {isAdmin && (
          <Link href="/ventes" className="home-tile">
            <span className="home-tile-icon ventes">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            <span className="home-tile-title">Ventes &amp; Comptes</span>
            <span className="home-tile-sub">
              Clients, ventes, paiements, grand livre, proformas
            </span>
          </Link>
        )}

        {/* Demandes inter-centres : admin ET centre */}
        {(isAdmin || isCentre) && (
          <Link href="/centres" className="home-tile">
            <span className="home-tile-icon centres">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 21h18" />
                <path d="M5 21V7l8-4v18" />
                <path d="M19 21V11l-6-4" />
                <line x1="9" y1="9" x2="9" y2="9" />
                <line x1="9" y1="13" x2="9" y2="13" />
              </svg>
            </span>
            <span className="home-tile-title">Demandes inter-centres</span>
            <span className="home-tile-sub">
              Pièces demandées par le Centre 2
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
