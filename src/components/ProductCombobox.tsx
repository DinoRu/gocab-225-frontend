"use client";

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { SalesProduct } from "@/lib/types";

export function ProductCombobox({
  products,
  designation,
  onChangeText,
  onPickProduct,
  placeholder = "Produit ou désignation libre…",
}: {
  products: SalesProduct[];
  designation: string; // le texte courant de la ligne
  onChangeText: (text: string) => void; // frappe libre → met à jour la désignation
  onPickProduct: (product: SalesProduct) => void; // clic sur une suggestion → remplit prix + désignation
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Suggestions basées sur ce qui est tapé. Vide si le champ est vide.
  const suggestions = useMemo(() => {
    const q = designation.trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products
      .filter(
        (p) =>
          p.designation.toLowerCase().includes(q) ||
          (p.reference ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [products, designation]);

  useLayoutEffect(() => {
    if (!open || !inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setCoords({ left: r.left, top: r.bottom + 2, width: r.width });
  }, [open, designation]);

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

  function choose(p: SalesProduct) {
    onPickProduct(p);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && e.key === "ArrowDown") {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      // Enter choisit la suggestion en surbrillance SEULEMENT si le panneau est ouvert
      // et qu'il y a des suggestions ; sinon on laisse le texte libre tel quel.
      if (open && suggestions[highlight]) {
        e.preventDefault();
        choose(suggestions[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const panel =
    open && coords && suggestions.length > 0 ? (
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
        <div className="combo-hint">
          Suggestions du catalogue — ou continuez à taper
        </div>
        {suggestions.map((p, i) => (
          <div
            key={p.id}
            className={"combo-option" + (i === highlight ? " highlight" : "")}
            onMouseEnter={() => setHighlight(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              choose(p);
            }}
          >
            <span className="combo-ref">
              {p.reference ? p.reference + " · " : ""}
              {p.designation}
            </span>
            {(p.default_sale_price != null ||
              p.default_purchase_price != null) && (
              <span className="combo-desig">
                {p.default_purchase_price != null
                  ? `achat ${p.default_purchase_price}`
                  : ""}
                {p.default_purchase_price != null &&
                p.default_sale_price != null
                  ? " · "
                  : ""}
                {p.default_sale_price != null
                  ? `vente ${p.default_sale_price}`
                  : ""}
              </span>
            )}
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div className="combo">
      <input
        ref={inputRef}
        className="input combo-input"
        value={designation}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onChange={(e) => {
          onChangeText(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
      />
      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
