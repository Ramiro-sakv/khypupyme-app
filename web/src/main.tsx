import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StatusPage } from "./StatusPage";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el contenedor de KhypuPyme.");

createRoot(root).render(
  <StrictMode>
    <StatusPage />
  </StrictMode>,
);
