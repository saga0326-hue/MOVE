import { useRef, useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Store,
  Plus,
  Upload,
  X,
  GripVertical,
  ChevronRight,
  ChevronLeft,
  PackageOpen,
  CalendarClock,
  AlertTriangle,
} from 'lucide-react';
import { POOL_ID } from '../utils/dnd';
import { formatDateLabel } from '../utils/date';
import AddStoreModal from './AddStoreModal';

export default function StorePoolPanel({
  pool,
  onAdd,
  onImportFile,
  onRemove,
  dates = [],
  selectedDate = '',
  occurrenceIndex,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError('');
      await onImportFile(file);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '匯入失敗，請確認檔案格式。');
    } finally {
      e.target.value = '';
    }
  };

  if (collapsed) {
    return (
      <div className="shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="flex h-full min-h-[200px] w-10 flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-gray-400 hover:bg-gray-50"
          title="展開店暫存區"
        >
          <ChevronLeft size={16} />
          <Store size={16} />
          {pool.length > 0 && (
            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600">
              {pool.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0">
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <Store size={15} className="text-purple-500" />
            店暫存區
            <span className="text-xs font-normal text-gray-400">({pool.length})</span>
          </h2>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
            title="收合"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mb-2 flex gap-1.5">
          <button
            onClick={() => setShowAdd(true)}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-purple-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
          >
            <Plus size={13} />
            新增店
          </button>
          <button
            onClick={handleImportClick}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white px-2 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            <Upload size={13} />
            匯入店庫異動
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

        <Droppable droppableId={POOL_ID} type="store">
          {(dropProvided, dropSnapshot) => (
            <div
              ref={dropProvided.innerRef}
              {...dropProvided.droppableProps}
              className={`min-h-[80px] space-y-1.5 rounded-lg p-1 transition-colors ${
                dropSnapshot.isDraggingOver ? 'bg-purple-50' : ''
              }`}
            >
              {pool.length === 0 && (
                <div className="flex flex-col items-center gap-1.5 py-8 text-center text-gray-300">
                  <PackageOpen size={28} />
                  <p className="text-xs">暫無店家，可新增或匯入</p>
                </div>
              )}
              {pool.map((store, index) => {
                // 有指定日期且不是目前檢視的日期 -> 淡化，提醒無法放到今天
                const otherDate = store._date && store._date !== selectedDate;
                // 該店已排在班表其他位置 -> 事先提醒重複
                const already = occurrenceIndex?.get(store.店號) ?? [];
                return (
                  <Draggable key={store._id} draggableId={`pool-item|${store._id}`} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        title={
                          store._date
                            ? `僅限 ${formatDateLabel(store._date)} 使用`
                            : '不限日期'
                        }
                        className={`group flex items-center gap-1 rounded-md border px-1.5 py-1.5 ${
                          otherDate
                            ? 'border-dashed border-gray-300 bg-white opacity-50'
                            : 'border-gray-100 bg-gray-50'
                        } ${
                          dragSnapshot.isDragging ? 'bg-white shadow-lg ring-1 ring-purple-200' : ''
                        }`}
                      >
                        <GripVertical size={12} className="shrink-0 text-gray-300" />
                        <div className="min-w-0 flex-1 text-left">
                          <div className="truncate text-sm font-medium text-gray-800">
                            {store.店號} {store.店名}
                          </div>
                          <div className="truncate text-[11px] text-gray-400">
                            {store.型態 && `型態 ${store.型態}`}
                            {store.課別 && `　課別 ${store.課別}`}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {store._date && (
                              <span
                                className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${
                                  otherDate
                                    ? 'bg-gray-100 text-gray-500'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                <CalendarClock size={9} />
                                限 {formatDateLabel(store._date)}
                              </span>
                            )}
                            {already.length > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-medium text-orange-700"
                                title={`此店已排定於 ${already
                                  .map((o) => `${formatDateLabel(o.date)} 第${o.groupIndex}組${o.shift === 1 ? '上午' : '下午'}`)
                                  .join('、')}`}
                              >
                                <AlertTriangle size={9} />
                                已排 {formatDateLabel(already[0].date)}
                                {already.length > 1 ? ` +${already.length - 1}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => onRemove(store._id)}
                          className="shrink-0 rounded p-0.5 text-gray-300 opacity-0 hover:bg-gray-200 hover:text-red-500 group-hover:opacity-100"
                          title="移除"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>

        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
          拖曳店卡到班表槽位即可指派（會從暫存區移除）；也可以把槽位的門市拖回這裡暫存。
        </p>
      </div>

      {showAdd && (
        <AddStoreModal
          dates={dates}
          defaultDate={selectedDate}
          onClose={() => setShowAdd(false)}
          onSave={(form) => {
            onAdd(form);
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
