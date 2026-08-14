import { useMemo } from 'react';
import { Copy } from 'lucide-react';
import { findDuplicateStores } from '../utils/duplicates';
import { formatDateLabel } from '../utils/date';

/**
 * 列出整份班表中被重複排班的門市（一間店一個月只應盤點一次）
 * 跨日期偵測，不受目前檢視的日期影響
 */
export default function DuplicateStoreBanner({ scheduleData, onJump }) {
  const duplicates = useMemo(() => findDuplicateStores(scheduleData), [scheduleData]);

  if (duplicates.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-orange-800">
        <Copy size={15} className="shrink-0" />
        門市重複排班（{duplicates.length} 間）
      </div>
      <ul className="space-y-1 text-sm text-orange-900">
        {duplicates.map((d) => (
          <li key={d.店號} className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-medium">
              {d.店號} {d.店名}
            </span>
            <span className="text-orange-700">重複 {d.occurrences.length} 次：</span>
            {d.occurrences.map((o, i) => (
              <button
                key={`${o.date}-${o.groupIndex}-${o.shift}`}
                onClick={() => onJump?.(o.date)}
                className="rounded bg-orange-200 px-1.5 py-0.5 text-[11px] font-medium hover:bg-orange-300"
                title="跳到該日期"
              >
                {formatDateLabel(o.date)}・第 {o.groupIndex} 組
                {o.shift === 1 ? '上午' : '下午'}
                {i < d.occurrences.length - 1 ? '' : ''}
              </button>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
