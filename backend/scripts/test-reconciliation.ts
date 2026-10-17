import { connectDB, disconnectDB } from '../src/config/database';
import { getMaterialConsumptionReconciliationInfo, backfillMaterialConsumptionGst } from '../src/services/materialConsumption.service';

async function testReconciliation() {
  await connectDB();
  const id1 = '6aaa2d7a99b08c04a5bb9fd7';
  const info1 = await getMaterialConsumptionReconciliationInfo(id1);
  console.log('Reconciliation Info for Record #1:', JSON.stringify(info1, null, 2));

  const id2 = '6aab95b008c42a9ca101f006';
  const info2 = await getMaterialConsumptionReconciliationInfo(id2);
  console.log('Reconciliation Info for Record #2:', JSON.stringify(info2, null, 2));

  await disconnectDB();
}

testReconciliation().catch(console.error);
