import mongoose from 'mongoose';
import { Product } from '../models/Product';

// Stock is kept to 3 decimals. Adding/subtracting decimals (0.1 + 0.2) leaves float noise
// like 6.800000000000001, which then shows up on screen and in exports.
export const QTY_DECIMALS = 3;

export const roundQty = (n: number): number => {
  const factor = 10 ** QTY_DECIMALS;
  return Math.round((Number(n) || 0) * factor) / factor;
};

/**
 * Rounds the stored stock of the given products to 3 decimals, in the database itself.
 * Call it after any $inc on currentStock ($inc can't round on its own).
 */
export const roundStoredStock = async (
  productIds: Array<mongoose.Types.ObjectId | string | null | undefined>
): Promise<void> => {
  const ids = productIds
    .filter((id): id is mongoose.Types.ObjectId | string => Boolean(id))
    .map((id) => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id));
  if (ids.length === 0) return;
  await Product.collection.updateMany({ _id: { $in: ids } }, [
    { $set: { currentStock: { $round: [{ $ifNull: ['$currentStock', 0] }, QTY_DECIMALS] } } },
  ]);
};
