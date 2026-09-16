"use client";

import { Modal } from "@/components/ui";
import { formatFCFA, formatDate } from "@/lib/format";
import { COMPANY } from "@/lib/company";

export type PreviewLine = {
  designation: string;
  quantity: number;
  unit_price: string;
  total: string;
};

export type DocumentModel = {
  title: string; // "FACTURE PROFORMA", "BON DE LIVRAISON"…
  number: string; // PRO-2026-001
  date: string;
  client_name: string;
  meta?: { label: string; value: string }[]; // lignes d'en-tête additionnelles (ex: "Vente liée")
  columns: { qty: string; unit_price: string }; // libellés colonnes ("Qté" / "Qté livrée")
  lines: PreviewLine[];
  // Totaux : soit HT/TVA/TTC (proforma, vente), soit juste un total (BL)
  totals: {
    ht?: string;
    tva?: string;
    ttc?: string;
    simple?: string; // pour le BL : un seul total
  };
  footer_note?: string; // "Ce document est une facture proforma…"
  show_prices?: boolean; // le BL peut vouloir masquer, mais ici on montre
};

export function DocumentPreview({
  model,
  onClose,
  onDownload,
  downloading,
}: {
  model: DocumentModel;
  onClose: () => void;
  onDownload: () => void;
  downloading?: boolean;
}) {
  return (
    <Modal
      title="Aperçu du document"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Fermer
          </button>
          <button
            className="btn btn-primary"
            onClick={onDownload}
            disabled={downloading}
          >
            {downloading ? "Téléchargement…" : "Télécharger le PDF"}
          </button>
        </>
      }
    >
      <div className="doc-preview">
        {/* En-tête */}
        <div className="doc-title">{model.title}</div>
        <div className="doc-company">{COMPANY.name}</div>
        {COMPANY.lines.map((l, i) => (
          <div key={i} className="doc-company-line">
            {l}
          </div>
        ))}

        {/* Méta */}
        <div className="doc-meta">
          <div>
            <div>
              <strong>N° :</strong> {model.number}
            </div>
            <div>
              <strong>Client :</strong> {model.client_name}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div>
              <strong>Date :</strong> {formatDate(model.date)}
            </div>
            {model.meta?.map((m, i) => (
              <div key={i}>
                <strong>{m.label} :</strong> {m.value}
              </div>
            ))}
          </div>
        </div>

        {/* Lignes */}
        <table className="doc-table">
          <thead>
            <tr>
              <th>Désignation</th>
              <th className="num">{model.columns.qty}</th>
              <th className="num">{model.columns.unit_price}</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {model.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.designation}</td>
                <td className="num">{l.quantity}</td>
                <td className="num">{formatFCFA(l.unit_price)}</td>
                <td className="num">{formatFCFA(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totaux */}
        <div className="doc-totals">
          {model.totals.simple !== undefined ? (
            <div className="doc-total-row doc-total-strong">
              <span>TOTAL</span>
              <span>{formatFCFA(model.totals.simple)}</span>
            </div>
          ) : (
            <>
              <div className="doc-total-row">
                <span>Total HT</span>
                <span>{formatFCFA(model.totals.ht ?? "0")}</span>
              </div>
              <div className="doc-total-row">
                <span>TVA (18%)</span>
                <span>{formatFCFA(model.totals.tva ?? "0")}</span>
              </div>
              <div className="doc-total-row doc-total-strong">
                <span>Total TTC</span>
                <span>{formatFCFA(model.totals.ttc ?? "0")}</span>
              </div>
            </>
          )}
        </div>

        {model.footer_note && (
          <div className="doc-footer-note">{model.footer_note}</div>
        )}
      </div>
    </Modal>
  );
}
