import type {
  ProductSpecification,
  SpecificationKind,
} from '../../../shared/product-specification';
import { SPECIFICATIONS, validateSpecification } from '../../../shared/product-specification';
export function specificationFromForm(
  form: FormData,
  kind: SpecificationKind,
): ProductSpecification {
  return validateSpecification({
    version: 1,
    kind,
    unit: String(form.get('stockUnit')),
    attributes: Object.fromEntries(
      SPECIFICATIONS[kind].fields.map((field) => [
        field.key,
        field.type === 'integer'
          ? Number(form.get(`spec-${field.key}`))
          : String(form.get(`spec-${field.key}`) ?? ''),
      ]),
    ),
  });
}
