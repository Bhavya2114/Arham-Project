export interface LineTaxCalculation {
  subtotal: number;
  gstAmount: number;
  lineTotal: number;
}

export const calculateItemGst = (
  sellingPrice: number,
  quantity: number,
  gstRate: number = 0
): LineTaxCalculation => {
  const subtotal = sellingPrice * quantity;
  const gstAmount = (subtotal * gstRate) / 100;
  const lineTotal = subtotal + gstAmount;
  return { subtotal, gstAmount, lineTotal };
};
