// components/ui/PartSelect.tsx
import { useRef, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { PartDetail } from "@/lib/types";

interface PartSelectProps {
  parts: PartDetail[];
  value: string;
  onChange: (partId: string) => void;
  placeholder?: string;
  loading?: boolean;
}

// Libellé des modèles compatibles : "Universel" ou "Marque Modèle, …"
function modelsLabel(p: PartDetail): string {
  return p.is_universal
    ? "Universel"
    : p.vehicle_models.map((m) => `${m.brand_name} ${m.name}`).join(", ");
}

export function PartSelect({
  parts,
  value,
  onChange,
  placeholder = "Rechercher une pièce…",
  loading = false,
}: PartSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  // Calcul de la position du menu déroulant
  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
        maxHeight: 260,
        overflowY: "auto",
        background: "white",
        border: "1px solid var(--border)",
        borderRadius: 4,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        zIndex: 9999,
        padding: 0,
        margin: 0,
        listStyle: "none",
      });
    }
  };

  // Mise à jour de la position à l'ouverture et au scroll
  useEffect(() => {
    if (open) {
      updateDropdownPosition();
      const handleScroll = () => updateDropdownPosition();
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", updateDropdownPosition);
      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", updateDropdownPosition);
      };
    }
  }, [open]);

  // Fermeture au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return parts;
    const lower = search.toLowerCase();
    return parts.filter(
      (p) =>
        p.reference.toLowerCase().includes(lower) ||
        p.designation.toLowerCase().includes(lower) ||
        modelsLabel(p).toLowerCase().includes(lower),
    );
  }, [parts, search]);

  const selectedPart = parts.find((p) => p.id === value);

  const selectPart = (part: PartDetail) => {
    onChange(part.id);
    setSearch("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const clearSelection = () => {
    onChange("");
    setSearch("");
    setOpen(false);
    inputRef.current?.focus();
  };

  // Le menu déroulant affiché via un portail
  const dropdown = open
    ? createPortal(
        <ul style={dropdownStyle}>
          {loading ? (
            <li style={{ padding: 8, color: "var(--muted)" }}>Chargement…</li>
          ) : filtered.length === 0 ? (
            <li style={{ padding: 8, color: "var(--muted)" }}>
              Aucune pièce trouvée
            </li>
          ) : (
            filtered.map((p) => (
              <li
                key={p.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectPart(p)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border-soft)",
                  fontSize: 14,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div>
                  <span className="mono">{p.reference}</span> — {p.designation}
                </div>
                <div
                  style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}
                >
                  {modelsLabel(p)}
                </div>
              </li>
            ))
          )}
        </ul>,
        document.body,
      )
    : null;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          ref={inputRef}
          className="input"
          type="text"
          placeholder={
            selectedPart
              ? `${selectedPart.reference} — ${selectedPart.designation} (${modelsLabel(selectedPart)})`
              : placeholder
          }
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          onFocus={() => {
            setOpen(true);
            requestAnimationFrame(updateDropdownPosition);
          }}
          disabled={loading}
        />
        {value && (
          <button
            className="btn-link"
            onClick={clearSelection}
            style={{ padding: "0 8px", fontSize: 16 }}
            type="button"
          >
            ✕
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
}
