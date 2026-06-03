import { Decimal } from 'decimal.js';

export type Dimension = 'WEIGHT' | 'VOLUME' | 'COUNT';
export type Unit = 'g' | 'kg' | 'mL' | 'L' | 'items';

export const DIMENSIONS: Record<Dimension, { baseUnit: Unit; units: Unit[] }> = {
  WEIGHT: {
    baseUnit: 'g',
    units: ['g', 'kg'],
  },
  VOLUME: {
    baseUnit: 'mL',
    units: ['mL', 'L'],
  },
  COUNT: {
    baseUnit: 'items',
    units: ['items'],
  },
};

export const UNIT_LABELS: Record<Unit, string> = {
  g: 'Grams (g)',
  kg: 'Kilograms (kg)',
  mL: 'Milliliters (mL)',
  L: 'Liters (L)',
  items: 'Items (count)',
};

// Conversion factors to base units (grams, milliliters, items)
const CONVERSION_FACTORS: Record<Unit, number> = {
  g: 1,
  kg: 1000,
  mL: 1,
  L: 1000,
  items: 1,
};

/**
 * Checks if a unit belongs to a specific dimension.
 */
export function isValidUnitForDimension(unit: Unit, dimension: Dimension): boolean {
  return DIMENSIONS[dimension]?.units.includes(unit) || false;
}

/**
 * Converts a quantity from the given unit to the dimension's base unit.
 */
export function toBaseUnit(quantity: string | number | Decimal, unit: Unit): Decimal {
  const q = new Decimal(quantity);
  const factor = new Decimal(CONVERSION_FACTORS[unit]);
  return q.times(factor);
}

/**
 * Converts a quantity from the dimension's base unit to the target unit.
 */
export function fromBaseUnit(quantityInBase: string | number | Decimal, targetUnit: Unit): Decimal {
  const q = new Decimal(quantityInBase);
  const factor = new Decimal(CONVERSION_FACTORS[targetUnit]);
  return q.dividedBy(factor);
}

/**
 * Converts a quantity between any two units of the same dimension.
 */
export function convertQuantity(
  quantity: string | number | Decimal,
  fromUnit: Unit,
  toUnit: Unit
): Decimal {
  const base = toBaseUnit(quantity, fromUnit);
  return fromBaseUnit(base, toUnit);
}

/**
 * Calculates the total price for an ordered quantity in a given unit,
 * based on a pricing rate configured for a specific pricing unit.
 * 
 * Formula:
 * 1. Convert ordered quantity to base unit.
 * 2. Calculate the price rate per base unit: pricingPrice / (1 pricingUnit in base units).
 * 3. Total price = (ordered quantity in base) * (price rate per base).
 */
export function calculatePrice(
  orderedQuantity: string | number | Decimal,
  orderedUnit: Unit,
  priceRate: string | number | Decimal,
  priceUnit: Unit
): Decimal {
  const qtyBase = toBaseUnit(orderedQuantity, orderedUnit);
  const priceRateDec = new Decimal(priceRate);
  
  // Size of 1 price unit in base units (e.g. 1 kg = 1000 g)
  const priceUnitSizeInBase = toBaseUnit(1, priceUnit);
  
  // Rate per base unit (e.g. Price per gram = Price per kg / 1000)
  const pricePerBaseUnit = priceRateDec.dividedBy(priceUnitSizeInBase);
  
  // Total Price = Quantity in Base * Price per Base
  return qtyBase.times(pricePerBaseUnit);
}
