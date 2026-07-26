import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Store, User, Pencil, GripVertical } from 'lucide-react';
import EditModal from './EditModal';

// dnd id 編碼：type|groupIndex|shift  (同一日期內即可保證唯一)
const encodeId = (type, groupIndex, shift) => `${type}|${groupIndex}|${shift}`;
const decodeId = (id) => {
  const [type, groupIndex, shift] = id.split('|');
  return { type, groupIndex: Number(groupIndex), shift: Number(shift) };
};

const STORE_FIELDS = ['店號', '店名', '型態', '課別', '前次盤點'];
const STAFF_FIELDS = ['預定盤點者', '備註'];

function swapFields(groups, fields, a, b) {
  const next = groups.map((g) => ({
    ...g,
    shift1: { ...g.shift1 },
    shift2: { ...g.shift2 },
  }));
  const rowA = next[a.groupIndex - 1][a.shift === 1 ? 'shift1' : 'shift2'];
  const rowB = next[b.groupIndex - 1][b.shift === 1 ? 'shift1' : 'shift2'];
  for (const f of fields) {
    const tmp = rowA[f];
    rowA[f] = rowB[f];
    rowB[f] = tmp;
  }
  return next;
}

export default function ScheduleBoard({ date, groups, onChangeGroups }) {
  const [editingSlot, setEditingSlot] = useState(null);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const source = decodeId(result.source.droppableId);
    const dest = decodeId(result.destination.droppableId);
    if (source.type !== dest.type) return;
    if (source.groupIndex === dest.groupIndex && source.shift === dest.shift)
      return;

    const fields = source.type === 'store' ? STORE_FIELDS : STAFF_FIELDS;
    onChangeGroups(swapFields(groups, fields, source, dest));
  };

  const openEdit = (groupIndex, shift) => {
    const group = groups[groupIndex - 1];
    const row = shift === 1 ? group.shift1 : group.shift2;
    setEditingSlot({ groupIndex, shift, row });
  };

  const saveEdit = (form) => {
    const { groupIndex, shift } = editingSlot;
    const next = groups.map((g) => ({ ...g, shift1: { ...g.shift1 }, shift2: { ...g.shift2 } }));
    const key = shift === 1 ? 'shift1' : 'shift2';
    next[groupIndex - 1][key] = { ...next[groupIndex - 1][key], ...form };
    onChangeGroups(next);
    setEditingSlot(null);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.groupIndex}
            className="rounded-xl border border-gray-200 bg-gray-50 p-3"
          >
            <div className="mb-2 text-xs font-semibold text-gray-400">
              第 {group.groupIndex} 組
            </div>
            <div className="grid grid-cols-2 gap-2">
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
          onClose={() => setEditingSlot(null)}
          onSave={saveEdit}
        />
      )}
    </DragDropContext>
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
        id={encodeId('store', groupIndex, shift)}
        type="store"
      >
        <div className="flex items-start gap-1.5">
          <Store size={14} className="mt-0.5 shrink-0 text-purple-400" />
          <div className="min-w-0 text-left">
            <div className="truncate text-sm font-medium text-gray-800">
              {row.店號 ? `${row.店號} ${row.店名}` : (
                <span className="text-gray-300">未設定門市</span>
              )}
            </div>
            <div className="truncate text-[11px] text-gray-400">
              {row.型態 && `型態 ${row.型態}`}
              {row.課別 && `　課別 ${row.課別}`}
            </div>
          </div>
        </div>
      </DroppableCard>

      <DroppableCard
        id={encodeId('staff', groupIndex, shift)}
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
