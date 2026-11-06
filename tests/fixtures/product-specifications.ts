import type { ProductSpecification, SpecificationKind } from '../../shared/product-specification';
export const specifications: Record<SpecificationKind, ProductSpecification> = {
  general: { version: 1, kind: 'general', unit: 'unit', attributes: { reference: 'REF-1' } },
  timber: {
    version: 1,
    kind: 'timber',
    unit: 'piece',
    attributes: { species: 'Pino', lengthMm: 3000, widthMm: 200, thicknessMm: 25 },
  },
  apparel: {
    version: 1,
    kind: 'apparel',
    unit: 'pair',
    attributes: { reference: 'ZAP-1', size: '38', color: 'Negro' },
  },
  appliance: {
    version: 1,
    kind: 'appliance',
    unit: 'piece',
    attributes: { brand: 'Marca de prueba', model: 'REF-300', warrantyMonths: 12 },
  },
  perishable: {
    version: 1,
    kind: 'perishable',
    unit: 'unit',
    attributes: { barcode: '7890000000000', lot: 'L-01', expiresOn: '2099-12-31' },
  },
  ceramic: {
    version: 1,
    kind: 'ceramic',
    unit: 'box',
    attributes: {
      reference: 'PISO-60',
      tone: 'A',
      caliber: '60',
      coverageCm2: 14400,
      piecesPerBox: 4,
    },
  },
  cement: {
    version: 1,
    kind: 'cement',
    unit: 'bag',
    attributes: {
      brand: 'Marca de prueba',
      grade: 'IP-30',
      weightGrams: 50000,
      lot: 'C-01',
      expiresOn: '',
    },
  },
};
