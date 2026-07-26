import { Calendar } from 'lucide-react';

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`;
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
