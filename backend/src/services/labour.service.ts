import mongoose from 'mongoose';
import { Labour } from '../models/Labour';
import { LabourPayment } from '../models/LabourPayment';
import { Project } from '../models/Project';
import { CreateLabourInput, UpdateLabourInput } from '../validators/labour.validator';
import {
  getTotalPaidByLabourId,
  getTotalPaidMapForLabours,
} from './labourPayment.service';

export interface LabourEarnedCalculation {
  earnedDays: number;
  totalEarned: number;
}

/**
 * Extracts calendar date { year, month, day } from string or Date object.
 * Interprets dates consistently in Indian Standard Time (Asia/Kolkata)
 * to avoid UTC timezone day-shift artifacts.
 */
export function parseCalendarDate(
  val: any
): { year: number; month: number; day: number } | null {
  if (!val) return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      return {
        year: parseInt(dateMatch[1], 10),
        month: parseInt(dateMatch[2], 10),
        day: parseInt(dateMatch[3], 10),
      };
    }
  }

  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const year = parts.find((p) => p.type === 'year')?.value || '';
    return {
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      day: parseInt(day, 10),
    };
  } catch {
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day (IST) as a whole day number, so dates can be compared and counted. */
function toDayNumber(val: any): number | null {
  const parts = parseCalendarDate(val);
  if (!parts) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS;
}

function dayNumberToIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '08 Sep 2026' (built by hand: newer ICU writes 'Sept' for en-GB)
function formatDayLabel(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The dates a stop date may take for one project assignment:
 * from the day the worker started on it, up to today or the project end date
 * (whichever comes first), and before the worker's next project started.
 */
export function getStopDateRange(
  startDate: any,
  projectEndDate: any,
  otherStartDates: any[] = [],
  referenceDate: Date | string = new Date()
): { min: string | null; max: string } {
  const startDay = toDayNumber(startDate);
  let maxDay = toDayNumber(referenceDate) as number;

  const endDay = toDayNumber(projectEndDate);
  if (endDay !== null && endDay < maxDay) maxDay = endDay;

  if (startDay !== null) {
    for (const other of otherStartDates) {
      const otherDay = toDayNumber(other);
      if (otherDay !== null && otherDay > startDay && otherDay - 1 < maxDay) {
        maxDay = otherDay - 1;
      }
    }
    if (maxDay < startDay) maxDay = startDay;
  }

  return {
    min: startDay !== null ? dayNumberToIso(startDay) : null,
    max: dayNumberToIso(maxDay),
  };
}

/**
 * The last calendar day (day number) the worker has already been paid for on any
 * finished project, so a new or edited start date can't go back over it.
 * (Starting on that same day is allowed, for a worker moved between sites mid-day.)
 */
function getLastWorkedDay(labour: any, skip?: any): number | null {
  let last: number | null = null;
  const consider = (val: any) => {
    const day = toDayNumber(val);
    if (day !== null && (last === null || day > last)) last = day;
  };
  for (const pa of labour.projectAssignments || []) {
    if (pa === skip || pa.status === 'ACTIVE') continue;
    consider(pa.stoppedAt);
  }
  if (!(labour.projectAssignments || []).length) consider(labour.stoppedAt);
  return last;
}

function overlapError(lastDay: number): Error {
  const error = new Error(
    `This worker already worked till ${formatDayLabel(lastDay)}. Pick a start date on or after that day.`
  );
  (error as any).statusCode = 400;
  return error;
}

/**
 * Checks a chosen stop date ('YYYY-MM-DD') against the allowed range and
 * returns the Date to store (midday IST, so it never shifts a day).
 */
function resolveStopDate(input: any, range: { min: string | null; max: string }): Date {
  const badDate = (message: string) => {
    const error = new Error(message);
    (error as any).statusCode = 400;
    return error;
  };

  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    throw badDate('Please choose a valid stop date');
  }
  const iso = input.trim();
  const day = toDayNumber(iso);
  if (day === null || dayNumberToIso(day) !== iso) {
    throw badDate('Please choose a valid stop date');
  }

  const minDay = range.min ? toDayNumber(range.min) : null;
  const maxDay = toDayNumber(range.max) as number;
  if ((minDay !== null && day < minDay) || day > maxDay) {
    throw badDate(
      minDay !== null
        ? `Stop date must be between ${formatDayLabel(minDay)} and ${formatDayLabel(maxDay)}`
        : `Stop date can't be after ${formatDayLabel(maxDay)}`
    );
  }

  return new Date(`${iso}T12:00:00+05:30`);
}

/**
 * Calculates earned days and total earned wages for a labour worker.
 *
 * Rules (Phase 6):
 * - ACTIVE: calendar days from startDate through TODAY inclusive
 * - STOPPED: calendar days from startDate through stoppedAt inclusive
 * - Both start and stop/current days are counted (inclusive)
 * - Every calendar day counts (no weekend/holiday exclusions)
 * - Inconsistent/future date ranges result in 0 earned days (no negative values)
 * - totalEarned = earnedDays * dailyWage
 */
export function calculateLabourEarned(
  labour: {
    startDate?: Date | string | null;
    assignmentStartDate?: Date | string | null;
    dailyWage: number | string;
    status: 'ACTIVE' | 'STOPPED' | 'INACTIVE' | string;
    stoppedAt?: Date | string | null;
    expectedEndDate?: Date | string | null;
  },
  referenceDate: Date | string = new Date(),
  _isProjectContext: boolean = false,
  cappingEndDate?: Date | string | null
): LabourEarnedCalculation {
  const effectiveStartDate = labour.assignmentStartDate || labour.startDate;

  if (labour.status === 'INACTIVE' && !effectiveStartDate) {
    return { earnedDays: 0, totalEarned: 0 };
  }

  const startParts = parseCalendarDate(effectiveStartDate);
  if (!startParts) {
    return { earnedDays: 0, totalEarned: 0 };
  }

  const endInput =
    (labour.status === 'STOPPED' || labour.status === 'INACTIVE') && labour.stoppedAt
      ? labour.stoppedAt
      : referenceDate;
  const endParts = parseCalendarDate(endInput);
  if (!endParts) {
    return { earnedDays: 0, totalEarned: 0 };
  }

  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  let endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);

  // Apply effective capping end date (project's expected completion date) if present
  const effectiveCap = cappingEndDate !== undefined ? cappingEndDate : labour.expectedEndDate;
  if (effectiveCap) {
    const capParts = parseCalendarDate(effectiveCap);
    if (capParts) {
      const capUtc = Date.UTC(capParts.year, capParts.month - 1, capParts.day);
      if (capUtc < endUtc) {
        endUtc = capUtc;
      }
    }
  }

  const diffMs = endUtc - startUtc;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const earnedDays = diffDays >= 0 ? diffDays + 1 : 0;
  const wage = Number(labour.dailyWage) || 0;
  const totalEarned = Math.round(earnedDays * wage * 100) / 100;

  return { earnedDays, totalEarned };
}

/**
 * Determines whether a project assignment is currently active on a given reference date.
 * An assignment is NOT active if:
 * 1. pa.status !== 'ACTIVE'
 * 2. It has an explicit stoppedAt date
 * 3. The project's expectedEndDate is in the past relative to referenceDate
 *    (i.e. referenceDate calendar date > expectedEndDate calendar date).
 * On the expectedEndDate itself, the assignment remains active (inclusive completion-day rule).
 */
