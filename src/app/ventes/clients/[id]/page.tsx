"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatFCFA } from "@/lib/format";
import { ErrorBox, Loading, EmptyState } from "@/components/ui";

type View = "releve" | "impayees";

export default function ClientLedgerPage() {
  const params = useParams();
  const clientId = String(params.id);
  const [view, setView] = useState<View>("releve");

  const ledger = useAsync(() => api.clientLedger(clientId), [clientId]);
  const data = ledger.data;

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ marginBottom: 4 }}>
            <Link href="/ventes/clients" className="btn-link">
              ← Retour aux clients
            </Link>
          </div>
          <h1>{data ? data.client_name : "Grand livre"}</h1>
          <div className="sub">
            Grand livre — compte courant du client — montants TTC (TVA 18%
            incluse)
          </div>
        </div>
      </div>

      {ledger.loading && <Loading />}
      {ledger.error && <ErrorBox message={ledger.error} />}

      {data && (
        <>
          {/* Récap */}
          <div className="ledger-cards">
            <div className="ledger-card">
              <div className="ledger-card-label">Total vendu</div>
              <div className="ledger-card-value">
                {formatFCFA(data.total_sold)}
              </div>
            </div>
            <div className="ledger-card">
              <div className="ledger-card-label">Total payé</div>
              <div
                className="ledger-card-value"
                style={{ color: "var(--success)" }}
              >
                {formatFCFA(data.total_paid)}
              </div>
            </div>
            <div className="ledger-card ledger-card-balance">
              <div className="ledger-card-label">Solde dû</div>
              <div
                className="ledger-card-value"
                style={{
                  color:
                    Number(data.balance) > 0
                      ? "var(--danger)"
                      : "var(--success)",
                }}
              >
                {formatFCFA(data.balance)}
              </div>
            </div>
          </div>

          {/* Bascule de vue */}
          <div className="ledger-tabs">
            <button
              className={"ledger-tab" + (view === "releve" ? " active" : "")}
              onClick={() => setView("releve")}
            >
              Relevé chronologique
            </button>
            <button
              className={"ledger-tab" + (view === "impayees" ? " active" : "")}
              onClick={() => setView("impayees")}
            >
              Ventes impayées ({data.unpaid_sales.length})
            </button>
          </div>

          {/* Vue 1 : relevé chronologique */}
          {view === "releve" && (
            <div className="table-wrap">
              {data.entries.length === 0 ? (
                <EmptyState
                  message="Aucune opération"
                  hint="Ce client n'a ni vente ni paiement."
                />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Opération</th>
                      <th className="num">Débit</th>
                      <th className="num">Crédit</th>
                      <th className="num">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e, i) => (
                      <tr key={i}>
                        <td>{formatDate(e.date)}</td>
                        <td>
                          <span className="mono">{e.ref}</span>{" "}
                          <span className="muted">
                            {e.kind === "sale" ? "— Vente" : "— Versement"}
                          </span>
                        </td>
                        <td
                          className="num"
                          style={{
                            color: e.debit ? "var(--danger)" : undefined,
                          }}
                        >
                          {e.debit ? (
                            formatFCFA(e.debit)
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td
                          className="num"
                          style={{
                            color: e.credit ? "var(--success)" : undefined,
                          }}
                        >
                          {e.credit ? (
                            formatFCFA(e.credit)
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {formatFCFA(e.running_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Vue 2 : ventes impayées */}
          {view === "impayees" && (
            <div className="table-wrap">
              {data.unpaid_sales.length === 0 ? (
                <EmptyState
                  message="Aucune vente impayée"
                  hint="Ce client est à jour."
                />
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>N° vente</th>
                      <th>Date</th>
                      <th className="num">Total</th>
                      <th className="num">Payé</th>
                      <th className="num">Reste dû</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unpaid_sales.map((s) => (
                      <tr key={s.id}>
                        <td className="mono">{s.sale_number}</td>
                        <td>{formatDate(s.sale_date)}</td>
                        <td className="num">{formatFCFA(s.total_sale)}</td>
                        <td className="num" style={{ color: "var(--success)" }}>
                          {formatFCFA(s.paid)}
                        </td>
                        <td
                          className="num"
                          style={{ fontWeight: 700, color: "var(--danger)" }}
                        >
                          {formatFCFA(s.remaining)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
