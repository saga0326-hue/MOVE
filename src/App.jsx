import { useRef, useState } from 'react';
import { Upload, Download, CalendarDays } from 'lucide-react';
import { parseScheduleFile, exportScheduleFile } from './utils/scheduleParser';
import ScheduleBoard from './components/ScheduleBoard';
import DateSwitcher from './components/DateSwitcher';

function App() {
  const [scheduleData, setScheduleData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    } finally {
      e.target.value = '';
    }
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
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white py-24 text-center text-gray-400">
            <CalendarDays size={40} className="mb-3" />
            <p className="text-sm">尚未匯入班表，請點擊上方「匯入 Excel」開始</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <DateSwitcher
                dates={scheduleData.dates}
                selected={selectedDate}
                onSelect={setSelectedDate}
              />
            </div>
            <ScheduleBoard
              date={selectedDate}
              groups={groups}
              storeKeys={scheduleData.storeKeys}
              staffKeys={scheduleData.staffKeys}
              onChangeGroups={handleChangeGroups}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
