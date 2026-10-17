import { connectDB, disconnectDB } from '../src/config/database';
import { MaterialConsumption } from '../src/models/MaterialConsumption';
import { PROJECT_GST_RATE, PROJECT_GST_MULTIPLIER, roundToTwo, getFixedBillingRate } from '../src/constants/projectGst.constants';

void MaterialConsumption;

async function migrate() {
  await connectDB();
  console.log('=== ONE-TIME IDEMPOTENT PROJECT GST & BILLING RATE MIGRATION (Fixed 18% Rule) ===\n');

  const records = await MaterialConsumption.find();
  console.log(`Found ${records.length} MaterialConsumption record(s) in database.\n`);

  let updatedCount = 0;

  for (const doc of records) {
    const actPrice = roundToTwo(Number(doc.actualCostPrice || 0));
    const qty = Number(doc.quantity || 0);
    const actTotal = roundToTwo(Number(doc.actualCostTotal || (qty * actPrice)));
    const inputGst = roundToTwo(actTotal * PROJECT_GST_MULTIPLIER);
    const issuedMaterialValueIncludingGST = roundToTwo(actTotal + inputGst);
    const billingPrice = getFixedBillingRate(actPrice);
    const billingTotal = roundToTwo(qty * billingPrice);

    await MaterialConsumption.findByIdAndUpdate(doc._id, {
      $set: {
        gstRate: PROJECT_GST_RATE,
        inputGst: inputGst,
        issuedMaterialValueIncludingGST: issuedMaterialValueIncludingGST,
        supplierInvoiceTotal: issuedMaterialValueIncludingGST,
        billingPrice: billingPrice,
        billingTotal: billingTotal,
      },
    });

    console.log(`Migrated Record ${doc._id} (${doc.productName}):`);
    console.log(`  Actual Cost Excl. GST: ₹${actTotal.toFixed(2)}`);
    console.log(`  GST Rate: ${PROJECT_GST_RATE}%`);
    console.log(`  Input GST @ 18%: ₹${inputGst.toFixed(2)}`);
    console.log(`  Issued Value Incl. GST: ₹${issuedMaterialValueIncludingGST.toFixed(2)}`);
    console.log(`  Fixed Billing Rate: ₹${billingPrice.toFixed(2)}`);
    console.log(`  Billing Total: ₹${billingTotal.toFixed(2)}\n`);
    updatedCount++;
  }

  console.log(`================================================================`);
  console.log(`✅ Migration complete: ${updatedCount} records permanently updated.`);
  console.log(`================================================================\n`);

  await disconnectDB();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
