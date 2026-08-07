"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth";
import { formatDate, formatFCFA, formatNumber } from "@/lib/format";
import type { PartOrderHistoryRow } from "@/lib/types";
import { ErrorBox, Loading } from "@/components/ui";

// Somme des quantités d'un historique sur les N derniers mois (calcul client).
function sumSince(history: PartOrderHistoryRow[], months: number): number {
  const floor = new Date();
  floor.setMonth(floor.getMonth() - months);
  return history
    .filter((h) => new Date(h.order_date) >= floor)
    .reduce((s, h) => s + h.quantity, 0);
}

export default function PartDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const id = params.id;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const part = useAsync(() => api.getPart(id), [id]);

  // Fournisseurs et historique commandes = réservés admin (ils contiennent/filtrent
  // des prix). Pour un magazinier, on ne déclenche PAS ces appels (sinon 403).
  const suppliers = useAsync(
    () =>
      isAdmin
        ? api.listSuppliers()
        : Promise.resolve({ items: [], total: 0, page: 1, pages: 0 } as any),
    [isAdmin],
  );
  const history = useAsync(
    () =>
      isAdmin
        ? api.partOrderHistory(id, {
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            supplier_id: supplierId || undefined,
          })
        : Promise.resolve([] as PartOrderHistoryRow[]),
    [id, startDate, endDate, supplierId, isAdmin],
  );
  const fullHistory = useAsync(
    () =>
      isAdmin
        ? api.partOrderHistory(id)
        : Promise.resolve([] as PartOrderHistoryRow[]),
    [id, isAdmin],
  );

  // L'inventaire reste accessible au magazinier.
  const invHistory = useAsync(() => api.partInventoryHistory(id), [id]);

  const summary = useMemo(() => {
    const h = fullHistory.data ?? [];
    return {
      m3: sumSince(h, 3),
      m6: sumSince(h, 6),
      m12: sumSince(h, 12),
      all: h.reduce((s, x) => s + x.quantity, 0),
    };
  }, [fullHistory.data]);

  const filteredTotal = useMemo(
    () => (history.data ?? []).reduce((s, h) => s + h.quantity, 0),
    [history.data],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ marginBottom: 4 }}>
            <button
              className="btn-link"
              onClick={() => router.back()}
              style={{ paddingLeft: 0 }}
            >
              ← Retour
            </button>
          </div>
          <h1>{part.data ? part.data.reference : "Pièce"}</h1>
          <div className="sub">{part.data?.designation}</div>
        </div>
      </div>

      {part.error && <ErrorBox message={part.error} />}
      {part.loading && !part.data && <Loading />}

      {part.data && (
        <>
          {/* Fiche d'identité */}
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="detail-grid">
              <DetailField label="Référence" value={part.data.reference} mono />
              <DetailField label="Désignation" value={part.data.designation} />
              <DetailField
                label="Modèles compatibles"
                value={
                  part.data.is_universal
                    ? "Universel (tous véhicules)"
                    : part.data.vehicle_models
                        .map((m) => `${m.brand_name} ${m.name}`)
                        .join(", ")
                }
              />
              <DetailField
                label="Catégorie"
                value={part.data.category || "—"}
              />
            </div>
          </div>

          {/* Quantités + historique des commandes : ADMIN uniquement (prix). */}
          {isAdmin && (
            <>
              {/* Résumé quantités */}
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="label">3 derniers mois</div>
                  <div className="value">{formatNumber(summary.m3)}</div>
                </div>
                <div className="kpi">
                  <div className="label">6 derniers mois</div>
                  <div className="value">{formatNumber(summary.m6)}</div>
                </div>
                <div className="kpi">
                  <div className="label">12 derniers mois</div>
                  <div className="value">{formatNumber(summary.m12)}</div>
                </div>
                <div className="kpi">
                  <div className="label">Total commandé</div>
                  <div className="value accent">
                    {formatNumber(summary.all)}
                  </div>
                </div>
              </div>

              {/* Historique */}
              <div className="page-head" style={{ marginBottom: 8 }}>
                <h1 style={{ fontSize: 15 }}>Historique des commandes</h1>
              </div>

              <div className="toolbar">
                <div className="field">
                  <label>Du</label>
                  <input
                    className="input"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Au</label>
                  <input
                    className="input"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Fournisseur</label>
                  <select
                    className="select"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    <option value="">Tous</option>
                    {suppliers.data?.items.map(
                      (s: { id: string; name: string }) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              {history.error && <ErrorBox message={history.error} />}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>N° commande</th>
                      <th>Fournisseur</th>
                      <th className="num">Quantité</th>
                      <th className="num">Prix unitaire</th>
                      <th className="num">Total ligne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.loading && !history.data ? (
                      <tr>
                        <td colSpan={6}>
                          <Loading />
                        </td>
                      </tr>
                    ) : (history.data ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty">
                          Aucune commande pour cette pièce sur la période.
                        </td>
                      </tr>
                    ) : (
                      history.data!.map((h, i) => (
                        <tr key={`${h.order_number}-${i}`}>
                          <td>{formatDate(h.order_date)}</td>
                          <td className="mono">{h.order_number}</td>
                          <td>{h.supplier_name}</td>
                          <td className="num">{formatNumber(h.quantity)}</td>
                          <td className="num">{formatFCFA(h.unit_price)}</td>
                          <td className="num">{formatFCFA(h.line_total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {(history.data ?? []).length > 0 && (
                    <tfoot>
                      <tr style={{ background: "var(--bg)", fontWeight: 700 }}>
                        <td
                          colSpan={3}
                          style={{ textAlign: "right", padding: "8px 12px" }}
                        >
                          Total sur la période
                        </td>
                        <td className="num" style={{ padding: "8px 12px" }}>
                          {formatNumber(filteredTotal)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}

          {/* Historique inventaire : visible aussi par le magazinier */}
          <div className="page-head" style={{ marginBottom: 8, marginTop: 24 }}>
            <h1 style={{ fontSize: 15 }}>Suivi d'inventaire (sorties)</h1>
          </div>

          {invHistory.error && <ErrorBox message={invHistory.error} />}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N° comptage</th>
                  <th>Date</th>
                  <th className="num">Stock préc.</th>
                  <th className="num">Entrées</th>
                  <th className="num">Compté</th>
                  <th className="num">Sorties</th>
                </tr>
              </thead>
              <tbody>
                {invHistory.loading && !invHistory.data ? (
                  <tr>
                    <td colSpan={6}>
                      <Loading />
                    </td>
                  </tr>
                ) : (invHistory.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      Cette pièce n'a pas encore été comptée en inventaire.
                    </td>
                  </tr>
                ) : (
                  invHistory.data!.map((row, i) => {
                    const first = row.previous_quantity === null;
                    return (
                      <tr
                        key={`${row.count_number}-${i}`}
                        style={
                          row.anomaly
                            ? { background: "var(--danger-soft)" }
                            : undefined
                        }
                      >
                        <td className="mono">{row.count_number}</td>
                        <td>{formatDate(row.count_date)}</td>
                        <td className="num">
                          {first ? (
                            <span className="muted">—</span>
                          ) : (
                            formatNumber(row.previous_quantity)
                          )}
                        </td>
                        <td className="num">
                          {first ? (
                            <span className="muted">—</span>
                          ) : (
                            formatNumber(row.entries_between)
                          )}
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {formatNumber(row.counted_quantity)}
                        </td>
                        <td className="num">
                          {row.outflow === null ? (
                            <span className="badge">Base</span>
                          ) : (
                            <span
                              style={{
                                fontWeight: 700,
                                color: row.anomaly
                                  ? "var(--danger)"
                                  : "var(--text)",
                              }}
                            >
                              {formatNumber(row.outflow)}
                              {row.anomaly && " ⚠"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        className="muted"
        style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}
      >
        {label}
      </div>
      <div
        className={mono ? "mono" : ""}
        style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}
      >
        {value}
      </div>
    </div>
  );
}
