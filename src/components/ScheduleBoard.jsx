import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Store, User, Pencil, GripVertical } from 'lucide-react';
import { encodeSlotId } from '../utils/dnd';
import { syncStaffDerivedFields } from '../utils/staffUtils';
import EditModal from './EditModal';

export default function ScheduleBoard({
  groups,
  onChangeGroups,
  codeMap,
  inspectionKeys = [],
  storeMaster,
  onNotify,
}) {
  const [editingSlot, setEditingSlot] = useState(null);

  const openEdit = (groupIndex, shift) => {
    const group = groups[groupIndex - 1];
    const row = shift === 1 ? group.shift1 : group.shift2;
    setEditingSlot({ groupIndex, shift, row });
  };

  const saveEdit = (form) => {
    const { groupIndex, shift } = editingSlot;
    const next = groups.map((g) => ({ ...g, shift1: { ...g.shift1 }, shift2: { ...g.shift2 } }));
    const key = shift === 1 ? 'shift1' : 'shift2';
    const merged = { ...next[groupIndex - 1][key], ...form };

    // 人員異動後同步人力與盤點1～8 的工號，避免與實際人員對不上
    const { row, unknownCodes } = syncStaffDerivedFields(
      merged,
      codeMap ?? new Map(),
      inspectionKeys
    );
    next[groupIndex - 1][key] = row;

    onChangeGroups(next);
    onNotify?.(
      unknownCodes.length
        ? `已更新，但代號「${unknownCodes.join('、')}」在班表中查無工號，對應的盤點欄位留空。`
        : ''
    );
    setEditingSlot(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {groups.map((group) => (
          <div
            key={group.groupIndex}
            className="rounded-xl border border-gray-200 bg-gray-50 p-3"
          >
            <div className="mb-2 text-xs font-semibold text-gray-400">
              第 {group.groupIndex} 組
            </div>
            <div className="grid grid-cols-1 gap-2">
              <SlotColumn
                label="午別 1（上午）"
                groupIndex={group.groupIndex}
                shift={1}
                row={group.shift1}
                onEdit={openEdit}
              />
              <SlotColumn
                label="午別 2（下午）"
                groupIndex={group.groupIndex}
                shift={2}
                row={group.shift2}
                onEdit={openEdit}
              />
            </div>
          </div>
        ))}
      </div>

      {editingSlot && (
        <EditModal
          slot={editingSlot}
          codeMap={codeMap}
          storeMaster={storeMaster}
          onClose={() => setEditingSlot(null)}
          onSave={saveEdit}
        />
      )}
    </>
  );
}

function SlotColumn({ label, groupIndex, shift, row, onEdit }) {
  return (
    <div className="rounded-lg bg-white p-2 shadow-sm ring-1 ring-gray-100">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-400">{label}</span>
        <button
          onClick={() => onEdit(groupIndex, shift)}
          className="rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-purple-500"
          title="編輯"
        >
          <Pencil size={13} />
        </button>
      </div>

      <DroppableCard
        id={encodeSlotId('store', groupIndex, shift)}
        type="store"
      >
        <div className="flex items-start gap-1.5">
          <Store size={14} className="mt-0.5 shrink-0 text-purple-400" />
          <div className="min-w-0 text-left">
            {row.店號 ? (
              <>
                <div className="break-words text-sm font-medium text-gray-800">
                  {row.店號}
                </div>
                <div className="break-words text-sm font-medium text-gray-800">
                  {row.店名}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-300">未設定門市</div>
            )}
            <div className="break-words text-[11px] text-gray-400">
              {row.型態 && `型態 ${row.型態}`}
              {row.課別 && `　課別 ${row.課別}`}
            </div>
          </div>
        </div>
      </DroppableCard>

      <DroppableCard
        id={encodeSlotId('staff', groupIndex, shift)}
        type="staff"
      >
        <div className="flex items-start gap-1.5">
          <User size={14} className="mt-0.5 shrink-0 text-teal-400" />
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-medium text-gray-800">
              {row.預定盤點者 || <span className="text-gray-300">未指派</span>}
            </div>
            {row.備註 && (
              <div className="truncate text-[11px] text-gray-400">
                {row.備註}
              </div>
            )}
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
