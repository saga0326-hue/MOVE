import { useRef, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Upload, Download, CalendarDays } from 'lucide-react';
import {
  parseScheduleFile,
  exportScheduleFile,
  parseStorePoolFile,
  mergeStorePool,
} from './utils/scheduleParser';
import {
  decodeDroppableId,
  swapFields,
  getSlotStoreFields,
  setSlotStoreFields,
} from './utils/dnd';
import ScheduleBoard from './components/ScheduleBoard';
import DateSwitcher from './components/DateSwitcher';
import StorePoolPanel from './components/StorePoolPanel';
import DailyStaffRow from './components/DailyStaffRow';

function App() {
  const [scheduleData, setScheduleData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [storePool, setStorePool] = useState([]);
  const [error, setError] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);

  const handleImportClick = () => fileInputRef.current?.click();

  const processScheduleFile = async (file) => {
    try {
      setError('');
      const data = await parseScheduleFile(file);
      if (data.dates.length === 0) {
        setError('檔案中找不到有效的日期資料，請確認欄位是否正確。');
        return;
      }
      setScheduleData(data);
      setSelectedDate(data.dates[0]);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error && err.message.includes('欄位標題列')
          ? err.message
          : '匯入失敗，請確認檔案格式是否正確（.xlsx）。'
      );
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processScheduleFile(file);
    e.target.value = '';
  };

  const handleDropFile = async (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processScheduleFile(file);
  };

  const handleExport = () => {
    if (!scheduleData) return;
    exportScheduleFile(scheduleData);
  };

  const handleChangeGroups = (nextGroups) => {
    setScheduleData((prev) => ({
      ...prev,
      byDate: { ...prev.byDate, [selectedDate]: nextGroups },
    }));
  };

  const handleAddStore = (form) => {
    setStorePool((prev) => [...prev, { _id: crypto.randomUUID(), ...form }]);
  };

  const handleRemoveStore = (id) => {
    setStorePool((prev) => prev.filter((s) => s._id !== id));
  };

  const handleImportStorePool = async (file) => {
    const stores = await parseStorePoolFile(file);
    setStorePool((prev) => mergeStorePool(prev, stores));
  };

  const handleDragEnd = (result) => {
    if (!result.destination || !scheduleData) return;
    const src = decodeDroppableId(result.source.droppableId);
    const dst = decodeDroppableId(result.destination.droppableId);
    const groups = scheduleData.byDate[selectedDate];

    // 暫存區內重新排序
    if (src.kind === 'pool' && dst.kind === 'pool') {
      if (result.source.index === result.destination.index) return;
      setStorePool((prev) => {
        const next = [...prev];
        const [moved] = next.splice(result.source.index, 1);
        next.splice(result.destination.index, 0, moved);
        return next;
      });
      return;
    }

    // 暫存區 -> 班表槽位：指派店家，並從暫存區移除
    if (src.kind === 'pool' && dst.kind === 'slot' && dst.type === 'store') {
      const store = storePool[result.source.index];
      if (!store) return;
      const nextGroups = setSlotStoreFields(
        groups,
        dst.groupIndex,
        dst.shift,
        store,
        scheduleData.storeKeys
      );
      handleChangeGroups(nextGroups);
      setStorePool((prev) => prev.filter((_, i) => i !== result.source.index));
      return;
    }

    // 班表槽位 -> 暫存區：把門市退回暫存區，並清空該槽位
    if (src.kind === 'slot' && src.type === 'store' && dst.kind === 'pool') {
      const storeData = getSlotStoreFields(groups, src.groupIndex, src.shift, scheduleData.storeKeys);
      if (!storeData['店號']) return;
      handleChangeGroups(
        setSlotStoreFields(groups, src.groupIndex, src.shift, {}, scheduleData.storeKeys)
      );
      setStorePool((prev) => [...prev, { _id: crypto.randomUUID(), ...storeData }]);
      return;
    }

    // 班表槽位之間互換（門市 或 人員資訊）
    if (src.kind === 'slot' && dst.kind === 'slot') {
      if (src.type !== dst.type) return;
      if (src.groupIndex === dst.groupIndex && src.shift === dst.shift) return;
      const fields = src.type === 'store' ? scheduleData.storeKeys : scheduleData.staffKeys;
      handleChangeGroups(swapFields(groups, fields, src, dst));
    }
  };

  const groups = scheduleData?.byDate[selectedDate];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <h1 className="mb-3 text-xl font-bold text-gray-800">
            盤點班表調移系統
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={handleImportClick}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              <Upload size={16} />
              匯入 Excel
            </button>
            <button
              onClick={handleExport}
              disabled={!scheduleData}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={16} />
              匯出 Excel
            </button>
            {error && <span className="text-sm text-red-500">{error}</span>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        {!scheduleData ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={handleDropFile}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-24 text-center transition-colors ${
              isDraggingFile
                ? 'border-purple-400 bg-purple-50 text-purple-400'
                : 'border-gray-300 bg-white text-gray-400'
            }`}
          >
            <CalendarDays size={40} className="mb-3" />
            <p className="text-sm">
              {isDraggingFile
                ? '放開以匯入班表'
                : '尚未匯入班表，請點擊上方「匯入 Excel」或將檔案拖曳到此處'}
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="mb-4">
              <DateSwitcher
                dates={scheduleData.dates}
                selected={selectedDate}
                onSelect={setSelectedDate}
              />
            </div>
            <DailyStaffRow groups={groups} />
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <ScheduleBoard groups={groups} onChangeGroups={handleChangeGroups} />
              </div>
              <StorePoolPanel
                pool={storePool}
                onAdd={handleAddStore}
                onRemove={handleRemoveStore}
                onImportFile={handleImportStorePool}
              />
            </div>
          </DragDropContext>
        )}
      </main>
    </div>
  );
}

export default App;
