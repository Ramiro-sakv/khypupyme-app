import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./accounts.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el contenedor de KhypuPyme.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
