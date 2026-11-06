import type { SpecificationKind, StockUnit } from '../../../shared/product-specification';
import { SPECIFICATIONS, UNIT_LABELS } from '../../../shared/product-specification';
export function SpecificationFields({
  kind,
  unit,
}: {
  kind: SpecificationKind;
  unit?: StockUnit | undefined;
}) {
  const schema = SPECIFICATIONS[kind];
  return (
    <fieldset className="specification-fields">
      <legend>{schema.name}</legend>
      <p>{schema.help}</p>
      <label htmlFor="stockUnit">Unidad de existencias y venta</label>
      <select id="stockUnit" name="stockUnit" defaultValue={unit ?? schema.units[0]}>
        {schema.units.map((id) => (
          <option key={id} value={id}>
            {UNIT_LABELS[id]}
          </option>
        ))}
      </select>
      <div className="form-columns">
        {schema.fields.map((field) => (
          <div key={field.key}>
            <label htmlFor={`spec-${field.key}`}>
              {field.label}
              {field.min === 0 && field.type !== 'integer' ? ' (opcional)' : ''}
            </label>
            <input
              id={`spec-${field.key}`}
              name={`spec-${field.key}`}
              type={field.type === 'integer' ? 'number' : field.type}
              required={field.type === 'integer' || field.min > 0}
              min={
                field.type === 'date'
                  ? '2000-01-01'
                  : field.type === 'integer'
                    ? field.min
                    : undefined
              }
              max={
                field.type === 'date'
                  ? '2099-12-31'
                  : field.type === 'integer'
                    ? field.max
                    : undefined
              }
              step={field.type === 'integer' ? 1 : undefined}
              minLength={field.type === 'text' ? field.min : undefined}
              maxLength={field.type === 'text' ? field.max : undefined}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
