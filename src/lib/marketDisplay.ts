export function extractPriceToBeat(title: string): number | null {
  const match = title.match(/\$([0-9,]+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = parseFloat(match[1].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function getTimeRemaining(endDate: string, now = Date.now()): string {
  const diff = new Date(endDate).getTime() - now;
  if (diff <= 0) return 'EXPIRED';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m left`;
  return `${Math.floor(hrs / 24)}d left`;
}
