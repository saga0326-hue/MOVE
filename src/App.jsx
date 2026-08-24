import { useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Upload, Download, CalendarDays } from 'lucide-react';
import {
  parseScheduleFile,
  exportScheduleFile,
  parseStorePoolFile,
  mergeStorePool,
} from './utils/scheduleParser';
import {
  getScheduleDepartments,
  getScheduleYearMonths,
  buildCodeToIdMap,
  getInspectionKeys,
} from './utils/staffUtils';
import { fetchRoster, fetchLeave } from './services/staffApi';
import { formatDateLabel } from './utils/date';
import { indexStoreOccurrences } from './utils/duplicates';
import { buildStoreMaster } from './utils/storeMaster';
import DuplicateStoreBanner from './components/DuplicateStoreBanner';
import {
  decodeDroppableId,
  swapFields,
  getRowStoreFields,
  setRowStoreFields,
} from './utils/dnd';
import ScheduleBoard from './components/ScheduleBoard';
import DateSwitcher from './components/DateSwitcher';
import StorePoolPanel from './components/StorePoolPanel';
import DailyStaffRow from './components/DailyStaffRow';
import LeaveConflictBanner from './components/LeaveConflictBanner';

function App() {
  const [scheduleData, setScheduleData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [storePool, setStorePool] = useState([]);
  const [roster, setRoster] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [staffApiError, setStaffApiError] = useState('');
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

  const handleChangeRows = (nextRows) => {
    setScheduleData((prev) => ({
      ...prev,
      byDate: { ...prev.byDate, [selectedDate]: nextRows },
    }));
  };

  /** 批次把勾選的門市移到暫存區，並清空原槽位 */
  const handleMoveToPool = (rids) => {
    const rows = scheduleData.byDate[selectedDate] ?? [];
    const moved = [];
    let nextRows = rows;
    for (const rid of rids) {
      const storeData = getRowStoreFields(nextRows, rid, scheduleData.storeKeys);
      if (!storeData['店號']) continue;
      moved.push({ _id: crypto.randomUUID(), ...storeData, _date: selectedDate });
      nextRows = setRowStoreFields(nextRows, rid, {}, scheduleData.storeKeys);
    }
    if (moved.length === 0) return;
    handleChangeRows(nextRows);
    setStorePool((prev) => [...prev, ...moved]);
    setError(`已將 ${moved.length} 間門市移到暫存區（指定日期為 ${formatDateLabel(selectedDate)}）。`);
  };

  const handleAddStore = (form) => {
    setStorePool((prev) => [...prev, { _id: crypto.randomUUID(), ...form }]);
  };

  const handleRemoveStore = (id) => {
    setStorePool((prev) => prev.filter((s) => s._id !== id));
  };

  const handleImportStorePool = async (file) => {
    // 帶入班表日期，讓「8/3」這類省略年份的寫法能補上正確年份
    const stores = await parseStorePoolFile(file, scheduleData?.dates ?? []);
    setStorePool((prev) => mergeStorePool(prev, stores));
  };

  const handleDragEnd = (result) => {
    if (!result.destination || !scheduleData) return;
    const src = decodeDroppableId(result.source.droppableId);
    const dst = decodeDroppableId(result.destination.droppableId);
    const rows = scheduleData.byDate[selectedDate] ?? [];

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

    // 暫存區 -> 班表槽位：指派店家並從暫存區移除；
    // 若該槽位原本已有門市，將原門市退回暫存區（不覆蓋遺失）
    if (src.kind === 'pool' && dst.kind === 'slot' && dst.type === 'store') {
      const store = storePool[result.source.index];
      if (!store) return;
      // 有指定日期的店只能放在該日期
      if (store._date && store._date !== selectedDate) {
        setError(
          `「${store.店號} ${store.店名}」限 ${formatDateLabel(store._date)} 使用，無法放在 ${formatDateLabel(selectedDate)}。`
        );
        return;
      }
      // 一間店一個月只應盤點一次：若已排在別處先提醒（仍允許放置，方便調整過程）
      const already = (occurrenceIndex.get(store.店號) ?? []).filter(
        (o) => !(o.date === selectedDate && o.rid === dst.rid)
      );
      if (already.length > 0) {
        const where = already
          .map((o) => `${formatDateLabel(o.date)} ${String(o.shift) === '1' ? '上午' : '下午'} ${o.店名 || ''}`.trim())
          .join('、');
        setError(`⚠ 門市重複：「${store.店號} ${store.店名}」已排定於 ${where}。`);
      } else {
        setError('');
      }
      const displaced = getRowStoreFields(rows, dst.rid, scheduleData.storeKeys);
      handleChangeRows(setRowStoreFields(rows, dst.rid, store, scheduleData.storeKeys));
      setStorePool((prev) => {
        const next = prev.filter((_, i) => i !== result.source.index);
        // 插回原本拖走的位置，避免整排卡片跳動
        if (displaced['店號']) {
          next.splice(result.source.index, 0, { _id: crypto.randomUUID(), ...displaced });
        }
        return next;
      });
      return;
    }

    // 班表槽位 -> 暫存區：把門市退回暫存區，並清空該槽位
    if (src.kind === 'slot' && src.type === 'store' && dst.kind === 'pool') {
      const storeData = getRowStoreFields(rows, src.rid, scheduleData.storeKeys);
      if (!storeData['店號']) return;
      handleChangeRows(setRowStoreFields(rows, src.rid, {}, scheduleData.storeKeys));
      setStorePool((prev) => [...prev, { _id: crypto.randomUUID(), ...storeData }]);
      return;
    }

    // 班表槽位之間互換（門市 或 人員資訊）
    if (src.kind === 'slot' && dst.kind === 'slot') {
      if (src.type !== dst.type) return;
      if (src.rid === dst.rid) return;
      const fields = src.type === 'store' ? scheduleData.storeKeys : scheduleData.staffKeys;
      handleChangeRows(swapFields(rows, fields, src.rid, dst.rid));
    }
  };

  const dayRows = scheduleData?.byDate[selectedDate] ?? [];
  // 課別依整份班表判斷，避免週日等無排班日抓不到而列出全部課別人員
  const departments = useMemo(() => getScheduleDepartments(scheduleData), [scheduleData]);
  const yearMonths = useMemo(() => getScheduleYearMonths(scheduleData), [scheduleData]);
  // 店號 -> 已排定位置，供暫存區卡片與重複提醒使用
  const occurrenceIndex = useMemo(() => indexStoreOccurrences(scheduleData), [scheduleData]);
  // 代號 -> 工號，直接從班表的「預定盤點者 ↔ 盤點1~8」對應關係還原
  const codeMap = useMemo(() => buildCodeToIdMap(scheduleData), [scheduleData]);
  const inspectionKeys = useMemo(() => getInspectionKeys(scheduleData), [scheduleData]);
  // 店號 -> 門市屬性（店名／型態／課別／課別代號／營業課別／前次盤點），同樣由班表推導
  const storeMaster = useMemo(() => buildStoreMaster(scheduleData), [scheduleData]);

  // 班表匯入後，依其課別與年月向後端取得人員通訊錄與休假資料
  // API 尚未就緒時僅顯示提示，班表功能仍可正常操作（出勤列會退回只統計班表內出現的代號）
  useEffect(() => {
    if (departments.size === 0) return;
    let cancelled = false;
    const deptList = [...departments];

    (async () => {
      try {
        setStaffApiError('');
        const [rosterData, leaveData] = await Promise.all([
          fetchRoster(deptList),
          fetchLeave(deptList, yearMonths),
        ]);
        if (cancelled) return;
        setRoster(rosterData);
        setLeaveRecords(leaveData);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setRoster([]);
        setLeaveRecords([]);
        setStaffApiError('人員資料 API 尚未連線，出勤統計改以班表內容顯示。');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [departments, yearMonths]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-[1800px] px-4 py-4">
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
              匯入班表
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
            {staffApiError && (
              <span className="text-sm text-amber-600">{staffApiError}</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] px-4 py-5">
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
                : '尚未匯入班表，請點擊上方「匯入班表」或將檔案拖曳到此處'}
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
            <DuplicateStoreBanner scheduleData={scheduleData} onJump={setSelectedDate} />
            <LeaveConflictBanner
              rows={dayRows}
              roster={roster}
              leaveRecords={leaveRecords}
              date={selectedDate}
              departments={departments}
            />
            <DailyStaffRow
              rows={dayRows}
              roster={roster}
              leaveRecords={leaveRecords}
              date={selectedDate}
              departments={departments}
            />
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <ScheduleBoard
                  rows={dayRows}
                  onChangeRows={handleChangeRows}
                  onMoveToPool={handleMoveToPool}
                  codeMap={codeMap}
                  inspectionKeys={inspectionKeys}
                  storeMaster={storeMaster}
                  onNotify={setError}
                />
              </div>
              <StorePoolPanel
                pool={storePool}
                onAdd={handleAddStore}
                onRemove={handleRemoveStore}
                onImportFile={handleImportStorePool}
                dates={scheduleData.dates}
                selectedDate={selectedDate}
                occurrenceIndex={occurrenceIndex}
                storeMaster={storeMaster}
              />
            </div>
          </DragDropContext>
        )}
      </main>
    </div>
  );
}

export default App;
