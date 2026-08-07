"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { formatFCFA, formatMonth, formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import type { DashboardPeriodParam } from "@/lib/types";
import { ErrorBox, Loading } from "@/components/ui";

const PIE_COLORS = ["#5b48c8", "#3a9d6a", "#d9822b", "#c0392b", "#2b7bbd", "#8e44ad", "#16a085"];

const PERIODS: { value: DashboardPeriodParam; label: string }[] = [
  { value: "3m", label: "3 mois" },
  { value: "6m", label: "6 mois" },
  { value: "12m", label: "12 mois" },
];

export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriodParam>("12m");
  const [brandId, setBrandId] = useState("");

  const brands = useAsync(() => api.listBrands(), []);
  const dash = useAsync(
    () => api.dashboard({ period, brand_id: brandId || undefined }),
    [period, brandId]
  );

  const exportHref = api.exportUrl({ brand_id: brandId || undefined });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tableau de bord</h1>
          <div className="sub">Commandes de pièces détachées — vue d'ensemble</div>
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
            value={period}
            onChange={(e) => setPeriod(e.target.value as DashboardPeriodParam)}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Marque</label>
          <select
            className="select"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
          >
            <option value="">Toutes les marques</option>
            {brands.data?.items.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {dash.error && <ErrorBox message={dash.error} />}
      {dash.loading && !dash.data && <Loading />}

      {dash.data && (
        <>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="label">Commandes</div>
              <div className="value">{formatNumber(dash.data.total_orders)}</div>
            </div>
            <div className="kpi">
              <div className="label">Pièces commandées</div>
              <div className="value">{formatNumber(dash.data.total_quantity)}</div>
            </div>
            <div className="kpi">
              <div className="label">Références distinctes</div>
              <div className="value">{formatNumber(dash.data.distinct_references)}</div>
            </div>
            <div className="kpi">
              <div className="label">Montant total</div>
              <div className="value accent">{formatFCFA(dash.data.total_amount)}</div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart-box">
              <div className="card-title">Quantités commandées par mois</div>
              <div className="chart-inner">
                {dash.data.quantity_by_month.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dash.data.quantity_by_month.map((m) => ({
                        month: formatMonth(m.month),
                        qty: m.total_quantity,
                      }))}
                      margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                      <Bar dataKey="qty" fill="#5b48c8" radius={[2, 2, 0, 0]} name="Quantité" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="chart-box">
              <div className="card-title">Répartition par marque</div>
              <div className="chart-inner">
                {dash.data.quantity_by_brand.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dash.data.quantity_by_brand.map((b) => ({
                          name: b.name,
                          value: b.total_quantity,
                        }))}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={80}
                        label={(e) => e.name}
                        labelLine={false}
                      >
                        {dash.data.quantity_by_brand.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatNumber(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="chart-grid thirds">
            <div className="table-wrap">
              <div className="card-title">Top 10 pièces commandées</div>
              <table>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Désignation</th>
                    <th>Modèles</th>
                    <th className="num">Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.data.top_parts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 20 }}>
                        Aucune donnée
                      </td>
                    </tr>
                  ) : (
                    dash.data.top_parts.map((p) => (
                      <tr key={p.part_id}>
                        <td className="mono">{p.reference}</td>
                        <td>{p.designation}</td>
                        <td>
                          <span className="muted">{p.models_label}</span>
                        </td>
                        <td className="num">{formatNumber(p.total_quantity)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-wrap">
              <div className="card-title">Top fournisseurs</div>
              <table>
                <thead>
                  <tr>
                    <th>Fournisseur</th>
                    <th className="num">Commandes</th>
                    <th className="num">Quantité</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.data.top_suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted" style={{ textAlign: "center", padding: 20 }}>
                        Aucune donnée
                      </td>
                    </tr>
                  ) : (
                    dash.data.top_suppliers.map((s) => (
                      <tr key={s.supplier_id}>
                        <td>{s.name}</td>
                        <td className="num">{formatNumber(s.order_count)}</td>
                        <td className="num">{formatNumber(s.total_quantity)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function EmptyChart() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-faint)",
        fontSize: 13,
      }}
    >
      Aucune donnée sur la période
    </div>
  );
}
