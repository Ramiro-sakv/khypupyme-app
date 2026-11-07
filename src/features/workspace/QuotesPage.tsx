import Trade from "./Trade";
import { useWorkspace } from "./context";
export default function QuotesPage() {
  const { business } = useWorkspace();
  return (
    <section aria-label={"Cotizaciones de " + business.name}>
      <Trade initialQuote />
    </section>
  );
}