export function isAssignmentActive(
  pa: {
    status?: string;
    stoppedAt?: Date | string | null;
    projectId?: any;
  },
  referenceDate: Date | string = new Date(),
  overrideExpectedEndDate?: Date | string | null,
  fallbackLabour?: any
): boolean {
  if (pa.status !== 'ACTIVE') return false;
  if (pa.stoppedAt) return false;

  let expectedEnd = overrideExpectedEndDate !== undefined ? overrideExpectedEndDate : null;
  if (!expectedEnd) {
    if (pa.projectId && typeof pa.projectId === 'object' && pa.projectId.expectedEndDate) {
      expectedEnd = pa.projectId.expectedEndDate;
    } else if (
      fallbackLabour?.projectId &&
      typeof fallbackLabour.projectId === 'object' &&
      fallbackLabour.projectId.expectedEndDate
    ) {
      const paId = pa.projectId?._id ? pa.projectId._id.toString() : pa.projectId?.toString();
      const labourPId = fallbackLabour.projectId._id
        ? fallbackLabour.projectId._id.toString()
        : fallbackLabour.projectId.toString();
      if (!paId || paId === labourPId) {
        expectedEnd = fallbackLabour.projectId.expectedEndDate;
      }
    }
  }

  if (expectedEnd) {
    const endParts = parseCalendarDate(expectedEnd);
    const refParts = parseCalendarDate(referenceDate);
    if (endParts && refParts) {
      const endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
      const refUtc = Date.UTC(refParts.year, refParts.month - 1, refParts.day);
      if (refUtc > endUtc) {
        return false;
      }
    }
  }

  return true;
}

