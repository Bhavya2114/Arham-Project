import axiosInstance from './api';
import { getLabourById } from './labourService';
import { buildProjectReportWorkbook, projectReportFileName } from './projectReportWorkbook';

/**
 * One row per assignment on this project. The project's labour list adds up a person's
 * assignments, so the split comes from their profile's project history; if those don't add
 * up to the same total (or can't be loaded) the person stays as one row with the
 * project-list numbers, which are the ones the Labour tab shows.
 */
const toAssignmentRows = async (projectId, labours) => {
  const perPerson = await Promise.all(
    labours.map(async (l) => {
      const isContractor = l.type === 'CONTRACTOR';
      const single = [
        {
          name: l.name,
          type: l.type,
          mobile: l.mobile,
          startDate: l.assignmentStartDate || l.startDate,
          stoppedAt: l.stoppedAt,
          earnedDays: l.earnedDays,
          dailyWage: l.dailyWage,
          areaSqFt: l.areaSqFt,
          ratePerSqFt: l.ratePerSqFt,
          amount: Number(l.totalEarned) || 0,
        },
      ];
      try {
        const full = await getLabourById(l.id);
        const history = (full?.projectHistory || []).filter((h) => !h.isDeleted && h.projectId === projectId);
        if (history.length === 0) return single;
        const sum = history.reduce((s, h) => s + (Number(h.earned) || 0), 0);
        if (Math.abs(sum - (Number(l.totalEarned) || 0)) > 0.01) return single;
        return [...history]
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
          .map((h) => ({
            name: l.name,
            type: l.type,
            mobile: l.mobile,
            startDate: h.startDate,
            stoppedAt: h.stoppedAt,
            earnedDays: h.earnedDays,
            dailyWage: l.dailyWage,
            areaSqFt: isContractor ? h.areaSqFt : null,
            ratePerSqFt: isContractor ? h.ratePerSqFt : null,
            amount: Number(h.earned) || 0,
          }));
      } catch {
        return single;
      }
    })
  );
  return perPerson.flat();
};

/**
 * Downloads an .xlsx report for one project (summary, inventory used, expenses, labour).
 * Uses the same endpoints and figures as the Project Details page.
 */
export const downloadProjectReport = async (projectId) => {
  const [{ default: ExcelJS }, projRes, matRes, expRes, profRes, labRes] = await Promise.all([
    import('exceljs'),
    axiosInstance.get(`/projects/${projectId}`),
    axiosInstance.get(`/projects/${projectId}/material-consumptions`),
    axiosInstance.get(`/projects/${projectId}/expenses`),
    axiosInstance.get(`/projects/${projectId}/profitability`),
    axiosInstance.get(`/projects/${projectId}/labours`),
  ]);

  const project = projRes.data.data;
  const labours = labRes.data?.data || [];
  const labourRows = await toAssignmentRows(projectId, labours);

  const now = new Date();
  const wb = buildProjectReportWorkbook(
    ExcelJS,
    {
      project,
      profitability: profRes.data.data,
      materials: matRes.data.data || [],
      expenses: expRes.data.data || [],
      labours,
      labourRows,
    },
    now
  );

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = projectReportFileName(project, now);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
