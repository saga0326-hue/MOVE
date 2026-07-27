import { useMemo } from 'react';

function colorClasses(count) {
  if (count >= 3) return 'bg-red-100 text-red-700 ring-red-300';
  if (count === 2) return 'bg-green-100 text-green-700 ring-green-300';
  return 'bg-yellow-100 text-yellow-700 ring-yellow-300'; // count === 1
}

// 只統計「店號有填」的槽位（避免特殊業務備註列的雜訊文字被誤算），
// 將預定盤點者逐字拆解，每個字視為一個人員代號分別計次
export default function DailyStaffRow({ groups }) {
  const counts = useMemo(() => {
    const order = [];
    const map = new Map();
    for (const group of groups) {
      for (const row of [group.shift1, group.shift2]) {
        if (!row.店號 || !row.預定盤點者) continue;
        for (const ch of Array.from(row.預定盤點者.trim())) {
          if (!ch.trim()) continue;
          if (!map.has(ch)) {
            map.set(ch, 0);
            order.push(ch);
          }
          map.set(ch, map.get(ch) + 1);
        }
      }
    }
    return order.map((ch) => ({ ch, count: map.get(ch) }));
  }, [groups]);

  if (counts.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <span className="mr-1 shrink-0 text-xs font-medium text-gray-400">當日出勤</span>
      {counts.map(({ ch, count }) => (
        <span
          key={ch}
          title={`「${ch}」今日出現 ${count} 次`}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ${colorClasses(count)}`}
        >
          {ch}
        </span>
      ))}
      <span className="ml-2 flex shrink-0 flex-wrap items-center gap-2 text-[11px] text-gray-400">
        <LegendDot className="bg-yellow-200" label="1次" />
        <LegendDot className="bg-green-200" label="2次(正常)" />
        <LegendDot className="bg-red-200" label="3次以上" />
      </span>
    </div>
  );
}

function LegendDot({ className, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
