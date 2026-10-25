export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function pettyRemaining(allotted: number, returned: number, spent: number): number {
  return roundMoney(allotted - returned - spent);
}

export function riyadhToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
}