export const mapLabourResponse = (
  labour: any,
  totalPaid: number = 0,
  context?: { projectId?: string; referenceDate?: Date | string; expectedEndDate?: Date | string }
) => {
  const isProjectContext = Boolean(context?.projectId);
  const refDate = context?.referenceDate || new Date();

  // Find the current active project assignment (if any)
  const activeAssignment = Array.isArray(labour.projectAssignments)
    ? labour.projectAssignments
        .slice()
        .reverse()
        .find((pa: any) => isAssignmentActive(pa, refDate, undefined, labour))
    : null;

  let effectiveStatus: 'ACTIVE' | 'STOPPED' | 'INACTIVE' = 'INACTIVE';
  let effectiveStartDate: Date | null = null;
  let effectiveAssignmentStartDate: Date | null = null;
  let effectiveStoppedAt: Date | null = null;
  let resolvedProject: any = undefined;
  let resolvedProjectId: string | undefined = undefined;
  let earnedDays: number = 0;
  let totalEarned: number = 0;
  // One row per project the worker has been on, for the profile's project history
  const projectHistory: any[] = [];

  if (isProjectContext) {
    const matchingAssignments = Array.isArray(labour.projectAssignments)
      ? labour.projectAssignments.filter((pa: any) => {
          const pId = pa.projectId?._id ? pa.projectId._id.toString() : pa.projectId?.toString();
          return pId === context!.projectId;
        })
      : [];

    if (matchingAssignments.length > 0) {
      const latestPA = matchingAssignments[matchingAssignments.length - 1];
      const hasActivePA = matchingAssignments.some((pa: any) =>
        isAssignmentActive(pa, refDate, context?.expectedEndDate, labour)
      );

      const latestPAProj = latestPA.projectId;
      const latestPACap =
        latestPAProj && typeof latestPAProj === 'object' && latestPAProj.expectedEndDate
          ? latestPAProj.expectedEndDate
          : (context?.expectedEndDate || null);

      effectiveStatus = hasActivePA ? 'ACTIVE' : 'STOPPED';
      effectiveStartDate = latestPA.startDate || labour.assignmentStartDate || labour.startDate || null;
      effectiveAssignmentStartDate = latestPA.startDate || labour.assignmentStartDate || null;
      effectiveStoppedAt = hasActivePA
        ? null
        : (latestPA.stoppedAt || labour.stoppedAt || latestPACap || null);

      if (latestPA.projectId && typeof latestPA.projectId === 'object' && latestPA.projectId?._id) {
        resolvedProject = {
          id: latestPA.projectId._id.toString(),
          name: latestPA.projectId.name,
          projectCode: latestPA.projectId.projectCode,
          siteAddress: latestPA.projectId.siteAddress,
          status: latestPA.projectId.status,
          expectedEndDate: latestPA.projectId.expectedEndDate,
        };
        resolvedProjectId = latestPA.projectId._id.toString();
      } else {
        resolvedProjectId = context!.projectId;
        if (labour.projectId && typeof labour.projectId === 'object' && labour.projectId._id?.toString() === context!.projectId) {
          resolvedProject = {
            id: labour.projectId._id.toString(),
            name: labour.projectId.name,
            projectCode: labour.projectId.projectCode,
            siteAddress: labour.projectId.siteAddress,
            status: labour.projectId.status,
            expectedEndDate: labour.projectId.expectedEndDate,
          };
        }
      }

      let totalProjDays = 0;
      let totalProjEarned = 0;

      for (const pa of matchingAssignments) {
        if (pa.startDate) {
          const isPAActive = isAssignmentActive(pa, refDate, context?.expectedEndDate, labour);
          const paProj = pa.projectId;
          const paCap =
            (paProj && typeof paProj === 'object' && paProj.expectedEndDate)
              ? paProj.expectedEndDate
              : (context?.expectedEndDate || null);
          const stop = isPAActive ? refDate : (pa.stoppedAt || labour.stoppedAt || paCap || refDate);

          const paCalc = calculateLabourEarned(
            {
              dailyWage: labour.dailyWage,
              startDate: pa.startDate,
              assignmentStartDate: pa.startDate,
              status: isPAActive ? 'ACTIVE' : 'STOPPED',
              stoppedAt: isPAActive ? null : stop,
            },
            refDate,
            true,
            paCap
          );
          totalProjDays += paCalc.earnedDays;
          totalProjEarned += paCalc.totalEarned;
        }
      }

      earnedDays = totalProjDays;
      totalEarned = Math.round(totalProjEarned * 100) / 100;
    } else {
      const isCurrentProject = labour.projectId && (
        (labour.projectId._id && labour.projectId._id.toString() === context!.projectId) ||
        labour.projectId.toString() === context!.projectId
      );

      let projectCap: any = null;
      if (labour.projectId && typeof labour.projectId === 'object' && labour.projectId._id) {
        resolvedProject = {
          id: labour.projectId._id.toString(),
          name: labour.projectId.name,
          projectCode: labour.projectId.projectCode,
          siteAddress: labour.projectId.siteAddress,
          status: labour.projectId.status,
          expectedEndDate: labour.projectId.expectedEndDate,
        };
        projectCap = labour.projectId.expectedEndDate;
      }

      const effectiveCap = projectCap || context?.expectedEndDate || null;
      const isDirectActive = isCurrentProject && isAssignmentActive(
        { status: labour.status, stoppedAt: labour.stoppedAt },
        refDate,
        effectiveCap
      );

      if (isDirectActive) {
        effectiveStatus = 'ACTIVE';
        effectiveStoppedAt = null;
      } else {
        effectiveStatus = 'STOPPED';
        effectiveStoppedAt = labour.stoppedAt || effectiveCap || null;
      }
      effectiveStartDate = labour.assignmentStartDate || labour.startDate || null;
      effectiveAssignmentStartDate = labour.assignmentStartDate || null;

      resolvedProjectId = context?.projectId || (labour.projectId?._id ? labour.projectId._id.toString() : labour.projectId?.toString());

      const calc = calculateLabourEarned(
        {
          ...labour,
          startDate: effectiveStartDate,
          assignmentStartDate: effectiveAssignmentStartDate,
          status: effectiveStatus,
          stoppedAt: effectiveStoppedAt,
        },
        refDate,
        true,
        effectiveCap
      );
      earnedDays = calc.earnedDays;
      totalEarned = calc.totalEarned;
    }
  } else {
    // Master Directory Context (/labour and /labour/:id):
    const hasAssignments = Array.isArray(labour.projectAssignments) && labour.projectAssignments.length > 0;
    let legacyCap: any = null;
    if (labour.projectId && typeof labour.projectId === 'object' && labour.projectId.expectedEndDate) {
      legacyCap = labour.projectId.expectedEndDate;
    }
    const isLegacyActive = isAssignmentActive(
      { status: labour.status, stoppedAt: labour.stoppedAt },
      refDate,
      legacyCap
    );
    const isWorkerActive = hasAssignments ? Boolean(activeAssignment) : isLegacyActive;

    if (isWorkerActive) {
      effectiveStatus = 'ACTIVE';
      effectiveStoppedAt = null;

      if (activeAssignment) {
        effectiveStartDate = activeAssignment.startDate || labour.assignmentStartDate || labour.startDate || null;
        effectiveAssignmentStartDate = activeAssignment.startDate || labour.assignmentStartDate || null;

        if (activeAssignment.projectId && typeof activeAssignment.projectId === 'object' && activeAssignment.projectId?._id) {
          resolvedProjectId = activeAssignment.projectId._id.toString();
          resolvedProject = {
            id: activeAssignment.projectId._id.toString(),
            name: activeAssignment.projectId.name,
            projectCode: activeAssignment.projectId.projectCode,
            siteAddress: activeAssignment.projectId.siteAddress,
            status: activeAssignment.projectId.status,
            expectedEndDate: activeAssignment.projectId.expectedEndDate,
          };
        } else if (activeAssignment.projectId) {
          resolvedProjectId = activeAssignment.projectId.toString();
          if (labour.projectId && typeof labour.projectId === 'object' && labour.projectId._id?.toString() === resolvedProjectId) {
            resolvedProject = {
              id: labour.projectId._id.toString(),
              name: labour.projectId.name,
              projectCode: labour.projectId.projectCode,
              siteAddress: labour.projectId.siteAddress,
              status: labour.projectId.status,
              expectedEndDate: labour.projectId.expectedEndDate,
            };
          }
        }
      } else {
        effectiveStartDate = labour.assignmentStartDate || labour.startDate || null;
        effectiveAssignmentStartDate = labour.assignmentStartDate || null;
      }

      if (!resolvedProjectId && labour.projectId) {
        resolvedProjectId = labour.projectId._id ? labour.projectId._id.toString() : labour.projectId.toString();
      }
      if (!resolvedProject && labour.projectId && typeof labour.projectId === 'object' && labour.projectId._id) {
        resolvedProject = {
          id: labour.projectId._id.toString(),
          name: labour.projectId.name,
          projectCode: labour.projectId.projectCode,
          siteAddress: labour.projectId.siteAddress,
          status: labour.projectId.status,
          expectedEndDate: labour.projectId.expectedEndDate,
        };
      }
    } else {
      // INACTIVE worker in Master Directory:
      const latestPA = hasAssignments
        ? labour.projectAssignments[labour.projectAssignments.length - 1]
        : null;
      const latestPAProj = latestPA?.projectId;
      const latestPACap =
        latestPAProj && typeof latestPAProj === 'object' && latestPAProj.expectedEndDate
          ? latestPAProj.expectedEndDate
          : legacyCap;

      effectiveStatus = 'INACTIVE';
      effectiveStartDate = null;
      effectiveAssignmentStartDate = null;
      effectiveStoppedAt =
        labour.stoppedAt ||
        (latestPA?.stoppedAt || latestPACap || null);
      resolvedProjectId = undefined;
      resolvedProject = undefined;
    }

    // Cumulative earnings across all valid projectAssignments (ACTIVE and STOPPED)
    if (Array.isArray(labour.projectAssignments) && labour.projectAssignments.length > 0) {
      let cumulativeDays = 0;
      let cumulativeEarned = 0;

      for (const pa of labour.projectAssignments) {
        if (pa.startDate) {
          const isPAActive = isAssignmentActive(pa, refDate, undefined, labour);
          const paProj = pa.projectId;
          const paCap =
            paProj && typeof paProj === 'object' && paProj.expectedEndDate
              ? paProj.expectedEndDate
              : null;
          const stop = isPAActive ? refDate : (pa.stoppedAt || labour.stoppedAt || paCap || refDate);

          const paCalc = calculateLabourEarned(
            {
              dailyWage: labour.dailyWage,
              startDate: pa.startDate,
              assignmentStartDate: pa.startDate,
              status: isPAActive ? 'ACTIVE' : 'STOPPED',
              stoppedAt: isPAActive ? null : stop,
            },
            refDate,
            false,
            paCap
          );
          cumulativeDays += paCalc.earnedDays;
          cumulativeEarned += paCalc.totalEarned;

          projectHistory.push({
            assignmentId: pa._id ? pa._id.toString() : undefined,
            projectId: paProj?._id ? paProj._id.toString() : paProj?.toString(),
            name: paProj && typeof paProj === 'object' ? paProj.name : undefined,
            projectCode: paProj && typeof paProj === 'object' ? paProj.projectCode : undefined,
            projectStatus: paProj && typeof paProj === 'object' ? paProj.status : undefined,
            startDate: pa.startDate,
            stoppedAt: isPAActive ? null : stop,
            isActive: isPAActive,
            earnedDays: paCalc.earnedDays,
            earned: Math.round(paCalc.totalEarned * 100) / 100,
            stopDateRange: getStopDateRange(
              pa.startDate,
              paCap,
              labour.projectAssignments.filter((o: any) => o !== pa).map((o: any) => o.startDate),
              refDate
            ),
          });
        }
      }

      earnedDays = cumulativeDays;
      totalEarned = Math.round(cumulativeEarned * 100) / 100;
    } else if (isWorkerActive) {
      // Legacy active worker without projectAssignments array
      const activeCap = resolvedProject?.expectedEndDate || null;
      const calc = calculateLabourEarned(
        {
          ...labour,
          startDate: effectiveStartDate,
          assignmentStartDate: effectiveAssignmentStartDate,
          status: 'ACTIVE',
          stoppedAt: null,
        },
        refDate,
        false,
        activeCap
      );
      earnedDays = calc.earnedDays;
      totalEarned = calc.totalEarned;

      if (resolvedProjectId) {
        projectHistory.push({
          projectId: resolvedProjectId,
          name: resolvedProject?.name,
          projectCode: resolvedProject?.projectCode,
          projectStatus: resolvedProject?.status,
          startDate: effectiveAssignmentStartDate || effectiveStartDate,
          stoppedAt: null,
          isActive: true,
          earnedDays: calc.earnedDays,
          earned: Math.round(calc.totalEarned * 100) / 100,
        });
      }
    } else if (labour.startDate && (labour.stoppedAt || legacyCap)) {
      // Legacy inactive worker with root startDate & stoppedAt or legacyCap
      const histCap = legacyCap;
      const stop = labour.stoppedAt || histCap || refDate;
      const histCalc = calculateLabourEarned(
        {
          dailyWage: labour.dailyWage,
          startDate: labour.assignmentStartDate || labour.startDate,
          assignmentStartDate: labour.assignmentStartDate || labour.startDate,
          status: 'STOPPED',
          stoppedAt: stop,
        },
        refDate,
        false,
        histCap
      );
      earnedDays = histCalc.earnedDays;
      totalEarned = histCalc.totalEarned;
    } else {
      earnedDays = 0;
      totalEarned = 0;
    }
  }

  const roundedPaid = Math.round(Number(totalPaid || 0) * 100) / 100;
  const balance = Math.round((totalEarned - roundedPaid) * 100) / 100;

  return {
    id: labour._id ? labour._id.toString() : labour.id,
    name: labour.name,
    mobile: labour.mobile,
    location: labour.location,
    address: labour.location,
    projectId: resolvedProjectId,
    project: resolvedProject,
    dailyWage: Number(labour.dailyWage),
    startDate: effectiveStartDate,
    assignmentStartDate: effectiveAssignmentStartDate,
    status: effectiveStatus,
    projectAssignmentStatus: isProjectContext ? effectiveStatus : undefined,
    stoppedAt: effectiveStoppedAt,
    earnedDays,
    totalEarned,
    totalPaid: roundedPaid,
    balance,
    // Newest project first
    projectHistory: projectHistory.sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    ),
    createdAt: labour.createdAt,
    updatedAt: labour.updatedAt,
  };
};

