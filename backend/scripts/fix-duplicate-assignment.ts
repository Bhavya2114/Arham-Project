/**
 * One-off fix: MUSHTAK KHAN was assigned to PANVEL (PRJ-2026-573) twice from 29 Aug 2026,
 * so his days were counted twice. He worked PANVEL once, 29 Aug to 08 Sep 2026.
 *
 *   npx tsx scripts/fix-duplicate-assignment.ts          -> shows what it would change (no writes)
 *   npx tsx scripts/fix-duplicate-assignment.ts --apply  -> makes the change
 *
 * It also lists any other worker whose project stints overlap, without changing them.
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/database';
import { Labour } from '../src/models/Labour';
import { Project } from '../src/models/Project';

const LABOUR_ID = '6ae56c004fa2d6424ec63c02';
const PROJECT_CODE = 'PRJ-2026-573';
const STOP_DATE = new Date('2026-09-08T12:00:00+05:30');
const APPLY = process.argv.includes('--apply');

const day = (d: any) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '-';
const isoDay = (d: any) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const created = (pa: any) => new Date(pa._id.getTimestamp()).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });
const show = (pa: any) =>
  `  [${pa._id}] ${pa.status.padEnd(7)} ${day(pa.startDate)} -> ${pa.stoppedAt ? day(pa.stoppedAt) : 'still working'}   (row created ${created(pa)})`;

async function run() {
  await connectDB();

  const project = await Project.findOne({ projectCode: PROJECT_CODE }).select('_id name');
  const labour = await Labour.findById(LABOUR_ID);
  if (!project || !labour) throw new Error('Worker or project not found');

  const projectId = project._id.toString();
  const rows = (labour.projectAssignments || []).filter((pa: any) => pa.projectId?.toString() === projectId);

  console.log(`${labour.name}: status ${labour.status}, stoppedAt ${day(labour.stoppedAt)}`);
  console.log(`${project.name} rows now:`);
  rows.forEach((pa: any) => console.log(show(pa)));

  if (rows.length === 0) throw new Error('No PANVEL rows found');

  // Keep the first row created, drop the duplicate(s)
  const keep: any = rows.slice().sort((a: any, b: any) => a._id.getTimestamp() - b._id.getTimestamp())[0];
  const drop = rows.filter((pa: any) => pa !== keep);

  console.log('\nPlan:');
  console.log(`  keep ${keep._id}: ${day(keep.startDate)} -> ${day(STOP_DATE)}, STOPPED`);
  drop.forEach((pa: any) => console.log(`  remove ${pa._id}`));
  console.log(`  worker -> INACTIVE, not on any project, stopped ${day(STOP_DATE)}`);

  // Report any other overlapping stints across all workers
  const all = await Labour.find({ 'projectAssignments.1': { $exists: true } }).select('name projectAssignments');
  const others: string[] = [];
  for (const l of all) {
    if (l._id.toString() === LABOUR_ID) continue;
    const pas = (l.projectAssignments || []).slice().sort((a: any, b: any) => +new Date(a.startDate) - +new Date(b.startDate));
    for (let i = 1; i < pas.length; i++) {
      const prevEnd = isoDay(pas[i - 1].stoppedAt || new Date());
      if (isoDay(pas[i].startDate) < prevEnd) others.push(l.name);
    }
  }
  console.log(`\nOther workers with overlapping stints: ${others.length ? [...new Set(others)].join(', ') : 'none'}`);

  if (!APPLY) {
    console.log('\nDry run only. Nothing changed. Run again with --apply to make the change.');
    return;
  }

  keep.status = 'STOPPED';
  keep.stoppedAt = STOP_DATE;
  labour.projectAssignments = (labour.projectAssignments || []).filter((pa: any) => !drop.includes(pa)) as any;
  labour.status = 'INACTIVE';
  labour.stoppedAt = STOP_DATE;
  labour.projectId = null;
  await labour.save();
  console.log('\nDone. PANVEL is now one stint, 29 Aug - 08 Sep 2026.');
}

run()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
