export const MS_DAY = 24 * 60 * 60 * 1000;

export const startOfUTCDay = (date = new Date()) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const toDateKey = (date) => new Date(date).toISOString().slice(0, 10);
