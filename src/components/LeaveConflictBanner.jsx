import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { countAssignmentsByCode, getLeaveOnDate } from '../utils/staffUtils';

/**
 * 找出「當天有休假、卻仍被排進班表」的人並列出所在組別
 * 需要同時匯入通訊錄（姓名↔代號對照）與休假表才會啟用
 */
export default function LeaveConflictBanner({
  rows,
  roster,
  leaveRecords,
  date,
  departments,
}) {
  const conflicts = useMemo(() => {
    if (!roster?.length || !leaveRecords?.length) return [];

    const leaveMap = getLeaveOnDate(leaveRecords, date);
    if (leaveMap.size === 0) return [];

    const scoped = departments?.size
      ? roster.filter((p) => departments.has(p.課別))
      : roster;
    const counts = countAssignmentsByCode(rows);
    const result = [];

    for (const person of scoped) {
      const leaveTypes = leaveMap.get(person.姓名);
      if (!leaveTypes) continue;
      const entry = counts.get(person.班表代號);
      if (!entry) continue;
      result.push({
        key: person.工號 || person.姓名,
        姓名: person.姓名,
        代號: person.班表代號,
        假別: leaveTypes.join('、'),
        slots: entry.slots,
      });
    }
    return result;
  }, [rows, roster, leaveRecords, date, departments]);

  if (conflicts.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
        <AlertTriangle size={15} className="shrink-0" />
        休假衝突（{conflicts.length} 人）
      </div>
      <ul className="space-y-1 text-sm text-amber-900">
        {conflicts.map((c) => (
          <li key={c.key} className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-medium">
              {c.姓名}（{c.代號}）
            </span>
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[11px] font-medium">
              {c.假別}
            </span>
            <span className="text-amber-700">
              被排入
              {c.slots
                .map((s) => `${String(s.shift) === '1' ? '上午' : '下午'} ${s.店名 || '未設定門市'}`)
                .join('、')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
