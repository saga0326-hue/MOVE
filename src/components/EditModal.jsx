import { useState } from 'react';
import { X, CornerDownRight } from 'lucide-react';
import { lookupStore } from '../utils/storeMaster';

export default function EditModal({ row, onClose, onSave, codeMap, storeMaster }) {
  const [form, setForm] = useState({
    店號: row.店號 ?? '',
    店名: row.店名 ?? '',
    型態: row.型態 ?? '',
    課別: row.課別 ?? '',
    課別代號: row.課別代號 ?? '',
    營業課別: row.營業課別 ?? '',
    前次盤點: row.前次盤點 ?? '',
    預定盤點者: row.預定盤點者 ?? '',
    備註: row.備註 ?? '',
  });
  const [autoFilled, setAutoFilled] = useState(false);

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // 輸入店號時，若班表中查得到該店，一併帶入其餘門市欄位
      if (field === '店號') {
        const found = lookupStore(storeMaster, value);
        setAutoFilled(!!found);
        if (found) Object.assign(next, found);
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const shiftText = String(row.午別) === '1' ? '上午' : String(row.午別) === '2' ? '下午' : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-800">
            編輯　{shiftText}　{row.店名 || '未設定門市'}
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
          <StorePreview form={form} storeMaster={storeMaster} autoFilled={autoFilled} />
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

/**
 * 顯示由店號帶出的課別代號與營業課別（這兩欄不直接編輯，隨店號連動）
 */
function StorePreview({ form, storeMaster, autoFilled }) {
  if (!storeMaster || storeMaster.size === 0) return null;
  const known = !!lookupStore(storeMaster, form.店號);
  if (!form.店號) return null;

  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-gray-400">連動欄位</span>
        <Chip label="課別代號" value={form.課別代號} ok={known} />
        <Chip label="營業課別" value={form.營業課別} ok={known} />
      </div>
      {autoFilled && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-teal-600">
          <CornerDownRight size={10} />
          已依店號自動帶入店名、型態、課別與上列欄位
        </p>
      )}
      {!known && (
        <p className="mt-1 text-[11px] text-gray-400">
          此店號不在班表中，連動欄位維持原值，可視需要自行確認。
        </p>
      )}
    </div>
  );
}

function Chip({ label, value, ok }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
        value ? (ok ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-400'
      }`}
    >
      {label} {value || '—'}
    </span>
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
