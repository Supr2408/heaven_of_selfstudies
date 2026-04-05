export const SEMESTER_MONTHS = {
  'Jan-Apr': ['January', 'February', 'March', 'April'],
  'Jul-Oct': ['July', 'August', 'September', 'October'],
  'July-Oct': ['July', 'August', 'September', 'October'],
  'Aug-Oct': ['August', 'September', 'October'],
};

export const AVAILABILITY_STATUS = {
  FULL: 'full',
  PARTIAL: 'partial',
  NONE: 'none',
};

export const getSemesterMonths = (semester) => SEMESTER_MONTHS[semester] || ['General'];

export const hasWeekStudyContent = (week = {}) => {
  const materials = Array.isArray(week?.materials) ? week.materials : [];
  const pdfLinks = Array.isArray(week?.pdfLinks) ? week.pdfLinks : [];
  return materials.length > 0 || pdfLinks.length > 0;
};

export const getAvailabilityStatus = (availableCount = 0, totalCount = 0) => {
  if (!totalCount || availableCount <= 0) {
    return AVAILABILITY_STATUS.NONE;
  }

  if (availableCount >= totalCount) {
    return AVAILABILITY_STATUS.FULL;
  }

  return AVAILABILITY_STATUS.PARTIAL;
};

export const summarizeWeeksAvailability = (weeks = []) => {
  const totalWeeks = Array.isArray(weeks) ? weeks.length : 0;
  const availableWeeks = (Array.isArray(weeks) ? weeks : []).filter(hasWeekStudyContent).length;
  const status = getAvailabilityStatus(availableWeeks, totalWeeks);

  return {
    status,
    totalWeeks,
    availableWeeks,
    missingWeeks: Math.max(totalWeeks - availableWeeks, 0),
    coveragePercent: totalWeeks ? Math.round((availableWeeks / totalWeeks) * 100) : 0,
  };
};

export const groupWeeksByMonth = (weeks = [], semester = '') => {
  if (!Array.isArray(weeks) || weeks.length === 0) {
    return [];
  }

  const months = getSemesterMonths(semester);
  const sortedWeeks = [...weeks].sort((a, b) => (a?.weekNumber || 0) - (b?.weekNumber || 0));
  const weeksPerMonth = Math.max(1, Math.ceil(sortedWeeks.length / months.length));

  return months
    .map((month, index) => {
      const start = index * weeksPerMonth;
      const end = start + weeksPerMonth;
      const bucketWeeks = sortedWeeks.slice(start, end);
      const summary = summarizeWeeksAvailability(bucketWeeks);

      return {
        month,
        weeks: bucketWeeks,
        ...summary,
      };
    })
    .filter((bucket) => bucket.weeks.length > 0);
};

export const getAvailabilityMeta = (status = AVAILABILITY_STATUS.NONE) => {
  if (status === AVAILABILITY_STATUS.FULL) {
    return {
      label: 'Full',
      dotClass: 'bg-emerald-500 ring-2 ring-emerald-200/30',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      panelClass: 'border-emerald-200 bg-emerald-50/80',
    };
  }

  if (status === AVAILABILITY_STATUS.PARTIAL) {
    return {
      label: 'Partial',
      dotClass: 'bg-yellow-300 ring-2 ring-yellow-200/50',
      badgeClass: 'border-yellow-300 bg-yellow-50 text-yellow-800',
      panelClass: 'border-yellow-300 bg-yellow-50/90',
    };
  }

  return {
    label: 'Missing',
    dotClass: 'bg-rose-500 ring-2 ring-rose-200/30',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    panelClass: 'border-rose-200 bg-rose-50/80',
  };
};
