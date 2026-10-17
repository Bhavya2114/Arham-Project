import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { Labour } from '../src/models/Labour';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arham';
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const labours = await Labour.find({});
  for (const l of labours) {
    const activeAssignment = Array.isArray(l.projectAssignments)
      ? l.projectAssignments.slice().reverse().find((pa: any) => pa.status === 'ACTIVE')
      : null;

    if (l.status === 'ACTIVE' && activeAssignment) {
      console.log(`Syncing active worker: ${l.name}`);
      console.log(`  Old startDate: ${l.startDate}, Old assignmentStartDate: ${l.assignmentStartDate}`);
      console.log(`  New date from active assignment: ${activeAssignment.startDate}`);
      l.startDate = activeAssignment.startDate;
      l.assignmentStartDate = activeAssignment.startDate;
      await l.save();
    }
  }

  console.log('Sync complete');
  await mongoose.disconnect();
}

main().catch(console.error);
