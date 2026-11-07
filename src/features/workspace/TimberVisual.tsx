import { useState } from "react";
import {
  BOARD_FOOT_MM3,
  dimensionToMm,
  timberDimensions,
  timberVolume,
} from "../../../shared/workspace/timber-measures";
import { div, fraction, showQuantity } from "../../../shared/workspace/exact";
import { useWorkspace } from "./context";
export default function TimberVisual() {
  const { business } = useWorkspace(),
    system = business.timberSystem ?? "imperial",
    [values, setValues] = useState(() =>
      system === "imperial"
        ? { lengthMm: "10", widthMm: "6", thicknessMm: "2" }
        : { lengthMm: "3048", widthMm: "152.4", thicknessMm: "50.8" },
    );
  let result = "",
    error = "";
  try {
    const fields = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        dimensionToMm(value, key, system),
      ]),
    );
    result =
      timberDimensions(fields, system) +
      " = " +
      showQuantity(
        div(
          timberVolume(fields),
          system === "imperial" ? BOARD_FOOT_MM3 : fraction(1000000000n),
        ),
      ) +
      (system === "imperial" ? " pies tablares" : " m³");
  } catch (e) {
    error = e instanceof Error ? e.message : "Revisa las medidas.";
  }
  return (
    <section className="card visual-explainer">
      <span className="eyebrow">SIMULADOR SIN GUARDADO</span>
      <svg
        viewBox="0 0 480 190"
        role="img"
        aria-label="Tabla con largo, ancho y espesor declarados"
      >
        <path
          d="M50 80L330 40L420 80L140 130Z M50 80V115L140 165L420 115V80 M140 130V165"
          fill="#e9c994"
          stroke="currentColor"
          strokeWidth="3"
        />
        <text x="160" y="32">
          Largo {values.lengthMm} {system === "imperial" ? "pies" : "mm"}
        </text>
        <text x="5" y="180">
          Ancho {values.widthMm} {system === "imperial" ? "pulgadas" : "mm"}
        </text>
        <text x="280" y="155">
          Espesor {values.thicknessMm}{" "}
          {system === "imperial" ? "pulgadas" : "mm"}
        </text>
      </svg>
      <div className="simulator-fields">
        {Object.keys(values).map((key) => (
          <label key={key}>
            {
              (
                {
                  lengthMm: "Largo",
                  widthMm: "Ancho",
                  thicknessMm: "Espesor",
                } as Record<string, string>
              )[key]
            }{" "}
            (
            {system === "metric"
              ? "mm"
              : key === "lengthMm"
                ? "pies"
                : "pulgadas"}
            )
            <input
              value={values[key as keyof typeof values]}
              onChange={(e) =>
                setValues((old) => ({ ...old, [key]: e.target.value }))
              }
              maxLength={30}
            />
          </label>
        ))}
      </div>
      <output aria-live="polite">{error || result}</output>
      <p>
        Medidas declaradas; admite decimales o fracciones como 1 1/2. La
        simulación no modifica existencias.
      </p>
    </section>
  );
}