export const getLabours = async (
  query: {
    search?: string;
    status?: string;
    projectId?: string;
    location?: string;
  },
  context?: { referenceDate?: Date | string; expectedEndDate?: Date | string }
): Promise<any[]> => {
  const andClauses: any[] = [];

  // Status Filter: ACTIVE, INACTIVE or exact status value
  if (query.status && query.status.trim() !== '') {
    const normalizedStatus = query.status.trim().toUpperCase();
    if (normalizedStatus !== 'ALL') {
      if (normalizedStatus === 'ACTIVE') {
        andClauses.push({
          status: 'ACTIVE',
          projectId: { $ne: null },
        });
      } else if (normalizedStatus === 'INACTIVE') {
        andClauses.push({
          $or: [
            { status: 'INACTIVE' },
            { status: 'STOPPED' },
            { projectId: null },
          ],
        });
      } else {
        andClauses.push({ status: normalizedStatus });
      }
    }
  }

  // Project Filter: specific project ObjectId or safe empty match for invalid IDs
  if (query.projectId && query.projectId.trim() !== '') {
    const trimmedProject = query.projectId.trim();
    if (trimmedProject.toUpperCase() !== 'ALL') {
      if (mongoose.Types.ObjectId.isValid(trimmedProject)) {
        const pObjId = new mongoose.Types.ObjectId(trimmedProject);
        andClauses.push({
          $or: [
            { projectId: pObjId },
            { assignedProjects: pObjId },
            { 'projectAssignments.projectId': pObjId },
          ],
        });
      } else {
        // Invalid ObjectId cannot match any valid project reference
        andClauses.push({ projectId: new mongoose.Types.ObjectId('000000000000000000000000') });
      }
    }
  }

  // Location Filter: case-insensitive exact or trimmed match
  if (query.location && query.location.trim() !== '') {
    const trimmedLoc = query.location.trim();
    if (trimmedLoc.toUpperCase() !== 'ALL') {
      const safeLocRegex = new RegExp(`^${trimmedLoc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      andClauses.push({ location: safeLocRegex });
    }
  }

  // Search Filter: case-insensitive partial match across name, mobile, location
  if (query.search && query.search.trim() !== '') {
    const trimmedSearch = query.search.trim();
    const safeRegex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    andClauses.push({
      $or: [
        { name: safeRegex },
        { mobile: safeRegex },
        { location: safeRegex },
      ],
    });
  }

  const filter = andClauses.length > 0 ? { $and: andClauses } : {};

  const labours = await Labour.find(filter)
    .populate('projectId', 'name projectCode siteAddress status expectedEndDate')
    .populate('projectAssignments.projectId', 'name projectCode siteAddress status expectedEndDate')
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const labourIds = labours.map((l) => l._id);
  const totalPaidMap = await getTotalPaidMapForLabours(labourIds);

  const mapped = labours.map((l) =>
    mapLabourResponse(l, totalPaidMap.get(l._id.toString()) || 0, {
      projectId: query.projectId,
      referenceDate: context?.referenceDate,
      expectedEndDate: context?.expectedEndDate,
    })
  );

  if (query.status && query.status.trim() !== '') {
    const normalized = query.status.trim().toUpperCase();
    if (normalized !== 'ALL') {
      return mapped.filter((l) => l.status === normalized);
    }
  }

  return mapped;
};

export const getLabourById = async (
  id: string,
  context?: { projectId?: string; referenceDate?: Date | string; expectedEndDate?: Date | string }
): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid labour ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const labour = await Labour.findById(id)
    .populate('projectId', 'name projectCode siteAddress status expectedEndDate')
    .populate('projectAssignments.projectId', 'name projectCode siteAddress status expectedEndDate')
    .lean();

  if (!labour) return null;
  const totalPaid = await getTotalPaidByLabourId(id);
  return mapLabourResponse(labour, totalPaid, context);
};

export const createLabour = async (input: CreateLabourInput): Promise<any> => {
  let projectObj = null;

  // 1. Validate Project Reference if provided
  if (input.projectId && typeof input.projectId === 'string' && input.projectId.trim() !== '') {
    if (!mongoose.Types.ObjectId.isValid(input.projectId)) {
      const error = new Error('Invalid project ID format');
      (error as any).statusCode = 400;
      throw error;
    }

    projectObj = await Project.findById(input.projectId);
    if (!projectObj) {
      const error = new Error('Project not found');
      (error as any).statusCode = 404;
      throw error;
    }

    if (['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(projectObj.status)) {
      const error = new Error('Labour can only be assigned to an active project');
      (error as any).statusCode = 400;
      throw error;
    }
  }

  const locationVal = (input.address || input.location || '').trim();

  // If assigned to an active project at creation, set status to ACTIVE and startDate.
  // If unassigned (master record), status is INACTIVE, projectId is null, and startDate is null.
  let startDateVal: Date | null = null;
  if (projectObj) {
    if (input.startDate !== undefined && input.startDate !== null && String(input.startDate).trim() !== '') {
      const startParts = parseCalendarDate(input.startDate);
      if (!startParts) {
        const error = new Error('Invalid start date format');
        (error as any).statusCode = 400;
        throw error;
      }

      const todayParts = parseCalendarDate(new Date())!;
      const inputUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
      const todayUtc = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day);

      if (inputUtc > todayUtc) {
        const error = new Error('Start date cannot be in the future');
        (error as any).statusCode = 400;
        throw error;
      }

      if (projectObj.expectedEndDate) {
        const projectEndParts = parseCalendarDate(projectObj.expectedEndDate);
        if (projectEndParts) {
          const projectEndUtc = Date.UTC(
            projectEndParts.year,
            projectEndParts.month - 1,
            projectEndParts.day
          );
          if (inputUtc > projectEndUtc) {
            const error = new Error("Start date cannot be after project's expected completion date");
            (error as any).statusCode = 400;
            throw error;
          }
        }
      }

      if (projectObj.startDate) {
        const projectStartParts = parseCalendarDate(projectObj.startDate);
        if (projectStartParts) {
          const projectStartUtc = Date.UTC(
            projectStartParts.year,
            projectStartParts.month - 1,
            projectStartParts.day
          );
          if (inputUtc < projectStartUtc) {
            const error = new Error("Start date cannot be earlier than project's start date");
            (error as any).statusCode = 400;
            throw error;
          }
        }
      }

      startDateVal = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
    } else {
      const todayParts = parseCalendarDate(new Date())!;
      const todayUtc = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day);

      if (projectObj.expectedEndDate) {
        const projectEndParts = parseCalendarDate(projectObj.expectedEndDate);
        if (projectEndParts) {
          const projectEndUtc = Date.UTC(
            projectEndParts.year,
            projectEndParts.month - 1,
            projectEndParts.day
          );
          if (todayUtc > projectEndUtc) {
            const error = new Error("Start date cannot be after project's expected completion date");
            (error as any).statusCode = 400;
            throw error;
          }
        }
      }

      if (projectObj.startDate) {
        const projectStartParts = parseCalendarDate(projectObj.startDate);
        if (projectStartParts) {
          const projectStartUtc = Date.UTC(
            projectStartParts.year,
            projectStartParts.month - 1,
            projectStartParts.day
          );
          if (todayUtc < projectStartUtc) {
            const error = new Error("Start date cannot be earlier than project's start date");
            (error as any).statusCode = 400;
            throw error;
          }
        }
      }

      startDateVal = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));
    }
  }

  const initialStatus = projectObj ? 'ACTIVE' : 'INACTIVE';
  const assignedProjects = projectObj ? [projectObj._id] : [];
  const projectAssignments = projectObj
    ? [
        {
          projectId: projectObj._id as any,
          startDate: startDateVal!,
          stoppedAt: null,
          status: 'ACTIVE' as const,
        },
      ]
    : [];

  // 2. Create Labour Document
  const newLabour = await Labour.create({
    name: input.name.trim(),
    mobile: input.mobile.trim(),
    location: locationVal,
    projectId: projectObj ? projectObj._id : null,
    assignedProjects,
    projectAssignments,
    dailyWage: Number(input.dailyWage),
    startDate: startDateVal,
    assignmentStartDate: projectObj ? startDateVal : null,
    status: initialStatus,
    stoppedAt: null,
  });

  return getLabourById(
    newLabour._id.toString(),
    projectObj ? { projectId: projectObj._id.toString() } : undefined
  );
};

export const assignLabourToProject = async (
  projectId: string,
  labourId: string,
  startDate?: string | Date | null
): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    const error = new Error('Invalid project ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(labourId)) {
    const error = new Error('Invalid labour ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error('Project not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (['COMPLETED', 'CANCELLED', 'ON_HOLD'].includes(project.status)) {
    const error = new Error('Labour can only be assigned to an active project');
    (error as any).statusCode = 400;
    throw error;
  }

  const labour = await Labour.findById(labourId);
  if (!labour) {
    const error = new Error('Labour not found');
    (error as any).statusCode = 404;
    throw error;
  }

  // Business Rule: Check if labour has any currently active assignment that has not passed its project expectedEndDate
  const now = new Date();
  if (Array.isArray(labour.projectAssignments) && labour.projectAssignments.length > 0) {
    for (const pa of labour.projectAssignments) {
      if (pa.status === 'ACTIVE') {
        const paProjId = pa.projectId?._id ? pa.projectId._id.toString() : pa.projectId?.toString();
        const paProj = await Project.findById(paProjId).lean();
        if (paProj && !isAssignmentActive(pa, now, paProj.expectedEndDate)) {
          pa.status = 'STOPPED';
          pa.stoppedAt = pa.stoppedAt || (paProj.expectedEndDate ? new Date(paProj.expectedEndDate) : now);
        }
      }
    }
  } else if (labour.status === 'ACTIVE' && labour.projectId) {
    const curProj = await Project.findById(labour.projectId).lean();
    if (curProj && !isAssignmentActive({ status: 'ACTIVE', stoppedAt: labour.stoppedAt }, now, curProj.expectedEndDate)) {
      labour.status = 'INACTIVE';
      labour.stoppedAt = labour.stoppedAt || (curProj.expectedEndDate ? new Date(curProj.expectedEndDate) : now);
      labour.projectId = null;
    }
  }

  const activePA = Array.isArray(labour.projectAssignments)
    ? labour.projectAssignments.find((pa: any) => pa.status === 'ACTIVE')
    : null;
  const isCurrentlyActive = Boolean(activePA) || (labour.status === 'ACTIVE' && Boolean(labour.projectId));

  if (isCurrentlyActive) {
    const activePId = activePA
      ? (activePA.projectId?._id ? activePA.projectId._id.toString() : activePA.projectId?.toString())
      : labour.projectId?.toString();

    if (activePId === projectId) {
      const error = new Error('Labour is already assigned to this project.');
      (error as any).statusCode = 400;
      throw error;
    }
    const error = new Error('Labour worker is currently active on another project and cannot be assigned.');
    (error as any).statusCode = 400;
    throw error;
  }

  let finalStartDate = new Date();
  if (startDate !== undefined && startDate !== null && String(startDate).trim() !== '') {
    const startParts = parseCalendarDate(startDate);
    if (!startParts) {
      const error = new Error('Invalid start date format');
      (error as any).statusCode = 400;
      throw error;
    }

    const todayParts = parseCalendarDate(new Date())!;
    const inputUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
    const todayUtc = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day);

    if (inputUtc > todayUtc) {
      const error = new Error('Start date cannot be in the future');
      (error as any).statusCode = 400;
      throw error;
    }

    if (project.expectedEndDate) {
      const projectEndParts = parseCalendarDate(project.expectedEndDate);
      if (projectEndParts) {
        const projectEndUtc = Date.UTC(
          projectEndParts.year,
          projectEndParts.month - 1,
          projectEndParts.day
        );
        if (inputUtc > projectEndUtc) {
          const error = new Error("Start date cannot be after project's expected completion date");
          (error as any).statusCode = 400;
          throw error;
        }
      }
    }

    if (project.startDate) {
      const projectStartParts = parseCalendarDate(project.startDate);
      if (projectStartParts) {
        const projectStartUtc = Date.UTC(
          projectStartParts.year,
          projectStartParts.month - 1,
          projectStartParts.day
        );
        if (inputUtc < projectStartUtc) {
          const error = new Error("Start date cannot be earlier than project's start date");
          (error as any).statusCode = 400;
          throw error;
        }
      }
    }

    finalStartDate = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  } else {
    const todayParts = parseCalendarDate(new Date())!;
    const todayUtc = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day);

    if (project.expectedEndDate) {
      const projectEndParts = parseCalendarDate(project.expectedEndDate);
      if (projectEndParts) {
        const projectEndUtc = Date.UTC(
          projectEndParts.year,
          projectEndParts.month - 1,
          projectEndParts.day
        );
        if (todayUtc > projectEndUtc) {
          const error = new Error("Start date cannot be after project's expected completion date");
          (error as any).statusCode = 400;
          throw error;
        }
      }
    }

    if (project.startDate) {
      const projectStartParts = parseCalendarDate(project.startDate);
      if (projectStartParts) {
        const projectStartUtc = Date.UTC(
          projectStartParts.year,
          projectStartParts.month - 1,
          projectStartParts.day
        );
        if (todayUtc < projectStartUtc) {
          const error = new Error("Start date cannot be earlier than project's start date");
          (error as any).statusCode = 400;
          throw error;
        }
      }
    }
    finalStartDate = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));
  }

  // A worker can return to a project, but never for days already counted on an earlier stint
  const lastWorkedDay = getLastWorkedDay(labour);
  const finalStartDay = toDayNumber(finalStartDate);
  if (lastWorkedDay !== null && finalStartDay !== null && finalStartDay < lastWorkedDay) {
    throw overlapError(lastWorkedDay);
  }

  labour.projectId = project._id as any;
  labour.assignmentStartDate = finalStartDate;
  // Preserve existing master startDate if already set, or initialize if null
  if (!labour.startDate) {
    labour.startDate = finalStartDate;
  }
  labour.status = 'ACTIVE';
  labour.stoppedAt = null;

  if (!labour.assignedProjects) {
    labour.assignedProjects = [];
  }
  if (!labour.assignedProjects.some((p: any) => p.toString() === project._id.toString())) {
    labour.assignedProjects.push(project._id as any);
  }

  if (!labour.projectAssignments) {
    labour.projectAssignments = [];
  }
  labour.projectAssignments.push({
    projectId: project._id as any,
    startDate: finalStartDate,
    stoppedAt: null,
    status: 'ACTIVE',
  });

  // Version check: if two assign requests race (double click), only the first one saves
  labour.increment();
  try {
    await labour.save();
  } catch (err: any) {
    if (err?.name === 'VersionError') {
      const error = new Error('This worker was just updated. Please refresh and try again.');
      (error as any).statusCode = 409;
      throw error;
    }
    throw err;
  }
  return getLabourById(labour._id.toString(), { projectId: project._id.toString() });
};

export const updateLabour = async (
  id: string,
  input: UpdateLabourInput
): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid labour ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const labour = await Labour.findById(id);
  if (!labour) {
    const error = new Error('Labour not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (input.name !== undefined) labour.name = input.name.trim();
  if (input.mobile !== undefined) labour.mobile = input.mobile.trim();
  const locVal =
    input.address !== undefined
      ? input.address.trim()
      : input.location !== undefined
      ? input.location.trim()
      : undefined;
  if (locVal !== undefined) labour.location = locVal;
  if (input.dailyWage !== undefined) labour.dailyWage = Number(input.dailyWage);

  if (input.projectId !== undefined) {
    if (typeof input.projectId !== 'string' || !mongoose.Types.ObjectId.isValid(input.projectId)) {
      const error = new Error('Invalid project ID format');
      (error as any).statusCode = 400;
      throw error;
    }
    const project = await Project.findById(input.projectId);
    if (!project) {
      const error = new Error('Project not found');
      (error as any).statusCode = 404;
      throw error;
    }
    labour.projectId = project._id as any;
    if (!labour.assignedProjects) {
      labour.assignedProjects = [];
    }
    if (!labour.assignedProjects.some((p: any) => p.toString() === project._id.toString())) {
      labour.assignedProjects.push(project._id as any);
    }
    if (labour.projectAssignments && labour.projectAssignments.length > 0) {
      const activePA = labour.projectAssignments
        .slice()
        .reverse()
        .find((pa: any) => pa.status === 'ACTIVE');
      if (activePA) {
        activePA.projectId = project._id as any;
      }
    }
  }

  if (input.startDate !== undefined) {
    const newStart = new Date(input.startDate);
    const activeForStart = (labour.projectAssignments || [])
      .slice()
      .reverse()
      .find((pa: any) => pa.status === 'ACTIVE');
    if (activeForStart) {
      const lastWorkedDay = getLastWorkedDay(labour, activeForStart);
      const newStartDay = toDayNumber(newStart);
      if (lastWorkedDay !== null && newStartDay !== null && newStartDay < lastWorkedDay) {
        throw overlapError(lastWorkedDay);
      }
    }
    labour.startDate = newStart;
    labour.assignmentStartDate = newStart;
    if (labour.projectAssignments && labour.projectAssignments.length > 0) {
      const activePA = labour.projectAssignments
        .slice()
        .reverse()
        .find((pa: any) => pa.status === 'ACTIVE');
      if (activePA) {
        activePA.startDate = newStart;
      }
    }
  }

  // Note: status and stoppedAt are deliberately excluded to protect Labour lifecycle rules (Section 20).

  await labour.save();
  return getLabourById(id);
};

export const deleteLabour = async (id: string): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid labour ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const result = await Labour.findByIdAndDelete(id);
  if (!result) {
    const error = new Error('Labour not found');
    (error as any).statusCode = 404;
    throw error;
  }

  return true;
};

export const stopLabour = async (id: string, stopDateInput?: string): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid labour ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const labour = await Labour.findById(id);
  if (!labour) {
    const error = new Error('Labour not found');
    (error as any).statusCode = 404;
    throw error;
  }

  if (labour.status !== 'ACTIVE') {
    const error = new Error('Only active labour can be stopped');
    (error as any).statusCode = 400;
    throw error;
  }

  const currentProjectId = labour.projectId;
  const activeAssignment = (labour.projectAssignments || [])
    .slice()
    .reverse()
    .find((pa: any) => pa.status === 'ACTIVE');

  // Today by default; a chosen date must sit inside the worker's time on this project
  let stopDate = new Date();
  if (stopDateInput) {
    const projectIdForRange = activeAssignment?.projectId || currentProjectId;
    const project = projectIdForRange
      ? await Project.findById(projectIdForRange).select('expectedEndDate').lean()
      : null;
    const range = getStopDateRange(
      activeAssignment?.startDate || labour.assignmentStartDate || labour.startDate,
      (project as any)?.expectedEndDate,
      (labour.projectAssignments || [])
        .filter((pa: any) => pa !== activeAssignment)
        .map((pa: any) => pa.startDate)
    );
    stopDate = resolveStopDate(stopDateInput, range);
  }

  // Master status becomes INACTIVE
  labour.status = 'INACTIVE';
  labour.stoppedAt = stopDate;

  // Update project assignment record
  if (labour.projectAssignments && labour.projectAssignments.length > 0) {
    if (activeAssignment) {
      activeAssignment.status = 'STOPPED';
      activeAssignment.stoppedAt = stopDate;
    }
  } else if (currentProjectId) {
    labour.projectAssignments = [
      {
        projectId: currentProjectId as any,
        startDate: labour.assignmentStartDate || labour.startDate || stopDate,
        stoppedAt: stopDate,
        status: 'STOPPED',
      },
    ];
  }

  // Clear current active projectId so worker is unassigned and available for assignment
  labour.projectId = null;

  await labour.save();
  return getLabourById(labour._id.toString());
};

/**
 * Changes the stop date of a project the worker has already stopped on.
 * Earned days and wages are worked out from the dates, so they follow the new date.
 */
export const updateAssignmentStopDate = async (
  id: string,
  assignmentId: string,
  stopDateInput: string
): Promise<any> => {
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(assignmentId)) {
    const error = new Error('Invalid labour ID format');
    (error as any).statusCode = 400;
    throw error;
  }

  const labour = await Labour.findById(id);
  if (!labour) {
    const error = new Error('Labour not found');
    (error as any).statusCode = 404;
    throw error;
  }

  const assignments: any[] = labour.projectAssignments || [];
  const assignment = assignments.find((pa: any) => pa._id && pa._id.toString() === assignmentId);
  if (!assignment) {
    const error = new Error('Project record not found for this worker');
    (error as any).statusCode = 404;
    throw error;
  }

  const project = await Project.findById(assignment.projectId).select('expectedEndDate').lean();
  const expectedEndDate = (project as any)?.expectedEndDate || null;

  if (isAssignmentActive(assignment, new Date(), expectedEndDate)) {
    const error = new Error('This worker is still working on this project. Use Stop instead.');
    (error as any).statusCode = 400;
    throw error;
  }

  const range = getStopDateRange(
    assignment.startDate,
    expectedEndDate,
    assignments.filter((pa: any) => pa !== assignment).map((pa: any) => pa.startDate)
  );
  const stopDate = resolveStopDate(stopDateInput, range);

  assignment.status = 'STOPPED';
  assignment.stoppedAt = stopDate;

  // The worker's own stop date follows their latest project
  const startDay = toDayNumber(assignment.startDate);
  const isLatest = assignments.every((pa: any) => {
    const day = toDayNumber(pa.startDate);
    return pa === assignment || day === null || startDay === null || day <= startDay;
  });
  if (labour.status !== 'ACTIVE' && isLatest) {
    labour.stoppedAt = stopDate;
  }

  await labour.save();
  return getLabourById(labour._id.toString());
};

export interface LabourDashboardMetrics {
  totalLabour: number;
  activeLabour: number;
  inactiveLabour: number;
  stoppedLabour: number;
  totalEarned: number;
  totalPaid: number;
  balance: number;
  projectedMonthlyWages: number;
  byStatus: {
    active: number;
    stopped: number;
  };
  byProject: Array<{
    projectId: string;
    projectName: string;
    projectCode: string;
    count: number;
    totalLabour: number;
    activeLabour: number;
    inactiveLabour: number;
    stoppedLabour: number;
    totalEarned: number;
    totalPaid: number;
    balance: number;
  }>;
  recentPayments: Array<{
    id: string;
    labourId: string;
    labourName: string;
    amount: number;
    paymentDate: Date | string;
    paymentMethod: string;
    notes?: string | null;
  }>;
}

export const getLabourDashboardMetrics = async (): Promise<LabourDashboardMetrics> => {
  const labours = await Labour.find({})
    .populate('projectId', 'name projectCode siteAddress status expectedEndDate')
    .populate('projectAssignments.projectId', 'name projectCode siteAddress status expectedEndDate')
    .sort({ createdAt: -1 })
    .lean();

  const labourIds = labours.map((l) => l._id);
  const totalPaidMap = await getTotalPaidMapForLabours(labourIds);

  let totalEarnedSum = 0;
  let totalPaidSum = 0;
  let activeCount = 0;
  let inactiveCount = 0;
  let stoppedCount = 0;
  let projectedMonthlyWages = 0;

  const projectMap = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      projectCode: string;
      count: number;
      totalLabour: number;
      activeLabour: number;
      inactiveLabour: number;
      stoppedLabour: number;
      totalEarned: number;
      totalPaid: number;
      balance: number;
    }
  >();

  for (const l of labours) {
    const activeAssignment = Array.isArray(l.projectAssignments)
      ? l.projectAssignments
          .slice()
          .reverse()
          .find((pa: any) => isAssignmentActive(pa, new Date(), undefined, l))
      : null;
    const hasAssignments = Array.isArray(l.projectAssignments) && l.projectAssignments.length > 0;
    let legacyCap: any = null;
    const directProj = l.projectId as any;
    if (directProj && typeof directProj === 'object' && directProj.expectedEndDate) {
      legacyCap = directProj.expectedEndDate;
    }
    const isLegacyActive = isAssignmentActive(
      { status: l.status, stoppedAt: l.stoppedAt },
      new Date(),
      legacyCap
    );
    const isWorkerActive = hasAssignments ? Boolean(activeAssignment) : isLegacyActive;
    let workerTotalEarned = 0;
    const assignmentList: Array<{
      projId: string;
      projName: string;
      projCode: string;
      status: 'ACTIVE' | 'STOPPED';
      earned: number;
    }> = [];

    if (Array.isArray(l.projectAssignments) && l.projectAssignments.length > 0) {
      for (const pa of l.projectAssignments) {
        if (pa.startDate) {
          const isPAActive = isAssignmentActive(pa, new Date(), undefined, l);
          const paProj = pa.projectId as any;
          const paCap =
            paProj && typeof paProj === 'object' && paProj.expectedEndDate
              ? paProj.expectedEndDate
              : null;
          const stop = isPAActive ? new Date() : (pa.stoppedAt || l.stoppedAt || paCap || new Date());
          const paCalc = calculateLabourEarned(
            {
              dailyWage: l.dailyWage,
              startDate: pa.startDate,
              assignmentStartDate: pa.startDate,
              status: isPAActive ? 'ACTIVE' : 'STOPPED',
              stoppedAt: isPAActive ? null : stop,
            },
            new Date(),
            true,
            paCap
          );
          workerTotalEarned += paCalc.totalEarned;

          let aProjId = 'unassigned';
          let aProjName = 'Unassigned / Archived';
          let aProjCode = 'N/A';
          if (paProj && typeof paProj === 'object' && paProj._id) {
            aProjId = paProj._id.toString();
            aProjName = paProj.name || 'Unnamed Project';
            aProjCode = paProj.projectCode || 'PRJ';
          } else if (paProj) {
            aProjId = paProj.toString();
          }

          assignmentList.push({
            projId: aProjId,
            projName: aProjName,
            projCode: aProjCode,
            status: isPAActive ? 'ACTIVE' : 'STOPPED',
            earned: paCalc.totalEarned,
          });
        }
      }
      workerTotalEarned = Math.round(workerTotalEarned * 100) / 100;
    } else if (isWorkerActive) {
      // Legacy active worker fallback
      const effectiveStart = activeAssignment?.startDate || l.assignmentStartDate || l.startDate;
      let effectiveCap = null;
      const activeProj = activeAssignment?.projectId as any;
      const directProj = l.projectId as any;
      if (activeProj && typeof activeProj === 'object' && activeProj.expectedEndDate) {
        effectiveCap = activeProj.expectedEndDate;
      } else if (directProj && typeof directProj === 'object' && directProj.expectedEndDate) {
        effectiveCap = directProj.expectedEndDate;
      }

      const { totalEarned } = calculateLabourEarned(
        {
          ...l,
          startDate: effectiveStart,
          assignmentStartDate: effectiveStart,
          status: 'ACTIVE',
          stoppedAt: null,
        },
        new Date(),
        false,
        effectiveCap
      );
      workerTotalEarned = totalEarned;

      let aProjId = 'unassigned';
      let aProjName = 'Unassigned / Archived';
      let aProjCode = 'N/A';
      const pObj = activeProj || directProj;
      if (pObj && typeof pObj === 'object' && pObj._id) {
        aProjId = pObj._id.toString();
        aProjName = pObj.name || 'Unnamed Project';
        aProjCode = pObj.projectCode || 'PRJ';
      } else if (l.projectId) {
        aProjId = l.projectId.toString();
      }
      assignmentList.push({
        projId: aProjId,
        projName: aProjName,
        projCode: aProjCode,
        status: 'ACTIVE',
        earned: totalEarned,
      });
    } else if (l.startDate && l.stoppedAt) {
      // Legacy inactive worker fallback
      const histProj = l.projectId as any;
      const histCap =
        histProj && typeof histProj === 'object' && histProj.expectedEndDate
          ? histProj.expectedEndDate
          : null;
      const histCalc = calculateLabourEarned(
        {
          dailyWage: l.dailyWage,
          startDate: l.assignmentStartDate || l.startDate,
          assignmentStartDate: l.assignmentStartDate || l.startDate,
          status: 'STOPPED',
          stoppedAt: l.stoppedAt,
        },
        new Date(),
        false,
        histCap
      );
      workerTotalEarned = histCalc.totalEarned;

      let aProjId = 'unassigned';
      let aProjName = 'Unassigned / Archived';
      let aProjCode = 'N/A';
      if (histProj && typeof histProj === 'object' && histProj._id) {
        aProjId = histProj._id.toString();
        aProjName = histProj.name || 'Unnamed Project';
        aProjCode = histProj.projectCode || 'PRJ';
      } else if (l.projectId) {
        aProjId = l.projectId.toString();
      }
      assignmentList.push({
        projId: aProjId,
        projName: aProjName,
        projCode: aProjCode,
        status: 'STOPPED',
        earned: histCalc.totalEarned,
      });
    }

    const paid = Math.round(Number(totalPaidMap.get(l._id.toString()) || 0) * 100) / 100;

    totalEarnedSum += workerTotalEarned;
    totalPaidSum += paid;

    if (isWorkerActive) {
      activeCount += 1;
      projectedMonthlyWages += (Number(l.dailyWage) || 0) * 30;
    } else {
      inactiveCount += 1;
    }

    if (
      l.status === 'STOPPED' ||
      l.stoppedAt != null ||
      assignmentList.some((a) => a.status === 'STOPPED') ||
      (l.projectAssignments && l.projectAssignments.some((pa: any) => pa.status === 'STOPPED'))
    ) {
      stoppedCount += 1;
    }

    // Grouping by Project for this worker
    if (assignmentList.length > 0) {
      const projMapForWorker = new Map<string, {
        projId: string;
        projName: string;
        projCode: string;
        earned: number;
        hasActive: boolean;
      }>();

      for (const a of assignmentList) {
        if (!projMapForWorker.has(a.projId)) {
          projMapForWorker.set(a.projId, {
            projId: a.projId,
            projName: a.projName,
            projCode: a.projCode,
            earned: 0,
            hasActive: false,
          });
        }
        const pInfo = projMapForWorker.get(a.projId)!;
        pInfo.earned = Math.round((pInfo.earned + a.earned) * 100) / 100;
        if (a.status === 'ACTIVE') {
          pInfo.hasActive = true;
        }
      }

      for (const pInfo of projMapForWorker.values()) {
        if (!projectMap.has(pInfo.projId)) {
          projectMap.set(pInfo.projId, {
            projectId: pInfo.projId,
            projectName: pInfo.projName,
            projectCode: pInfo.projCode,
            count: 0,
            totalLabour: 0,
            activeLabour: 0,
            inactiveLabour: 0,
            stoppedLabour: 0,
            totalEarned: 0,
            totalPaid: 0,
            balance: 0,
          });
        }
        const pGroup = projectMap.get(pInfo.projId)!;
        pGroup.count += 1;
        pGroup.totalLabour += 1;
        if (pInfo.hasActive) {
          pGroup.activeLabour += 1;
        } else {
          pGroup.stoppedLabour += 1;
        }
        pGroup.totalEarned = Math.round((pGroup.totalEarned + pInfo.earned) * 100) / 100;
      }

      // Attribute worker's totalPaid to active project (or latest project)
      const primaryProjId = assignmentList.find(a => a.status === 'ACTIVE')?.projId || assignmentList[assignmentList.length - 1].projId;
      if (projectMap.has(primaryProjId)) {
        const pGroup = projectMap.get(primaryProjId)!;
        pGroup.totalPaid = Math.round((pGroup.totalPaid + paid) * 100) / 100;
      }
    } else {
      const unassignedId = 'unassigned';
      if (!projectMap.has(unassignedId)) {
        projectMap.set(unassignedId, {
          projectId: unassignedId,
          projectName: 'Unassigned / Archived',
          projectCode: 'N/A',
          count: 0,
          totalLabour: 0,
          activeLabour: 0,
          inactiveLabour: 0,
          stoppedLabour: 0,
          totalEarned: 0,
          totalPaid: 0,
          balance: 0,
        });
      }
      const pGroup = projectMap.get(unassignedId)!;
      pGroup.count += 1;
      pGroup.totalLabour += 1;
      pGroup.inactiveLabour += 1;
      pGroup.totalPaid = Math.round((pGroup.totalPaid + paid) * 100) / 100;
    }
  }

  // Recalculate balance for each project in projectMap
  for (const pGroup of projectMap.values()) {
    pGroup.balance = Math.round((pGroup.totalEarned - pGroup.totalPaid) * 100) / 100;
  }

  const recentPayments = await LabourPayment.find({ isDeleted: { $ne: true } })
    .sort({ paymentDate: -1, createdAt: -1 })
    .limit(5)
    .populate('labourId', 'name mobile status')
    .lean();

  const mappedRecentPayments = recentPayments.map((p: any) => ({
    id: p._id.toString(),
    labourId: p.labourId?._id
      ? p.labourId._id.toString()
      : p.labourId
      ? p.labourId.toString()
      : '',
    labourName: p.labourId?.name || 'Labour Worker',
    amount: Number(p.amount || 0),
    paymentDate: p.paymentDate,
    paymentMethod: p.paymentMethod,
    notes: p.notes || null,
  }));

  const roundedTotalEarned = Math.round(totalEarnedSum * 100) / 100;
  const roundedTotalPaid = Math.round(totalPaidSum * 100) / 100;
  const overallBalance = Math.round((roundedTotalEarned - roundedTotalPaid) * 100) / 100;

  const byProject = Array.from(projectMap.values()).sort(
    (a, b) => b.activeLabour - a.activeLabour || b.totalLabour - a.totalLabour
  );

  return {
    totalLabour: labours.length,
    activeLabour: activeCount,
    inactiveLabour: inactiveCount,
    stoppedLabour: stoppedCount,
    totalEarned: roundedTotalEarned,
    totalPaid: roundedTotalPaid,
    balance: overallBalance,
    projectedMonthlyWages: Math.round(projectedMonthlyWages * 100) / 100,
    byStatus: {
      active: activeCount,
      stopped: stoppedCount,
    },
    byProject,
    recentPayments: mappedRecentPayments,
  };
};
