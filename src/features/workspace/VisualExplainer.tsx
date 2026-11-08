import { errorMessage } from "../../shared/errors";
import { displayQuantity as showQuantity } from "../../../shared/workspace/presentation";
import { useState } from "react";
import {
  compare,
  ceil,
  decimal,
  div,
  fraction,
  mul,
} from "../../../shared/workspace/exact";
import type { IndustryGuide } from "../../../shared/workspace/industry-workflows";
export default function VisualExplainer({ guide }: { guide: IndustryGuide }) {
  const [a, setA] = useState(
      guide.visual === "timber"
        ? "3000"
        : guide.visual === "cement"
          ? "2"
          : "12",
    ),
    [b, setB] = useState(
      guide.visual === "timber"
        ? "200"
        : guide.visual === "cement"
          ? "50"
          : "1.44",
    ),
    [c, setC] = useState(guide.visual === "timber" ? "25" : "10"),
    [step, setStep] = useState(0);
  let result = "",
    error = "";
  try {
    if (guide.visual === "timber") {
      const mm3 = mul(mul(decimal(a, 3), decimal(b, 3)), decimal(c, 3));
      if (mm3.n === "0") throw new Error("Usa dimensiones mayores a cero.");
      result =
        showQuantity(div(mm3, fraction(1000000000n))) +
        " m³ · " +
        showQuantity(div(mm3, fraction(294967152n, 125n))) +
        " pies tablares por pieza";
    } else if (guide.visual === "ceramics") {
      const waste = decimal(c);
      if (compare(waste, fraction(30n)) > 0)
        throw new Error("La merma admite de 0 a 30 %.");
      const surface = mul(
          decimal(a),
          fraction(
            100n * BigInt(waste.d) + BigInt(waste.n),
            100n * BigInt(waste.d),
          ),
        ),
        boxes = ceil(div(surface, decimal(b)));
      result =
        showQuantity(boxes) +
        " cajas completas · " +
        showQuantity(mul(boxes, decimal(b))) +
        " m² de cobertura";
    } else if (guide.visual === "cement") {
      const bags = decimal(a);
      if (bags.d !== "1") throw new Error("Usa bolsas completas.");
      result =
        showQuantity(mul(bags, decimal(b))) +
        " kg después de abrir las bolsas; conserva el valor total.";
    }
  } catch (e) {
    error = errorMessage(e, "Revisa los valores.");
  }
  const calculator = ["timber", "ceramics", "cement"].includes(guide.visual);
  return (
    <section className="card visual-explainer">
      <span className="eyebrow">
        {calculator ? "SIMULADOR SIN GUARDADO" : "EXPLORA EL RECORRIDO"}
      </span>
      {calculator ? (
        <>
          <svg
            viewBox="0 0 480 190"
            role="img"
            aria-label={
              guide.visual === "timber"
                ? "Pieza de madera con largo, ancho y espesor"
                : guide.visual === "ceramics"
                  ? "Superficie cubierta por cajas de cerámica"
                  : "Bolsas de cemento convertidas a kg"
            }
          >
            {guide.visual === "timber" ? (
              <>
                <path
                  d="M50 80L330 40L420 80L140 130Z M50 80V115L140 165L420 115V80 M140 130V165"
                  fill="#e9c994"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <text x="190" y="35">
                  Largo {a} mm
                </text>
                <text x="5" y="170">
                  Ancho {b} mm
                </text>
                <text x="315" y="155">
                  Espesor {c} mm
                </text>
              </>
            ) : guide.visual === "ceramics" ? (
              <>
                {Array.from({ length: 20 }, (_, i) => (
                  <rect
                    key={i}
                    x={35 + (i % 5) * 80}
                    y={15 + Math.floor(i / 5) * 40}
                    width="75"
                    height="35"
                    rx="3"
                    fill={i < 18 ? "#e9c6b7" : "#f5eee9"}
                    stroke="currentColor"
                  />
                ))}
                <text x="65" y="188">
                  Superficie solicitada + merma → cajas completas
                </text>
              </>
            ) : (
              <>
                <rect
                  x="45"
                  y="35"
                  width="95"
                  height="120"
                  rx="12"
                  fill="#e1e5e4"
                  stroke="currentColor"
                />
                <text x="67" y="100">
                  {a} bolsas
                </text>
                <path
                  d="M165 95H285M265 75L285 95L265 115"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  d="M310 145L365 50L430 145Z"
                  fill="#c4d8cc"
                  stroke="currentColor"
                />
                <text x="322" y="170">
                  Granel en kg
                </text>
              </>
            )}
          </svg>
          <div className="simulator-fields">
            <label>
              {guide.visual === "timber"
                ? "Largo mm"
                : guide.visual === "cement"
                  ? "Bolsas completas"
                  : "Superficie m²"}
              <input
                inputMode="decimal"
                value={a}
                onChange={(e) => setA(e.target.value)}
                maxLength={15}
              />
            </label>
            <label>
              {guide.visual === "timber"
                ? "Ancho mm"
                : guide.visual === "cement"
                  ? "Peso por bolsa kg"
                  : "Cobertura por caja m²"}
              <input
                inputMode="decimal"
                value={b}
                onChange={(e) => setB(e.target.value)}
                maxLength={15}
              />
            </label>
            {guide.visual !== "cement" && (
              <label>
                {guide.visual === "timber" ? "Espesor mm" : "Merma % (0–30)"}
                <input
                  inputMode="decimal"
                  value={c}
                  onChange={(e) => setC(e.target.value)}
                  maxLength={10}
                />
              </label>
            )}
          </div>
          <output aria-live="polite">{error || result}</output>
          <p className="muted">
            Simulación ilustrativa. No usa ni modifica existencias. Al cotizar
            selecciona la ficha y sus conversiones reales.
          </p>
        </>
      ) : (
        <>
          <svg
            viewBox="0 0 480 120"
            role="img"
            aria-label="Pasos relacionados del proceso del negocio"
          >
            {guide.steps.map((_, i) => (
              <g key={i}>
                <circle
                  cx={55 + i * 115}
                  cy="48"
                  r="27"
                  fill={i === step ? "#0c6047" : "#dcece5"}
                />
                <text
                  x={50 + i * 115}
                  y="54"
                  fill={i === step ? "white" : "#12382a"}
                >
                  {i + 1}
                </text>
                {i < 3 && (
                  <path
                    d={"M" + (88 + i * 115) + " 48h43"}
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                )}
              </g>
            ))}
            <text x="35" y="108">
              {guide.visual === "lots"
                ? "Recibir → ordenar por vencimiento → vender → reponer"
                : guide.visual === "serial"
                  ? "Recibir → identificar → atender → conservar evidencia"
                  : guide.visual === "calendar"
                    ? "Planificar → confirmar → realizar → vender"
                    : "Preparar → registrar → revisar → completar"}
            </text>
          </svg>
          <div className="guide-steps">
            {guide.steps.map((s, i) => (
              <button
                key={s}
                aria-pressed={step === i}
                onClick={() => setStep(i)}
              >
                {i + 1}. {s}
              </button>
            ))}
          </div>
          <p aria-live="polite">
            <strong>{guide.steps[step]}</strong>
          </p>
          <p>{guide.example}</p>
        </>
      )}
    </section>
  );
}
