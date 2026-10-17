import { connectDB, disconnectDB } from '../src/config/database';
import { Project } from '../src/models/Project';
import { MaterialConsumption } from '../src/models/MaterialConsumption';
import { Product } from '../src/models/Product';
import { Purchase } from '../src/models/Purchase';

async function inspect() {
  await connectDB();
  console.log('=== INSPECTING CURRENT DATABASE PROJECTS & MATERIAL CONSUMPTIONS ===\n');

  const projects = await Project.find().lean();
  console.log(`Total Projects Found: ${projects.length}`);

  for (const proj of projects) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Project: "${proj.name}" (Code: ${proj.projectCode}, ID: ${proj._id})`);
    console.log(`Budget: ${proj.budget}, Status: ${proj.status}`);

    const consumptions = await MaterialConsumption.find({ project: proj._id }).lean();
    console.log(`Material Consumptions count: ${consumptions.length}`);

    for (let i = 0; i < consumptions.length; i++) {
      const mc: any = consumptions[i];
      console.log(`\n  Record #${i + 1}: ID ${mc._id}`);
      console.log(`    productName: ${mc.productName}`);
      console.log(`    sku: ${mc.sku}`);
      console.log(`    quantity: ${mc.quantity}`);
      console.log(`    actualCostPrice: ${mc.actualCostPrice}`);
      console.log(`    actualCostTotal: ${mc.actualCostTotal}`);
      console.log(`    gstRate: ${mc.gstRate !== undefined ? mc.gstRate : 'UNDEFINED / MISSING'}`);
      console.log(`    inputGst: ${mc.inputGst !== undefined ? mc.inputGst : 'UNDEFINED / MISSING'}`);
      console.log(`    issuedMaterialValueIncludingGST: ${mc.issuedMaterialValueIncludingGST !== undefined ? mc.issuedMaterialValueIncludingGST : 'UNDEFINED / MISSING'}`);
      console.log(`    supplierInvoiceTotal: ${mc.supplierInvoiceTotal !== undefined ? mc.supplierInvoiceTotal : 'UNDEFINED / MISSING'}`);

      // Check product
      const product: any = await Product.findById(mc.product).lean();
      if (product) {
        console.log(`    [Related Product ID ${product._id}]: name: "${product.name}", costPrice: ${product.costPrice}, gstRate: ${product.gstRate}`);
      } else {
        console.log(`    [Related Product]: NOT FOUND`);
      }

      // Check purchases for this product
      const purchases: any = await Purchase.find({ 'items.product': mc.product }).lean();
      console.log(`    [Related Purchases Count for this Product]: ${purchases.length}`);
      for (const pur of purchases) {
        const item = pur.items.find((it: any) => it.product.toString() === mc.product.toString());
        console.log(`      Purchase #${pur.purchaseNumber} (${pur.purchaseDate?.toISOString()?.split('T')[0]}): item qty=${item?.quantity}, purchasePrice=${item?.purchasePrice}, taxableAmount=${item?.taxableAmount}, taxRate=${item?.taxRate}, taxAmount=${item?.taxAmount}, totalCost=${item?.totalCost}`);
      }
    }
  }

  // Also check if there are any orphan material consumptions
  const allConsumptions = await MaterialConsumption.find().lean();
  console.log(`\n==================================================`);
  console.log(`Total Material Consumptions in entire DB: ${allConsumptions.length}`);

  await disconnectDB();
}

inspect().catch((err) => {
  console.error(err);
  process.exit(1);
});
