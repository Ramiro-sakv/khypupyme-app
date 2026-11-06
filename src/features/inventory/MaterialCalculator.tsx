import { useState } from 'react';
import { boxesForArea } from '../../../shared/product-specification';
import type { ProductSpecification } from '../../../shared/product-specification';
import { Feedback } from '../../shared/components/Feedback';
export function MaterialCalculator({
  specification,
  onQuantity,
}: {
  specification: ProductSpecification;
  onQuantity: (quantity: number) => void;
}) {
  const [area, setArea] = useState(''),
    [waste, setWaste] = useState('10'),
    [error, setError] = useState(''),
    [result, setResult] = useState<number>();
  if (specification.kind !== 'ceramic') return null;
  return (
    <details className="material-calculator">
      <summary>Calcular cajas para un área</summary>
      <label htmlFor="materialArea">Área a cubrir (m²)</label>
      <input
        id="materialArea"
        value={area}
        inputMode="decimal"
        onChange={(event) => {
          setArea(event.target.value);
          setResult(undefined);
        }}
      />
      <label htmlFor="materialWaste">Merma prevista (%)</label>
      <input
        id="materialWaste"
        value={waste}
        type="number"
        min={0}
        max={30}
        step={1}
        onChange={(event) => {
          setWaste(event.target.value);
          setResult(undefined);
        }}
      />
      <p>Estimación de cajas completas. Verifica las medidas y el tono con tu cliente.</p>
      <button
        type="button"
        onClick={() => {
          try {
            const quantity = boxesForArea(area, Number(waste), specification);
            setResult(quantity);
            onQuantity(quantity);
            setError('');
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      >
        Usar cantidad calculada
      </button>
      {result !== undefined && <p role="status">Cantidad: {result} cajas</p>}
      <Feedback error={error} />
    </details>
  );
}
