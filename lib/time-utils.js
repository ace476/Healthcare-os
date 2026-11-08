'use strict';

function parseLocalIST(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 ||
      calendarCheck.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  const parsed = new Date(value + ':00+05:30');
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

module.exports = { parseLocalIST };
