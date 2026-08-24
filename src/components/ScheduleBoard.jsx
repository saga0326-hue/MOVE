import { useMemo, useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Store, User, Pencil, GripVertical, PackagePlus, XCircle, Plus, Trash2, Eraser } from 'lucide-react';
import { encodeSlotId, updateRow } from '../utils/dnd';
import { buildDayGroups, shiftLabel } from '../utils/grouping';
import { syncStaffDerivedFields } from '../utils/staffUtils';
import EditModal from './EditModal';

export default function ScheduleBoard({
  rows,
  onChangeRows,
  onMoveToPool,
  onAddGroup,
  onDeleteGroup,
  onClearEmptyGroups,
  codeMap,
  inspectionKeys = [],
  storeMaster,
  onNotify,
}) {
  const [editingRid, setEditingRid] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const groups = useMemo(() => buildDayGroups(rows), [rows]);
  // 整組都沒有門市也沒有人員者可刪除
  const isEmptyGroup = (g) => g.rows.every((r) => !r.店號 && !r.預定盤點者);
  const emptyCount = groups.filter(isEmptyGroup).length;

  const editingRow = rows.find((r) => r._rid === editingRid) ?? null;

  const toggleSelect = (rid) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(rid) ? next.delete(rid) : next.add(rid);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const moveSelectedToPool = () => {
    const rids = [...selected].filter((rid) => rows.find((r) => r._rid === rid)?.店號);
    if (rids.length === 0) return;
    onMoveToPool?.(rids);
    clearSelection();
  };

  const saveEdit = (form) => {
    const target = rows.find((r) => r._rid === editingRid);
    if (!target) return;
    // 人員異動後同步人力與盤點1～8 的工號，避免與實際人員對不上
    const { row, unknownCodes } = syncStaffDerivedFields(
      { ...target, ...form },
      codeMap ?? new Map(),
      inspectionKeys
    );
    onChangeRows(updateRow(rows, editingRid, row));
    onNotify?.(
      unknownCodes.length
        ? `已更新，但代號「${unknownCodes.join('、')}」在班表中查無工號，對應的盤點欄位留空。`
        : ''
    );
    setEditingRid(null);
  };

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
        <p className="text-sm text-gray-400">這一天沒有排班資料</p>
        <button
          onClick={onAddGroup}
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Plus size={15} />
          新增組別
        </button>
      </div>
    );
  }

  const selectedCount = [...selected].filter((rid) =>
    rows.find((r) => r._rid === rid)?.店號
  ).length;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {groups.map((group) => (
          <div
            key={group.key}
            className="rounded-xl border border-gray-200 bg-gray-50 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-gray-500">{group.label}</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-gray-400">
                  {group.rows.filter((r) => r.店號).length} 間
                </span>
                {isEmptyGroup(group) && (
                  <button
                    onClick={() => onDeleteGroup?.(group.key)}
                    className="rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-500"
                    title="刪除這個空白組別"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {group.rows.map((row) => (
                <SlotCard
                  key={row._rid}
                  row={row}
                  checked={selected.has(row._rid)}
                  onToggle={() => toggleSelect(row._rid)}
                  onEdit={() => setEditingRid(row._rid)}
                />
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={onAddGroup}
          className="flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-white text-gray-400 transition-colors hover:border-purple-400 hover:bg-purple-50 hover:text-purple-500"
        >
          <Plus size={22} />
          <span className="text-sm font-medium">新增組別</span>
          <span className="px-3 text-[11px] leading-snug">
            會建立空白的上午與下午槽位
          </span>
        </button>
      </div>

      {emptyCount >= 2 && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onClearEmptyGroups}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50 hover:text-red-500"
          >
            <Eraser size={13} />
            清除空白組別（{emptyCount}）
          </button>
        </div>
      )}

      {selectedCount > 0 && (
        <div className="sticky bottom-4 z-40 mt-4 flex justify-center">
          <div className="flex items-center gap-3 rounded-full bg-gray-900 px-4 py-2.5 shadow-lg">
            <span className="text-sm text-white">已勾選 {selectedCount} 間門市</span>
            <button
              onClick={moveSelectedToPool}
              className="flex items-center gap-1.5 rounded-full bg-purple-500 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-purple-400"
            >
              <PackagePlus size={15} />
              移到暫存區
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 rounded-full px-2 py-1.5 text-sm text-gray-300 hover:text-white"
            >
              <XCircle size={15} />
              取消
            </button>
          </div>
        </div>
      )}

      {editingRow && (
        <EditModal
          row={editingRow}
          codeMap={codeMap}
          storeMaster={storeMaster}
          onClose={() => setEditingRid(null)}
          onSave={saveEdit}
        />
      )}
    </>
  );
}

function SlotCard({ row, checked, onToggle, onEdit }) {
  const isMorning = String(row.午別) === '1';
  const hasStore = !!row.店號;
  // 人力即時由預定盤點者推導，與匯出規則一致，避免顯示到殘留的舊值
  const headcount = Array.from(String(row.預定盤點者 ?? '').trim()).filter((c) => c.trim()).length;

  return (
    <div
      className={`rounded-lg bg-white p-2 shadow-sm ring-1 transition-colors ${
        checked ? 'ring-2 ring-purple-400' : 'ring-gray-100'
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            disabled={!hasStore}
            title={hasStore ? '勾選以批次移到暫存區' : '無門市可勾選'}
            className="h-3.5 w-3.5 shrink-0 accent-purple-600 disabled:opacity-30"
          />
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
              isMorning ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
            }`}
          >
            {shiftLabel(row.午別)}
          </span>
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-purple-500"
          title="編輯"
        >
          <Pencil size={13} />
        </button>
      </div>

      <DroppableCard id={encodeSlotId('store', row._rid)} type="store">
        <div className="flex items-start gap-1.5">
          <Store size={14} className="mt-0.5 shrink-0 text-purple-400" />
          <div className="min-w-0 text-left">
            {hasStore ? (
              <>
                <div className="break-words text-sm font-medium text-gray-800">{row.店號}</div>
                <div className="break-words text-sm font-medium text-gray-800">{row.店名}</div>
              </>
            ) : (
              <div className="text-sm text-gray-300">未設定門市</div>
            )}
            <div className="break-words text-[11px] text-gray-400">
              {row.型態 && `型態 ${row.型態}`}
              {row.營業課別 && `　${row.營業課別}`}
            </div>
            {row.備註 && (
              <div className="break-words text-[11px] text-amber-600">{row.備註}</div>
            )}
          </div>
        </div>
      </DroppableCard>

      <DroppableCard id={encodeSlotId('staff', row._rid)} type="staff">
        <div className="flex items-start gap-1.5">
          <User size={14} className="mt-0.5 shrink-0 text-teal-400" />
          <div className="min-w-0 text-left">
            <div className="break-words text-sm font-medium text-gray-800">
              {row.預定盤點者 || <span className="text-gray-300">未指派</span>}
              {headcount > 0 && (
                <span className="ml-1 text-[11px] font-normal text-gray-400">
                  {headcount} 人
                </span>
              )}
            </div>
          </div>
        </div>
      </DroppableCard>
    </div>
  );
}

function DroppableCard({ id, type, children }) {
  return (
    <Droppable droppableId={id} type={type}>
      {(dropProvided, dropSnapshot) => (
        <div
          ref={dropProvided.innerRef}
          {...dropProvided.droppableProps}
          className={`mb-1.5 rounded-md border px-1.5 py-1.5 transition-colors last:mb-0 ${
            dropSnapshot.isDraggingOver
              ? 'border-purple-300 bg-purple-50'
              : 'border-transparent'
          }`}
        >
          <Draggable draggableId={id} index={0}>
            {(dragProvided, dragSnapshot) => (
              <div
                ref={dragProvided.innerRef}
                {...dragProvided.draggableProps}
                {...dragProvided.dragHandleProps}
                className={`flex items-center gap-1 rounded ${
                  dragSnapshot.isDragging ? 'bg-white shadow-lg ring-1 ring-purple-200' : ''
                }`}
              >
                <GripVertical size={12} className="shrink-0 text-gray-200" />
                <div className="min-w-0 flex-1">{children}</div>
              </div>
            )}
          </Draggable>
          {dropProvided.placeholder}
        </div>
      )}
    </Droppable>
  );
}
