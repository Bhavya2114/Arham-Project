import { connectDB, disconnectDB } from '../src/config/database';
import { MaterialConsumption } from '../src/models/MaterialConsumption';
import { Project } from '../src/models/Project';
import { getFixedBillingRate } from '../src/constants/projectGst.constants';

async function verify() {
  await connectDB();
  console.log('=== VERIFY PUNE2 PROJECT GST & BILLING VALUES ===\n');

  const project = await Project.findOne({ name: 'Pune2' });
  if (!project) {
    console.log('Pune2 project not found');
    await disconnectDB();
    return;
  }

  console.log(`Project: ${project.name} (Code: ${project.projectCode}, Budget: ₹${project.budget})`);

  const records = await MaterialConsumption.find({ project: project._id });
  console.log(`Found ${records.length} material consumption records:\n`);

  let totalCostExclGst = 0;
  let totalInputGst = 0;
  let totalIssuedValueInclGst = 0;

  for (const r of records) {
    const costPrice = Number(r.actualCostPrice || 0);
    const qty = Number(r.quantity || 0);
    const costTotal = Number(r.actualCostTotal || 0);
    const gst = Number(r.inputGst || 0);
    const valIncl = Number(r.issuedMaterialValueIncludingGST || 0);
    const fixedRate = getFixedBillingRate(costPrice);

    console.log(`Material: ${r.productName} (${r.sku})`);
    console.log(`  Qty: ${qty} ${r.unit}`);
    console.log(`  Unit Cost (Excl. GST): ₹${costPrice.toFixed(2)}`);
    console.log(`  Fixed Billing Rate (Cost + 18% GST): ₹${fixedRate.toFixed(2)} per ${r.unit}`);
    console.log(`  Cost Total (Excl. GST): ₹${costTotal.toFixed(2)}`);
    console.log(`  GST @ 18%: ₹${gst.toFixed(2)}`);
    console.log(`  Value Incl. GST: ₹${valIncl.toFixed(2)}\n`);

    totalCostExclGst += costTotal;
    totalInputGst += gst;
    totalIssuedValueInclGst += valIncl;
  }

  console.log('--------------------------------------------------');
  console.log(`TOTAL Material Cost (Excl. GST): ₹${totalCostExclGst.toFixed(2)}`);
  console.log(`TOTAL GST @ 18%: ₹${totalInputGst.toFixed(2)}`);
  console.log(`TOTAL Issued Value (Incl. GST): ₹${totalIssuedValueInclGst.toFixed(2)}`);
  console.log(`Project Budget (Excl. GST): ₹${Number(project.budget).toFixed(2)}`);
  console.log(`Remaining Budget: ₹${(Number(project.budget) - totalCostExclGst).toFixed(2)}`);
  console.log(`Total Input GST to be Claimed: ₹${totalInputGst.toFixed(2)}`);
  console.log('--------------------------------------------------\n');

  await disconnectDB();
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
