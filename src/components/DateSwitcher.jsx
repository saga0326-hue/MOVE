import { Calendar } from 'lucide-react';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  // 省略年份以保持日期列緊湊，格式：MM/DD 週X
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')} 週${weekday}`;
}

export default function DateSwitcher({ dates, selected, onSelect }) {
  if (dates.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Calendar size={16} className="shrink-0 text-gray-400" />
      {dates.map((date) => (
        <button
          key={date}
          onClick={() => onSelect(date)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            date === selected
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {formatDate(date)}
        </button>
      ))}
    </div>
  );
}
