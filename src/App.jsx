import { useMemo, useRef, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Upload, Download, CalendarDays, Users, CalendarOff } from 'lucide-react';
import {
  parseScheduleFile,
  exportScheduleFile,
  parseStorePoolFile,
  mergeStorePool,
} from './utils/scheduleParser';
import {
  parseRosterFile,
  parseLeaveFile,
  getScheduleDepartments,
} from './utils/staffParser';
import {
  decodeDroppableId,
  swapFields,
  getSlotStoreFields,
  setSlotStoreFields,
} from './utils/dnd';
import { formatDateLabel } from './utils/date';
import { indexStoreOccurrences } from './utils/duplicates';
import DuplicateStoreBanner from './components/DuplicateStoreBanner';
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
  const [error, setError] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef(null);
  const rosterInputRef = useRef(null);
  const leaveInputRef = useRef(null);

  const handleImportClick = () => fileInputRef.current?.click();

  // 通訊錄／休假表共用的匯入流程：解析成功才覆蓋既有資料
  const makeStaffImporter = (parse, apply, label) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError('');
      apply(await parse(file));
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error && err.message
          ? err.message
          : `${label}匯入失敗，請確認檔案格式是否正確（.xlsx）。`
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleRosterChange = makeStaffImporter(parseRosterFile, setRoster, '通訊錄');
  const handleLeaveChange = makeStaffImporter(parseLeaveFile, setLeaveRecords, '休假表');

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
    // 帶入班表日期，讓「8/3」這類省略年份的寫法能補上正確年份
    const stores = await parseStorePoolFile(file, scheduleData?.dates ?? []);
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
        (o) => !(o.date === selectedDate && o.groupIndex === dst.groupIndex && o.shift === dst.shift)
      );
      if (already.length > 0) {
        const where = already
          .map((o) => `${formatDateLabel(o.date)} 第${o.groupIndex}組${o.shift === 1 ? '上午' : '下午'}`)
          .join('、');
        setError(`⚠ 門市重複：「${store.店號} ${store.店名}」已排定於 ${where}。`);
      } else {
        setError('');
      }
      const displaced = getSlotStoreFields(
        groups,
        dst.groupIndex,
        dst.shift,
        scheduleData.storeKeys
      );
      const nextGroups = setSlotStoreFields(
        groups,
        dst.groupIndex,
        dst.shift,
        store,
        scheduleData.storeKeys
      );
      handleChangeGroups(nextGroups);
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
  // 課別依整份班表判斷，避免週日等無排班日抓不到而列出全部課別人員
  const departments = useMemo(() => getScheduleDepartments(scheduleData), [scheduleData]);
  // 店號 -> 已排定位置，供暫存區卡片與重複提醒使用
  const occurrenceIndex = useMemo(() => indexStoreOccurrences(scheduleData), [scheduleData]);

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
            <input
              ref={rosterInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleRosterChange}
            />
            <input
              ref={leaveInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleLeaveChange}
            />
            <button
              onClick={handleImportClick}
              className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              <Upload size={16} />
              匯入班表
            </button>
            <button
              onClick={() => rosterInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              <Users size={16} />
              匯入通訊錄
              {roster.length > 0 && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                  {roster.length} 人
                </span>
              )}
            </button>
            <button
              onClick={() => leaveInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              <CalendarOff size={16} />
              匯入休假表
              {leaveRecords.length > 0 && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                  {new Set(leaveRecords.map((r) => r.姓名)).size} 人
                </span>
              )}
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
              groups={groups}
              roster={roster}
              leaveRecords={leaveRecords}
              date={selectedDate}
              departments={departments}
            />
            <DailyStaffRow
              groups={groups}
              roster={roster}
              leaveRecords={leaveRecords}
              date={selectedDate}
              departments={departments}
            />
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <ScheduleBoard groups={groups} onChangeGroups={handleChangeGroups} />
              </div>
              <StorePoolPanel
                pool={storePool}
                onAdd={handleAddStore}
                onRemove={handleRemoveStore}
                onImportFile={handleImportStorePool}
                dates={scheduleData.dates}
                selectedDate={selectedDate}
                occurrenceIndex={occurrenceIndex}
              />
            </div>
          </DragDropContext>
        )}
      </main>
    </div>
  );
}

export default App;
