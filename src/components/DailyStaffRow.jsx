import { useMemo } from 'react';
import { countAssignmentsByCode, getLeaveOnDate } from '../utils/staffUtils';

// 紅色＝需要留意：休假卻仍被排班，或同一天帶 3 間以上（庫存少時屬合理情況，僅作提示）
function colorClasses(count, onLeave) {
  if (count >= 3 || (onLeave && count > 0)) {
    return 'bg-red-100 text-red-700 ring-1 ring-red-300';
  }
  if (onLeave) return 'bg-sky-100 text-sky-700 ring-1 ring-sky-300'; // 休假且未被排班
  if (count === 2) return 'bg-green-100 text-green-700 ring-1 ring-green-300';
  if (count === 1) return 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300';
  return 'text-gray-400'; // 0 次＝今日未排班，不上色
}

export default function DailyStaffRow({ rows, roster, leaveRecords, date, departments }) {
  const entries = useMemo(() => {
    const counts = countAssignmentsByCode(rows);

    // 沒有通訊錄時，維持原本行為：只列出班表中實際出現過的代號
    if (!roster || roster.length === 0) {
      return [...counts.entries()].map(([code, { count }]) => ({
        code,
        count,
        person: null,
      }));
    }

    const scoped = departments?.size
      ? roster.filter((p) => departments.has(p.課別))
      : roster;

    const leaveMap = getLeaveOnDate(leaveRecords ?? [], date);

    // 先依通訊錄順序列出該課別所有人（含今日未排班者）
    const list = scoped.map((person) => ({
      key: person.工號 || `${person.課別}-${person.姓名}`,
      code: person.班表代號,
      count: counts.get(person.班表代號)?.count ?? 0,
      person,
      leave: leaveMap.get(person.姓名) ?? null,
    }));

    // 再補上班表有出現、但通訊錄查無的代號（例如新人尚未建檔）
    const known = new Set(scoped.map((p) => p.班表代號));
    for (const [code, { count }] of counts.entries()) {
      if (!known.has(code)) {
        list.push({ key: `unlisted-${code}`, code, count, person: null, unlisted: true });
      }
    }
    return list;
  }, [rows, roster, leaveRecords, date, departments]);

  if (entries.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <span className="mr-1 shrink-0 text-xs font-medium text-gray-400">當日出勤</span>
      {entries.map(({ key, code, count, person, leave, unlisted }) => (
        <span
          key={key ?? code}
          title={buildTooltip(code, count, person, leave, unlisted)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${colorClasses(
            count,
            leave?.length
          )} ${unlisted ? 'outline-dashed outline-1 outline-offset-1 outline-gray-400' : ''}`}
        >
          {code}
        </span>
      ))}
      <span className="ml-2 flex shrink-0 flex-wrap items-center gap-2 text-[11px] text-gray-400">
        <span>未排班＝無色</span>
        <LegendDot className="bg-sky-200" label="休假" />
        <LegendDot className="bg-yellow-200" label="1次" />
        <LegendDot className="bg-green-200" label="2次(正常)" />
        <LegendDot className="bg-red-200" label="注意(休假被排班/3間以上)" />
      </span>
    </div>
  );
}

function buildTooltip(code, count, person, leave, unlisted) {
  const who = person ? `${person.姓名}（${person.職稱}）` : `代號 ${code}`;
  const times = count === 0 ? '今日未排班' : `今日 ${count} 次`;
  const parts = [`${who}・${times}`];
  if (leave?.length) parts.push(`休假中（${leave.join('、')}）`);
  if (unlisted) parts.push('通訊錄尚未建檔');
  return parts.join('　');
}

function LegendDot({ className, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
