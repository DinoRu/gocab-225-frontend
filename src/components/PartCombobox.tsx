"use client";

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { PartDetail } from "@/lib/types";

// Libellé des modèles compatibles, comme dans le <select> d'origine.
function modelsLabel(p: PartDetail): string {
  return p.is_universal
    ? "Universel"
    : p.vehicle_models.map((m) => `${m.brand_name} ${m.name}`).join(", ");
}

export function PartCombobox({
  parts,
  value,
  onChange,
  placeholder = "Rechercher une pièce…",
  autoFocus = false,
}: {
  parts: PartDetail[];
  value: string;
  onChange: (partId: string, part: PartDetail | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => parts.find((p) => p.id === value) ?? null,
    [parts, value],
  );

  // Filtre : référence, désignation OU modèles (marque/véhicule).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts.slice(0, 50);
    return parts
      .filter(
        (p) =>
          p.reference.toLowerCase().includes(q) ||
          p.designation.toLowerCase().includes(q) ||
          modelsLabel(p).toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [parts, query]);

  // Position du champ à l'écran pour y ancrer le panneau (portail).
  useLayoutEffect(() => {
    if (!open || !inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setCoords({ left: r.left, top: r.bottom + 2, width: r.width });
  }, [open, query]);

  // Ferme au clic dehors (champ ET panneau exclus).
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        inputRef.current &&
        !inputRef.current.contains(t) &&
        panelRef.current &&
        !panelRef.current.contains(t)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function pick(part: PartDetail) {
    onChange(part.id, part);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const panel =
    open && coords ? (
      <div
        ref={panelRef}
        className="combo-panel"
        style={{
          position: "fixed",
          left: coords.left,
          top: coords.top,
          width: coords.width,
        }}
      >
        {filtered.length === 0 ? (
          <div className="combo-empty">Aucune pièce trouvée</div>
        ) : (
          filtered.map((p, i) => (
            <div
              key={p.id}
              className={
                "combo-option" +
                (i === highlight ? " highlight" : "") +
                (p.id === value ? " selected" : "")
              }
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // évite le blur avant le clic
                pick(p);
              }}
            >
              <span className="combo-ref">
                {p.reference} — {p.designation}
              </span>
              <span className="combo-desig">{modelsLabel(p)}</span>
            </div>
          ))
        )}
      </div>
    ) : null;

  return (
    <div className="combo">
      <input
        ref={inputRef}
        className="input combo-input"
        value={
          open
            ? query
            : selected
              ? `${selected.reference} — ${selected.designation} (${modelsLabel(selected)})`
              : ""
        }
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
      />
      {/* Le panneau est rendu dans le <body>, hors de tout overflow parent. */}
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
