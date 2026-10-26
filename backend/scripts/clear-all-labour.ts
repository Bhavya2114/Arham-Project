// One-off: delete every Labour record and its LabourPayment records (fake test data).
// Project assignments live inside each Labour document, so deleting the labour also
// removes the labour cost it adds to projects.
//
// Dry run (default):  npx tsx scripts/clear-all-labour.ts
// Delete for real:    npx tsx scripts/clear-all-labour.ts --confirm
//
// With --confirm, a JSON backup of everything deleted is written to scripts/backups/ first.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { Labour } from '../src/models/Labour';
import { LabourPayment } from '../src/models/LabourPayment';
import { Project } from '../src/models/Project';
import { ProjectExpense } from '../src/models/ProjectExpense';

const confirm = process.argv.includes('--confirm');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in backend/.env');
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.host} / ${mongoose.connection.name}`);
  console.log(confirm ? 'MODE: DELETE (--confirm)' : 'MODE: DRY RUN (nothing will be deleted)');

  const labours = await Labour.find({}).lean();
  const labourIds = labours.map((l) => l._id);
  const payments = await LabourPayment.find({}).lean();
  const linkedPayments = payments.filter((p) => labourIds.some((id) => id.equals(p.labourId)));
  const orphanPayments = payments.length - linkedPayments.length;

  const projectIdSet = new Set<string>();
  let assignmentCount = 0;
  for (const l of labours) {
    if (l.projectId) projectIdSet.add(String(l.projectId));
    (l.assignedProjects || []).forEach((p) => projectIdSet.add(String(p)));
    (l.projectAssignments || []).forEach((a) => {
      assignmentCount += 1;
      projectIdSet.add(String(a.projectId));
    });
  }
  const projects = await Project.find({ _id: { $in: [...projectIdSet] } })
    .select('projectCode name status')
    .lean();

  const statusCounts = labours.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});
  const activePayments = payments.filter((p) => !p.isDeleted);
  const paidTotal = activePayments.reduce((s, p) => s + Number(p.amount || 0), 0);

  console.log('\n=== Labour workers ===');
  console.log(`Total: ${labours.length}`, statusCounts);
  labours.forEach((l) =>
    console.log(`  - ${l.name} | ${l.mobile} | ${l.status} | ₹${l.dailyWage}/day | ${(l.projectAssignments || []).length} assignment(s)`)
  );

  console.log('\n=== Labour payments ===');
  console.log(`Total: ${payments.length} (${activePayments.length} live, ${payments.length - activePayments.length} soft-deleted)`);
  console.log(`Linked to these workers: ${linkedPayments.length}, orphaned (worker already gone): ${orphanPayments}`);
  console.log(`Sum of live payments: ₹${paidTotal.toLocaleString('en-IN')}`);

  console.log('\n=== Projects that get labour cost from these workers ===');
  console.log(
    `Assignments: ${assignmentCount}, distinct project ids: ${projectIdSet.size}, ` +
      `still existing (affected): ${projects.length}, total projects in DB: ${await Project.countDocuments({})}`
  );
  projects.forEach((p) => console.log(`  - ${p.projectCode} | ${p.name} | ${p.status}`));

  // Not deleted: LABOUR-category project expenses are separate expense entries, shown for information
  const labourExpenses = await ProjectExpense.countDocuments({ category: 'LABOUR' });
  console.log(`\n(Info only, NOT deleted) Project expenses with category LABOUR: ${labourExpenses}`);
  const labourExpenseDocs = await ProjectExpense.find({ category: 'LABOUR' }).populate('project', 'projectCode name').lean();
  labourExpenseDocs.forEach((e: any) =>
    console.log(`  - ₹${e.amount} | ${e.description || ''} | project ${e.project?.projectCode || '(missing)'}`)
  );

  if (!confirm) {
    console.log('\nDry run finished. Re-run with --confirm to delete.');
    await mongoose.disconnect();
    return;
  }

  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `labour-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ labours, payments }, null, 2));
  console.log(`\nBackup written: ${backupFile}`);

  const payRes = await LabourPayment.deleteMany({});
  const labRes = await Labour.deleteMany({});
  console.log(`Deleted ${labRes.deletedCount} labour workers and ${payRes.deletedCount} labour payments.`);
  console.log(`Remaining: ${await Labour.countDocuments({})} labour, ${await LabourPayment.countDocuments({})} payments`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
