import { errorMessage } from "../../shared/errors";
import { useState } from "react";
import { showQuantity } from "../../../shared/workspace/exact";
import type { Item, SaleLineInputV2 } from "../../../shared/workspace/model";
import { useRecords, useWorkspace } from "./context";
import { localDate } from "./format";
import { Pager } from "./ui";

interface Quote {
  customerId: string;
  id: string;
  number: string;
  validUntil: string;
  customerName: string;
  discountMinor: number;
  lines: SaleLineInputV2[];
}
export default function Quotes({
  onConvert,
}: {
  onConvert: (q: {
    priceChanged: boolean;
    customerId: string;
    id: string;
    customerName: string;
    discountMinor: number;
    lines: (Omit<SaleLineInputV2, "qty"> & { item: Item; qty: string })[];
  }) => void;
}) {
  const page = useRecords<Quote>("quotes"),
    { business, repository } = useWorkspace(),
    [error, setError] = useState("");
  return (
    <details>
      <summary data-tutorial="quote-history">Cotizaciones anteriores</summary>
      <Pager page={page} />
      {error && <p role="alert">{error}</p>}
      {page.items.map((row) => (
        <article className="card" key={row.id}>
          {row.number} · {row.customerName} · vigente hasta{" "}
          {localDate(row.validUntil)}
          <button
            onClick={() => {
              void (async () => {
                try {
                  const lines = await Promise.all(
                    row.lines.map(async (l) => {
                      const item = (
                        await repository.list<Item>({
                          apiVersion: 2,
                          businessId: business.id,
                          resource: "items",
                          id: l.itemId,
                        })
                      ).items[0];
                      if (!item || !item.active)
                        throw new Error("Producto no disponible o archivado.");
                      return { ...l, item, qty: showQuantity(l.qty) };
                    }),
                  );
                  onConvert({
                    ...row,
                    lines,
                    priceChanged: lines.some(
                      (line) =>
                        line.expectedPriceMinor !== line.item.priceMinor,
                    ),
                  });
                } catch (e) {
                  setError(errorMessage(e, "No se pudo cargar."));
                }
              })();
            }}
          >
            Revisar y convertir a venta
          </button>
        </article>
      ))}
    </details>
  );
}
