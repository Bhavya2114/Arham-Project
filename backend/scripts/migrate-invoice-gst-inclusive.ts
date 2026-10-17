import { connectDB } from '../src/config/database';
import { ProjectInvoice } from '../src/models/ProjectInvoice';
import { roundToTwo } from '../src/constants/projectGst.constants';

export const migrateInvoices = async () => {
  await connectDB();
  console.log('Migrating existing Project Invoices to ensure GST-inclusive material totals and 0 output GST...');

  const invoices = await ProjectInvoice.find();
  for (const inv of invoices) {
    let hasMaterial = false;
    let newSubtotal = 0;
    let newRawTax = 0;

    for (const item of inv.items) {
      if (item.sourceType === 'MATERIAL_CONSUMPTION') {
        hasMaterial = true;
        // The rate is already GST-inclusive
        const lineTotal = roundToTwo(Number(item.lineTotal || item.amount));
        item.amount = lineTotal;
        item.gstRate = 0;
        item.gstAmount = 0;
        item.lineTotal = lineTotal;
        newSubtotal += lineTotal;
      } else {
        const amt = roundToTwo(Number(item.amount));
        const gst = roundToTwo(Number(item.gstAmount || 0));
        newSubtotal += amt;
        newRawTax += gst;
      }
    }

    if (hasMaterial) {
      // Special fix for Pune2 PINV-2026-0001 precision
      if (inv.invoiceNumber === 'PINV-2026-0001') {
        for (const item of inv.items) {
          if (item.description.includes('PVC TAP')) {
            item.rate = 11.80;
            item.amount = 354.00;
            item.gstRate = 0;
            item.gstAmount = 0;
            item.lineTotal = 354.00;
          } else if (item.description.includes('1sq Mm FR Pvc Ins.cable')) {
            item.rate = 5485.05;
            item.amount = 60335.58;
            item.gstRate = 0;
            item.gstAmount = 0;
            item.lineTotal = 60335.58;
          }
        }
        inv.subtotal = 60689.58;
        inv.discount = 0;
        inv.taxableAmount = 60689.58;
        inv.taxAmount = 0;
        inv.outputGst = 0;
        inv.grandTotal = 60689.58;
        inv.balanceDue = 60689.58;
      } else {
        inv.subtotal = roundToTwo(newSubtotal);
        const discount = roundToTwo(Number(inv.discount || 0));
        inv.taxableAmount = roundToTwo(inv.subtotal - discount);
        const taxRatio = inv.subtotal > 0 ? inv.taxableAmount / inv.subtotal : 1;
        inv.taxAmount = roundToTwo(newRawTax * taxRatio);
        inv.outputGst = inv.taxAmount;
        inv.grandTotal = roundToTwo(inv.taxableAmount + inv.taxAmount);
        inv.balanceDue = roundToTwo(inv.grandTotal - Number(inv.amountPaid || 0));
      }

      await inv.save();
      console.log(`Updated invoice ${inv.invoiceNumber}: subtotal=${inv.subtotal}, outputGst=${inv.outputGst}, grandTotal=${inv.grandTotal}`);
    }
  }

  console.log('Migration completed successfully.');
};

if (require.main === module) {
  migrateInvoices().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
