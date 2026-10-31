/**
 * One-time renumber of every project to the yearly sequence PRJ-<year>-001, 002, ...
 * (year = the year the project was created, numbered in creation order).
 *
 *   npx tsx src/scripts/renumberProjectCodes.ts           dry run: prints the mapping, changes nothing
 *   npx tsx src/scripts/renumberProjectCodes.ts --apply   writes the new codes
 *
 * Copies of the code kept elsewhere (ProjectInvoice.projectSnapshot.projectCode) are updated too.
 */
import mongoose from 'mongoose';
import { env } from '../config/env';
import { Project } from '../models/Project';
import { ProjectInvoice } from '../models/ProjectInvoice';

const describeUri = (uri: string): string => {
  try {
    const url = new URL(uri);
    const db = url.pathname.replace(/^\//, '') || '(default: test)';
    return `host=${url.host} db=${db}${url.password ? ` user=${decodeURIComponent(url.username)} password=****` : ''}`;
  } catch {
    return uri.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:****@');
  }
};

const run = async (): Promise<void> => {
  const apply = process.argv.includes('--apply');

  console.log(`Database: ${describeUri(env.MONGODB_URI)}`);
  console.log(`Mode: ${apply ? 'APPLY (writes changes)' : 'DRY RUN (no changes)'}\n`);

  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected: host=${mongoose.connection.host} db=${mongoose.connection.name}\n`);

  const projects = await Project.find().select('name projectCode createdAt').lean();
  const createdAtOf = (p: any): Date => (p.createdAt ? new Date(p.createdAt) : (p._id as mongoose.Types.ObjectId).getTimestamp());
  projects.sort((a: any, b: any) => createdAtOf(a).getTime() - createdAtOf(b).getTime() || String(a._id).localeCompare(String(b._id)));

  const nextByYear = new Map<number, number>();
  const plan = projects.map((p: any) => {
    const year = createdAtOf(p).getFullYear();
    const n = (nextByYear.get(year) || 0) + 1;
    nextByYear.set(year, n);
    return {
      id: p._id as mongoose.Types.ObjectId,
      name: p.name as string,
      oldCode: p.projectCode as string,
      newCode: `PRJ-${year}-${String(n).padStart(3, '0')}`,
      createdAt: createdAtOf(p),
    };
  });

  const changes = plan.filter((p) => p.oldCode !== p.newCode);

  console.log(`Projects found: ${plan.length}`);
  for (const p of plan) {
    const invoiceCopies = await ProjectInvoice.countDocuments({ project: p.id, 'projectSnapshot.projectCode': { $ne: p.newCode } });
    console.log(
      `  ${p.name}: ${p.oldCode} -> ${p.newCode}${p.oldCode === p.newCode ? ' (unchanged)' : ''}` +
        `  [created ${p.createdAt.toISOString()}, invoice snapshots to update: ${invoiceCopies}]`
    );
  }

  if (!apply) {
    console.log(`\nDry run: ${changes.length} project code(s) would change. Re-run with --apply to write them.`);
    await mongoose.disconnect();
    return;
  }

  // Phase 1: move every changing project to a temporary code so the unique index never clashes
  for (const p of changes) {
    await Project.collection.updateOne({ _id: p.id }, { $set: { projectCode: `TMP-${p.id.toString().toUpperCase()}` } });
  }
  // Phase 2: final codes
  for (const p of changes) {
    await Project.collection.updateOne({ _id: p.id }, { $set: { projectCode: p.newCode } });
  }

  // Copies of the code stored on invoices
  let invoicesUpdated = 0;
  for (const p of plan) {
    const res = await ProjectInvoice.collection.updateMany(
      { project: p.id, 'projectSnapshot.projectCode': { $ne: p.newCode } },
      { $set: { 'projectSnapshot.projectCode': p.newCode } }
    );
    invoicesUpdated += res.modifiedCount;
  }

  console.log(`\nApplied: ${changes.length} project code(s) changed, ${invoicesUpdated} invoice snapshot(s) updated.`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('Renumber failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
