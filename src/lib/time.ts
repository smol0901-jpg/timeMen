export const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
export const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const WD_FULL = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];

const p2 = (n: number) => String(n).padStart(2, "0");
export function dkey(d: Date): string { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
export function parseKey(key: string): Date { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d, 12, 0, 0); }
export function todayKey(): string { return dkey(new Date()); }
export function nowMin(): number { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
export function fmtMin(m: number): string { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${p2(Math.floor(x / 60))}:${p2(x % 60)}`; }
export function fmtClock(d: Date): string { return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; }
export function fmtDur(min: number): string {
  const m = Math.max(0, Math.round(min)); const h = Math.floor(m / 60); const r = m % 60;
  if (h === 0) return `${r} м`;
  return r === 0 ? `${h} ч` : `${h} ч ${p2(r)} м`;
}
export function fmtDurH(min: number): string { const m = Math.max(0, Math.round(min)); return `${Math.floor(m / 60)}:${p2(m % 60)}`; }
export function hDec(min: number): number { return Math.round((min / 60) * 10) / 10; }
export function fmtMoney(n: number): string { return `${Math.round(n).toLocaleString("ru-RU")} ₽`; }
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export function addDaysKey(key: string, n: number): string { const d = parseKey(key); d.setDate(d.getDate() + n); return dkey(d); }
export function mondayKey(key: string): string { const d = parseKey(key); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); }
export function monthStart(key: string): string { return key.slice(0, 8) + "01"; }
export function daysInMonth(key: string): number { const [y, m] = key.split("-").map(Number); return new Date(y, m, 0).getDate(); }
export function monthEnd(key: string): string { return key.slice(0, 8) + p2(daysInMonth(key)); }
export function yearStart(key: string): string { return key.slice(0, 4) + "-01-01"; }
export function yearEnd(key: string): string { return key.slice(0, 4) + "-12-31"; }
export function rangeKeys(fromKey: string, toKey: string): string[] {
  const out: string[] = []; let k = fromKey; let guard = 0;
  while (k <= toKey && guard < 400) { out.push(k); k = addDaysKey(k, 1); guard++; }
  return out;
}
export function weekdayIdx(key: string): number { return (parseKey(key).getDay() + 6) % 7; }
export function isWeekend(key: string): boolean { return weekdayIdx(key) >= 5; }
export function fmtDate(key: string): string { const [, m, d] = key.split("-").map(Number); return `${p2(d)}.${p2(m)}`; }
export function fmtDateFull(key: string): string { const [y, m, d] = key.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; }
export function fmtDM(key: string): string { const [, m, d] = key.split("-").map(Number); return `${WD[weekdayIdx(key)]}, ${d} ${MONTHS[m - 1].slice(0, 3)}`; }
export function monthTitle(key: string): string { const [y, m] = key.split("-").map(Number); return `${MONTHS_NOM[m - 1]} ${y}`; }
export function shiftMonth(mk: string, n: number): string {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}
export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчера";
  if (d < 7) return `${d} дн назад`;
  return fmtDateFull(dkey(new Date(iso)));
}
export function uid(): string { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
export function fileSize(b: number): string {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1024 / 1024).toFixed(2)} МБ`;
}
