import { connectDB, disconnectDB } from '../src/config/database';
import { MaterialConsumption } from '../src/models/MaterialConsumption';
import { Product } from '../src/models/Product';
import { Purchase } from '../src/models/Purchase';

// Ensure models are registered with Mongoose
void Product;
void Purchase;
void MaterialConsumption;

async function backfill(apply = false) {
  await connectDB();
  console.log(`=== HISTORICAL GST BACKFILL & VERIFICATION TOOL (Mode: ${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`);

  const legacyRecords = await MaterialConsumption.find({
    $or: [
      { gstRate: { $exists: false } },
      { gstRate: null },
      { inputGst: { $exists: false } },
      { inputGst: null },
      { issuedMaterialValueIncludingGST: { $exists: false } },
      { issuedMaterialValueIncludingGST: null },
    ],
  }).populate('product').lean();

  console.log(`Found ${legacyRecords.length} legacy MaterialConsumption record(s) missing stored GST data.\n`);

  for (const mc of legacyRecords) {
    console.log(`--------------------------------------------------`);
    console.log(`Consumption ID: ${mc._id}`);
    console.log(`Product: ${mc.productName} (SKU: ${mc.sku})`);
    console.log(`Quantity Issued: ${mc.quantity} ${mc.unit}`);
    console.log(`Actual Cost Total (Excl. GST): ₹${mc.actualCostTotal}`);

    // 1. Check related Product
    const product: any = mc.product;
    const productGstRate = product && product.gstRate != null && Number(product.gstRate) > 0 ? Number(product.gstRate) : null;
    console.log(`Related Product GST Rate: ${productGstRate != null ? `${productGstRate}%` : 'MISSING / INVALID'}`);

    // 2. Check original PurchaseItem in Purchase model
    const purchases: any = await Purchase.find({ 'items.product': mc.product?._id || mc.product }).lean();
    let verifiedPurchaseGstRate: number | null = null;
    let matchedPurchaseNumber: string | null = null;
    let purchaseItemTaxAmount: number | null = null;
    let purchaseItemTaxable: number | null = null;

    for (const pur of purchases) {
      const it = pur.items.find((item: any) => item.product.toString() === (mc.product?._id || mc.product).toString());
      if (it && it.taxRate != null && Number(it.taxRate) > 0) {
        verifiedPurchaseGstRate = Number(it.taxRate);
        matchedPurchaseNumber = pur.purchaseNumber;
        purchaseItemTaxAmount = it.taxAmount;
        purchaseItemTaxable = it.taxableAmount;
        break;
      }
    }

    if (matchedPurchaseNumber) {
      console.log(`Original Purchase Record Found: #${matchedPurchaseNumber}`);
      console.log(`  Purchase Tax Rate: ${verifiedPurchaseGstRate}%`);
      console.log(`  Purchase Item Taxable: ₹${purchaseItemTaxable}, Tax Amount: ₹${purchaseItemTaxAmount}`);
    } else {
      console.log(`Original Purchase Record: None found matching product`);
    }

    // Determine verified GST rate (NEVER assuming 18%)
    const verifiedGstRate = verifiedPurchaseGstRate ?? productGstRate;
    if (verifiedGstRate == null) {
      console.log(`⚠️ CANNOT BACKFILL: Neither purchase record nor product master has a valid GST rate. Manual historical data entry required.`);
      continue;
    }

    const calculatedInputGst = Math.round(((Number(mc.actualCostTotal) * verifiedGstRate) / 100) * 100) / 100;
    const calculatedIssuedValue = Math.round((Number(mc.actualCostTotal) + calculatedInputGst) * 100) / 100;

    console.log(`Verified Historical GST Rate to Apply: ${verifiedGstRate}% (Source: ${verifiedPurchaseGstRate != null ? `Purchase #${matchedPurchaseNumber}` : 'Product Master'})`);
    console.log(`Calculated Proportional Input GST: ₹${calculatedInputGst}`);
    console.log(`Calculated Issued Value Incl. GST: ₹${calculatedIssuedValue}`);

    if (apply) {
      await MaterialConsumption.findByIdAndUpdate(mc._id, {
        $set: {
          gstRate: verifiedGstRate,
          inputGst: calculatedInputGst,
          issuedMaterialValueIncludingGST: calculatedIssuedValue,
          supplierInvoiceTotal: calculatedIssuedValue,
        },
      });
      console.log(`✅ Record ${mc._id} SUCCESSFULLY BACKFILLED.`);
    } else {
      console.log(`ℹ Dry-run only. Run with --apply to commit backfill to MongoDB.`);
    }
  }

  console.log(`\n==================================================`);
  await disconnectDB();
}

const isApply = process.argv.includes('--apply');
backfill(isApply).catch((err) => {
  console.error(err);
  process.exit(1);
});
