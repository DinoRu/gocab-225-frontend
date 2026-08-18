"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatFCFA } from "@/lib/format";
import { ErrorBox, Loading } from "@/components/ui";

export default function SalesDashboardPage() {
  const [months, setMonths] = useState(12);
  const dash = useAsync(() => api.salesDashboard(months), [months]);
  const data = dash.data;

  const maxCa = useMemo(
    () => (data ? Math.max(...data.by_month.map((m) => Number(m.ca)), 1) : 1),
    [data],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tableau de bord — Ventes</h1>
          <div className="sub">Chiffre d'affaires, marges et créances</div>
        </div>
        <select
          className="select"
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          style={{ width: 160 }}
        >
          <option value={3}>3 derniers mois</option>
          <option value={6}>6 derniers mois</option>
          <option value={12}>12 derniers mois</option>
        </select>
      </div>

      {dash.loading && <Loading />}
      {dash.error && <ErrorBox message={dash.error} />}

      {data && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Chiffre d'affaires</div>
              <div className="kpi-value">{formatFCFA(data.ca)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Dépenses (achats)</div>
              <div className="kpi-value" style={{ color: "var(--danger)" }}>
                {formatFCFA(data.depenses)}
              </div>
            </div>
            <div className="kpi-card kpi-accent">
              <div className="kpi-label">Bénéfice</div>
              <div className="kpi-value" style={{ color: "var(--accent)" }}>
                {formatFCFA(data.benefice)}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">TVA collectée</div>
              <div className="kpi-value" style={{ color: "var(--text-muted)" }}>
                {formatFCFA(data.tva_collectee)}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Créances</div>
              <div
                className="kpi-value"
                style={{ color: "var(--warning, #b7791f)" }}
              >
                {formatFCFA(data.creances)}
              </div>
            </div>
          </div>

          <div className="sales-dash-grid">
            {/* CA + bénéfice par mois */}
            <div className="panel">
              <div className="panel-title">CA &amp; bénéfice par mois</div>
              {data.by_month.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  Aucune vente sur la période.
                </p>
              ) : (
                <div className="bar-chart">
                  {data.by_month.map((m) => (
                    <div key={m.month} className="bar-col">
                      <div className="bar-stack">
                        <div
                          className="bar bar-ca"
                          style={{ height: `${(Number(m.ca) / maxCa) * 100}%` }}
                          title={`CA ${formatFCFA(m.ca)}`}
                        />
                        <div
                          className="bar bar-benef"
                          style={{
                            height: `${(Number(m.benefice) / maxCa) * 100}%`,
                          }}
                          title={`Bénéfice ${formatFCFA(m.benefice)}`}
                        />
                      </div>
                      <div className="bar-label">{m.month.slice(5)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="chart-legend">
                <span>
                  <span className="dot dot-ca" /> CA
                </span>
                <span>
                  <span className="dot dot-benef" /> Bénéfice
                </span>
              </div>
            </div>

            {/* Top clients */}
            <div className="panel">
              <div className="panel-title">Top clients (CA TTC)</div>
              {data.top_clients.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>
                  Aucune vente sur la période.
                </p>
              ) : (
                <div className="top-list">
                  {data.top_clients.map((c) => (
                    <div key={c.client_id} className="top-row">
                      <span className="top-name">{c.name}</span>
                      <span className="top-value">{formatFCFA(c.ca)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
