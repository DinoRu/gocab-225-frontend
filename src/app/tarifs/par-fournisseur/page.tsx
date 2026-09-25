"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatFCFA, formatDate } from "@/lib/format";
import type { TariffSupplier } from "@/lib/types";
import { EmptyState, ErrorBox, Loading } from "@/components/ui";

export default function ParFournisseurPage() {
  const [supplierId, setSupplierId] = useState("");
  const suppliers = useAsync(() => api.listTariffSuppliers({ limit: 500 }), []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Prix par fournisseur</h1>
          <div className="sub">
            Le catalogue de tarifs de chaque fournisseur
          </div>
        </div>
      </div>

      <div className="tariff-supplier-layout">
        {/* Liste des fournisseurs à gauche */}
        <div className="tariff-supplier-list">
          {suppliers.loading && <Loading />}
          {suppliers.error && <ErrorBox message={suppliers.error} />}
          {suppliers.data && suppliers.data.items.length === 0 && (
            <p className="muted" style={{ fontSize: 13, padding: 12 }}>
              Aucun fournisseur.
            </p>
          )}
          {suppliers.data?.items.map((s: TariffSupplier) => (
            <button
              key={s.id}
              className={
                "tariff-supplier-item" + (s.id === supplierId ? " active" : "")
              }
              onClick={() => setSupplierId(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Articles du fournisseur sélectionné à droite */}
        <div className="tariff-supplier-detail">
          {supplierId ? (
            <SupplierCatalog supplierId={supplierId} />
          ) : (
            <EmptyState
              message="Choisissez un fournisseur"
              hint="Sélectionnez un fournisseur pour voir ses tarifs."
            />
          )}
        </div>
      </div>
    </>
  );
}

function SupplierCatalog({ supplierId }: { supplierId: string }) {
  const view = useAsync(() => api.supplierPrices(supplierId), [supplierId]);
  const data = view.data;

  return (
    <>
      {view.loading && <Loading />}
      {view.error && <ErrorBox message={view.error} />}
      {data && (
        <>
          <div className="tariff-supplier-head">{data.supplier_name}</div>
          {data.articles.length === 0 ? (
            <EmptyState
              message="Aucun tarif"
              hint="Ce fournisseur n'a pas encore de prix enregistré."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th className="num">Dernier prix</th>
                    <th>Depuis</th>
                  </tr>
                </thead>
                <tbody>
                  {data.articles.map((a) => (
                    <tr key={a.article_id}>
                      <td style={{ fontWeight: 600 }}>
                        {a.designation}
                        {a.reference && (
                          <span
                            className="muted mono"
                            style={{ fontWeight: 400, fontSize: 11 }}
                          >
                            {" "}
                            · {a.reference}
                          </span>
                        )}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {formatFCFA(a.last_price)}
                      </td>
                      <td>{formatDate(a.last_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
