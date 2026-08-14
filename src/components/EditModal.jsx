import { useState } from 'react';
import { X } from 'lucide-react';

export default function EditModal({ slot, onClose, onSave, codeMap }) {
  const [form, setForm] = useState({
    店號: slot.row.店號,
    店名: slot.row.店名,
    型態: slot.row.型態,
    課別: slot.row.課別,
    前次盤點: slot.row.前次盤點,
    預定盤點者: slot.row.預定盤點者,
    備註: slot.row.備註,
  });

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const shiftLabel = slot.shift === 1 ? '午別 1（上午）' : '午別 2（下午）';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-800">
            編輯槽位　第 {slot.groupIndex} 組・{shiftLabel}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="店號" value={form.店號} onChange={update('店號')} />
            <Field label="型態" value={form.型態} onChange={update('型態')} />
          </div>
          <Field label="店名" value={form.店名} onChange={update('店名')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="課別" value={form.課別} onChange={update('課別')} />
            <Field
              label="前次盤點 (yyyymmdd)"
              value={form.前次盤點}
              onChange={update('前次盤點')}
            />
          </div>
          <hr className="border-gray-100" />
          <div>
            <Field
              label="預定盤點者"
              value={form.預定盤點者}
              onChange={update('預定盤點者')}
            />
            <CodePreview value={form.預定盤點者} codeMap={codeMap} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              備註
            </label>
            <textarea
              value={form.備註}
              onChange={update('備註')}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
              placeholder="例：特休、支援其他門市…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              儲存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** 即時顯示每個代號對應到的工號，存檔時會一併寫入盤點1～8 */
function CodePreview({ value, codeMap }) {
  const codes = Array.from(String(value ?? '').trim()).filter((c) => c.trim());
  if (!codeMap || codes.length === 0) return null;

  const unknown = codes.filter((c) => !codeMap.get(c));

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-gray-400">人力 {codes.length}／工號</span>
        {codes.map((code, i) => {
          const id = codeMap.get(code);
          return (
            <span
              key={`${code}-${i}`}
              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                id ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {code} {id ?? '查無'}
            </span>
          );
        })}
      </div>
      {unknown.length > 0 && (
        <p className="mt-1 text-[11px] text-red-500">
          「{unknown.join('、')}」在班表中查無工號，儲存後對應的盤點欄位會留空。
        </p>
      )}
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
      />
    </div>
  );
}
