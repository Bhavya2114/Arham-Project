import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function verify() {
  // Login as admin
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@erp.com',
      password: 'Password@123',
    }),
  });
  const loginData: any = await loginRes.json();
  const token = loginData.token || loginData.data?.token;
  if (!token) {
    console.error('Login failed:', loginData);
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  console.log('Logged in successfully');

  // 1. Get Labour Directory
  const dirRes = await fetch('http://localhost:3000/api/labours', { headers });
  const dirData: any = await dirRes.json();
  const allLabours = dirData.data;
  console.log(`Retrieved ${allLabours.length} labours from /api/labours`);

  const thirdDir = allLabours.find((l: any) => l.name.toLowerCase().includes('third'));
  console.log('\n--- LABOUR DIRECTORY: "third" ---');
  console.log({
    id: thirdDir?.id,
    name: thirdDir?.name,
    project: thirdDir?.project?.name,
    projectId: thirdDir?.projectId,
    startDate: thirdDir?.startDate,
    dailyWage: thirdDir?.dailyWage,
    status: thirdDir?.status,
    earnedDays: thirdDir?.earnedDays,
    totalEarned: thirdDir?.totalEarned,
    totalPaid: thirdDir?.totalPaid,
    balance: thirdDir?.balance,
  });

  // 2. Get Project Workforce Ledger for third's project
  if (thirdDir?.projectId) {
    const projRes = await fetch(`http://localhost:3000/api/projects/${thirdDir.projectId}/labours`, { headers });
    const projData: any = await projRes.json();
    const projLabours = projData.data;
    const thirdProj = projLabours.find((l: any) => l.id === thirdDir.id);

    console.log('\n--- PROJECT WORKFORCE LEDGER: "third" ---');
    console.log({
      id: thirdProj?.id,
      name: thirdProj?.name,
      project: thirdProj?.project?.name,
      projectId: thirdProj?.projectId,
      startDate: thirdProj?.startDate,
      dailyWage: thirdProj?.dailyWage,
      status: thirdProj?.status,
      earnedDays: thirdProj?.earnedDays,
      totalEarned: thirdProj?.totalEarned,
      totalPaid: thirdProj?.totalPaid,
      balance: thirdProj?.balance,
    });

    console.log('\n--- COMPARISON ---');
    console.log('Same Start Date:', thirdDir?.startDate === thirdProj?.startDate);
    console.log('Same Status:', thirdDir?.status === thirdProj?.status);
    console.log('Same Earned Days:', thirdDir?.earnedDays === thirdProj?.earnedDays);
    console.log('Same Total Earned:', thirdDir?.totalEarned === thirdProj?.totalEarned);
    console.log('Same Total Paid:', thirdDir?.totalPaid === thirdProj?.totalPaid);
    console.log('Same Balance:', thirdDir?.balance === thirdProj?.balance);
  }

  // Also print all workers
  console.log('\n--- ALL LABOUR DIRECTORY WORKERS ---');
  for (const l of allLabours) {
    console.log(`Worker: "${l.name}" | Status: ${l.status} | Project: ${l.project?.name || 'Unassigned'} | StartDate: ${l.startDate} | Earned: ₹${l.totalEarned} (${l.earnedDays} days) | Paid: ₹${l.totalPaid} | Balance: ₹${l.balance}`);
  }
}

verify().catch(console.error);
