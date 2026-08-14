import { Calendar } from 'lucide-react';
import { formatDateLabel, getWeekday } from '../utils/date';

// 未選取時的配色：週日紅、週六綠、平日灰
function dayClasses(weekday) {
  if (weekday === 0) return 'bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100';
  if (weekday === 6) return 'bg-green-50 text-green-700 ring-1 ring-green-200 hover:bg-green-100';
  return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
}

// 選取時維持紫底，但保留週末的外框顏色以便辨識
function selectedClasses(weekday) {
  if (weekday === 0) return 'bg-purple-600 text-white ring-2 ring-red-300';
  if (weekday === 6) return 'bg-purple-600 text-white ring-2 ring-green-300';
  return 'bg-purple-600 text-white';
}

export default function DateSwitcher({ dates, selected, onSelect }) {
  if (dates.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <Calendar size={16} className="shrink-0 text-gray-400" />
      {dates.map((date) => {
        const weekday = getWeekday(date);
        return (
          <button
            key={date}
            onClick={() => onSelect(date)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              date === selected ? selectedClasses(weekday) : dayClasses(weekday)
            }`}
          >
            {formatDateLabel(date)}
          </button>
        );
      })}
    </div>
  );
}
