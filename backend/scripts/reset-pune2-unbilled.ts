import { connectDB } from '../src/config/database';
import { MaterialConsumption } from '../src/models/MaterialConsumption';

async function run() {
  await connectDB();
  await MaterialConsumption.updateMany({ project: '6aaa2d5399b08c04a5bb9fd6' }, { $set: { billedQuantity: 0 } });
  console.log('Successfully reset Pune2 billedQuantity to 0.');
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
