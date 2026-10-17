import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { Labour } from '../src/models/Labour';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/arham';
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const labours = await Labour.find({}).lean();
  console.log(`Found ${labours.length} labours total`);

  for (const l of labours) {
    console.log('----------------------------------------');
    console.log(`Name: ${l.name}, Status: ${l.status}, DailyWage: ${l.dailyWage}`);
    console.log(`startDate: ${l.startDate}, assignmentStartDate: ${l.assignmentStartDate}`);
    console.log(`projectId: ${l.projectId}`);
    console.log(`projectAssignments:`, JSON.stringify(l.projectAssignments, null, 2));
  }

  await mongoose.disconnect();
}

main().catch(console.error);
