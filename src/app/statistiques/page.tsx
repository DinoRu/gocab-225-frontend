"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatNumber, todayISO } from "@/lib/format";
import type { PartStatRow, VehicleModel } from "@/lib/types";
import { ErrorBox, Loading } from "@/components/ui";

type SortKey = "reference" | "designation" | "models_label" | "total_quantity_ordered";
type SortDir = "asc" | "desc";

// Fenêtres relatives pratiques, calculées côté client.
function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { key: "3m", label: "3 mois" },
  { key: "6m", label: "6 mois" },
  { key: "12m", label: "12 mois" },
  { key: "all", label: "Tout" },
  { key: "custom", label: "Personnalisé" },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

export default function StatisticsPage() {
  const [preset, setPreset] = useState<PresetKey>("12m");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState(todayISO());
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_quantity_ordered");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Résout les bornes de dates selon le preset.
  const { startDate, endDate } = useMemo(() => {
    switch (preset) {
      case "3m":
        return { startDate: monthsAgoISO(3), endDate: todayISO() };
      case "6m":
        return { startDate: monthsAgoISO(6), endDate: todayISO() };
      case "12m":
        return { startDate: monthsAgoISO(12), endDate: todayISO() };
      case "all":
        return { startDate: "", endDate: "" };
      case "custom":
        return { startDate: customStart, endDate: customEnd };
    }
  }, [preset, customStart, customEnd]);

  const brands = useAsync(() => api.listBrands(), []);
  const suppliers = useAsync(() => api.listSuppliers(), []);
  const filterModels = useAsync(
    () => (brandId ? api.brandModels(brandId) : Promise.resolve<VehicleModel[]>([])),
    [brandId]
  );

  const stats = useAsync(
    () =>
      api.partsStats({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        brand_id: brandId || undefined,
        vehicle_model_id: modelId || undefined,
        supplier_id: supplierId || undefined,
      }),
    [startDate, endDate, brandId, modelId, supplierId]
  );

  // Recherche + tri appliqués côté client sur le résultat complet.
  const rows = useMemo(() => {
    let list: PartStatRow[] = stats.data ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) ||
          r.designation.toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      let cmp: number;
      if (sortKey === "total_quantity_ordered") {
        cmp = a.total_quantity_ordered - b.total_quantity_ordered;
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]), "fr");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [stats.data, search, sortKey, sortDir]);

  const totalQty = useMemo(
    () => rows.reduce((s, r) => s + r.total_quantity_ordered, 0),
    [rows]
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "total_quantity_ordered" ? "desc" : "asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const exportHref = api.exportUrl({
    start_date: startDate || undefined,
    end_date: endDate || undefined,
    brand_id: brandId || undefined,
    vehicle_model_id: modelId || undefined,
    supplier_id: supplierId || undefined,
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Statistiques des quantités commandées</h1>
          <div className="sub">Quantité totale commandée pour chaque pièce</div>
        </div>
        <a className="btn" href={exportHref} target="_blank" rel="noopener noreferrer">
          Exporter en Excel
        </a>
      </div>

      <div className="toolbar">
        <div className="field">
          <label>Période</label>
          <select
            className="select"
            value={preset}
            onChange={(e) => setPreset(e.target.value as PresetKey)}
          >
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {preset === "custom" && (
          <>
            <div className="field">
              <label>Du</label>
              <input
                className="input"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Au</label>
              <input
                className="input"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="field">
          <label>Marque</label>
          <select
            className="select"
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setModelId("");
            }}
          >
            <option value="">Toutes</option>
            {brands.data?.items.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Modèle</label>
          <select
            className="select"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={!brandId}
          >
            <option value="">Tous</option>
            {filterModels.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Fournisseur</label>
          <select
            className="select"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">Tous</option>
            {suppliers.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Recherche</label>
          <input
            className="input"
            placeholder="Référence ou désignation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {stats.error && <ErrorBox message={stats.error} />}

      {!stats.error && (
        <div className="kpi-grid">
          <div className="kpi">
            <div className="label">Références commandées</div>
            <div className="value">{formatNumber(rows.length)}</div>
          </div>
          <div className="kpi">
            <div className="label">Quantité totale</div>
            <div className="value accent">{formatNumber(totalQty)}</div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="clickable" onClick={() => toggleSort("reference")}>
                Référence{sortIndicator("reference")}
              </th>
              <th className="clickable" onClick={() => toggleSort("designation")}>
                Désignation{sortIndicator("designation")}
              </th>
              <th className="clickable" onClick={() => toggleSort("models_label")}>
                Modèles compatibles{sortIndicator("models_label")}
              </th>
              <th
                className="clickable num"
                onClick={() => toggleSort("total_quantity_ordered")}
              >
                Quantité commandée{sortIndicator("total_quantity_ordered")}
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.loading && !stats.data ? (
              <tr>
                <td colSpan={4}>
                  <Loading />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty">
                  Aucune pièce commandée sur cette période.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.part_id}>
                  <td className="mono">
                    <Link href={`/pieces/${r.part_id}`} style={{ color: "var(--accent)" }}>
                      {r.reference}
                    </Link>
                  </td>
                  <td>{r.designation}</td>
                  <td>
                    {r.is_universal ? (
                      <span className="badge accent">Universel</span>
                    ) : (
                      r.models_label
                    )}
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {formatNumber(r.total_quantity_ordered)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--bg)", fontWeight: 700 }}>
                <td colSpan={4} style={{ textAlign: "right", padding: "8px 12px" }}>
                  Total général
                </td>
                <td className="num" style={{ padding: "8px 12px" }}>
                  {formatNumber(totalQty)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
