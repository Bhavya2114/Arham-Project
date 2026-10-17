import { connectDB, disconnectDB } from '../src/config/database';
import { MaterialConsumption } from '../src/models/MaterialConsumption';
import { Product } from '../src/models/Product';
import { Purchase } from '../src/models/Purchase';
import { Project } from '../src/models/Project';

void Product;
void Purchase;
void Project;

async function check() {
  await connectDB();

  // Find project Pune2
  const project = await Project.findOne({ name: /Pune2/i }).lean();
  console.log('Project:', project ? { id: project._id, name: project.name, budget: project.budget } : 'NOT FOUND');

  if (!project) {
    await disconnectDB();
    return;
  }

  // Find raw MaterialConsumption documents for this project
  const records = await MaterialConsumption.collection.find({ project: project._id }).toArray();
  console.log(`\nFound ${records.length} raw MaterialConsumption document(s) in MongoDB collection:`);

  for (let i = 0; i < records.length; i++) {
    const doc = records[i];
    console.log(`\n=================== RECORD #${i + 1} ===================`);
    console.log(`_id: ${doc._id}`);
    console.log(`productName: ${doc.productName}`);
    console.log(`sku: ${doc.sku}`);
    console.log(`quantity: ${doc.quantity} ${doc.unit}`);
    console.log(`actualCostPrice: ${doc.actualCostPrice}`);
    console.log(`actualCostTotal: ${doc.actualCostTotal}`);

    console.log(`\n--- Point 1: Does gstRate exist on document? ---`);
    console.log(`gstRate field in doc: ${'gstRate' in doc ? doc.gstRate : 'DOES NOT EXIST (undefined)'}`);

    console.log(`\n--- Point 2: Does inputGst exist on document? ---`);
    console.log(`inputGst field in doc: ${'inputGst' in doc ? doc.inputGst : 'DOES NOT EXIST (undefined)'}`);

    console.log(`\n--- Point 3: Does issuedMaterialValueIncludingGST exist on document? ---`);
    console.log(`issuedMaterialValueIncludingGST field in doc: ${'issuedMaterialValueIncludingGST' in doc ? doc.issuedMaterialValueIncludingGST : 'DOES NOT EXIST (undefined)'}`);
    console.log(`supplierInvoiceTotal field in doc: ${'supplierInvoiceTotal' in doc ? doc.supplierInvoiceTotal : 'DOES NOT EXIST (undefined)'}`);

    console.log(`\n--- Point 4: Does related Product have a valid gstRate? ---`);
    const product = await Product.findById(doc.product).lean();
    if (product) {
      console.log(`Product Name: ${product.name}`);
      console.log(`Product gstRate: ${product.gstRate} (Type: ${typeof product.gstRate})`);
      console.log(`Is valid (> 0)? ${product.gstRate != null && Number(product.gstRate) > 0}`);
    } else {
      console.log(`Product: NOT FOUND for ID ${doc.product}`);
    }

    console.log(`\n--- Point 5: Does original PurchaseItem contain taxAmount/GST data? ---`);
    const purchases = await Purchase.find({ 'items.product': doc.product }).lean();
    console.log(`Found ${purchases.length} matching purchase(s)`);
    for (const pur of purchases) {
      const matchItems = pur.items.filter((it: any) => it.product.toString() === doc.product.toString());
      for (const it of matchItems) {
        console.log(`  Purchase #${pur.purchaseNumber} (Status: ${pur.status}):`);
        console.log(`    Item Name: ${it.name}`);
        console.log(`    Tax Rate: ${it.taxRate}%`);
        console.log(`    Tax Amount: ₹${it.taxAmount}`);
        console.log(`    Taxable Amount: ₹${it.taxableAmount}`);
        console.log(`    Item Total: ₹${it.totalAmount}`);
      }
    }
  }

  await disconnectDB();
}

check().catch(console.error);
