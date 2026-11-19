import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./ui/ui.css";
import "./accounts.css";
import "./workspace.css";
import "./businesses/businesses.css";
import "./commerce/commerce.css";
import "./commerce/operations.css";
import "./billing/plan.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el contenedor de KhypuPyme.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
