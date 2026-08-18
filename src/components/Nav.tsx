"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { zoneFromPath, type AppZone } from "@/lib/appZone";

type NavLink = { href: string; label: string; admin: boolean };

const PIECES_LINKS: NavLink[] = [
  { href: "/", label: "Tableau de bord", admin: false },
  { href: "/statistiques", label: "Statistiques", admin: true },
  { href: "/commandes", label: "Commandes", admin: false },
  { href: "/paiements", label: "Paiements", admin: true },
  { href: "/besoins", label: "Besoins", admin: false },
  { href: "/bons-de-commande", label: "Bons de commande", admin: true },
  { href: "/inventaire", label: "Inventaire", admin: false },
  { href: "/pieces", label: "Pièces", admin: false },
  { href: "/marques", label: "Marques", admin: false },
  { href: "/modeles", label: "Modèles", admin: false },
  { href: "/fournisseurs", label: "Fournisseurs", admin: true },
  { href: "/utilisateurs", label: "Utilisateurs", admin: true },
];

const VENTES_LINKS: NavLink[] = [
  { href: "/ventes", label: "Tableau de bord", admin: true },
  { href: "/ventes/clients", label: "Clients", admin: true },
  { href: "/ventes/produits", label: "Produits", admin: true },
  { href: "/ventes/ventes", label: "Ventes", admin: true },
  { href: "/ventes/paiements", label: "Paiements", admin: true },
  { href: "/ventes/proformas", label: "Proformas", admin: true },
];

const CENTRES_LINKS: NavLink[] = [
  { href: "/centres", label: "Demandes", admin: false },
];

// Icônes SVG (trait) par module. Héritent de la couleur du texte (blanc sur la pastille).
const ICONS: Record<string, ReactNode> = {
  "/": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </>
  ),
  "/statistiques": (
    <>
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="10" />
    </>
  ),
  "/commandes": (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.5 3h2l2.4 12a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.5l1.5-6.6H6" />
    </>
  ),
  "/paiements": (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </>
  ),
  "/besoins": (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </>
  ),
  "/bons-de-commande": (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  "/inventaire": (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.3 7 12 12 20.7 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </>
  ),
  "/pieces": (
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>
  ),
  "/marques": (
    <>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </>
  ),
  "/modeles": (
    <>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  "/fournisseurs": (
    <>
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>
  ),
  "/utilisateurs": (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  "/ventes": (
    <>
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="10" />
    </>
  ),
  "/ventes/clients": (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    </>
  ),
  "/ventes/produits": (
    <>
      <path d="M20.5 7.3 12 2 3.5 7.3v9.4L12 22l8.5-5.3z" />
      <path d="M3.5 7.3 12 12l8.5-4.7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </>
  ),
  "/ventes/ventes": (
    <>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  "/ventes/paiements": (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </>
  ),
  "/ventes/proformas": (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
    </>
  ),
};

function ModuleIcon({ href }: { href: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[href] ?? ICONS["/"]}
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const leftRef = useRef<HTMLDivElement>(null);

  const zone: AppZone = zoneFromPath(pathname);
  const links =
    zone === "ventes"
      ? VENTES_LINKS
      : zone === "centres"
        ? CENTRES_LINKS
        : PIECES_LINKS;
  const visible = links.filter((l) => !l.admin || isAdmin);

  const isActive = (href: string) =>
    href === "/" || href === "/ventes"
      ? pathname === href
      : pathname.startsWith(href);

  const current = visible.find((l) => isActive(l.href));
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (leftRef.current && !leftRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const userRoleLabel =
    user?.role === "admin"
      ? "Admin"
      : user?.role === "centre"
        ? "Centre"
        : "Magazinier";

  return (
    <header className="topbar">
      <div className="topbar-left" ref={leftRef}>
        <button
          className="app-launcher-btn"
          onClick={() => setOpen((v) => !v)}
          aria-label="Ouvrir les modules"
          aria-expanded={open}
        >
          <span className="app-launcher-dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        <div className="brand">
          GOCAB<span> 225</span>
        </div>

        {/* Sélecteur d'app : bascule pièces ↔ ventes (admin voit les deux) */}
        {isAdmin && (
          <div className="app-switcher">
            <Link
              href="/"
              className={"app-switch" + (zone === "pieces" ? " active" : "")}
            >
              Pièces
            </Link>
            <Link
              href="/ventes"
              className={"app-switch" + (zone === "ventes" ? " active" : "")}
            >
              Ventes
            </Link>
            <Link
              href="/centres"
              className={"app-switch" + (zone === "centres" ? " active" : "")}
            >
              Centres
            </Link>
          </div>
        )}

        {current && <div className="topbar-current">{current.label}</div>}

        {open && (
          <div className="app-launcher-panel">
            <div className="app-launcher-title">Modules</div>
            <div className="app-launcher-items">
              {visible.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={"app-tile" + (isActive(l.href) ? " active" : "")}
                >
                  <span className="app-tile-icon">
                    <ModuleIcon href={l.href} />
                  </span>
                  <span className="app-tile-label">{l.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="topbar-user">
        <span className="topbar-username">
          {user?.full_name || user?.username}
          <span className="topbar-role">{userRoleLabel}</span>
        </span>
        <button className="btn btn-sm" onClick={logout}>
          Déconnexion
        </button>
      </div>
    </header>
  );
}
