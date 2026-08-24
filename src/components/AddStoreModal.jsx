import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CornerDownRight } from 'lucide-react';
import { formatDateLabel } from '../utils/date';
import { lookupStore, buildNameIndex, lookupStoreByName } from '../utils/storeMaster';

export default function AddStoreModal({
  onClose,
  onSave,
  dates = [],
  defaultDate = '',
  storeMaster,
}) {
  const [form, setForm] = useState({
    店號: '',
    店名: '',
    型態: '',
    課別: '',
    課別代號: '',
    營業課別: '',
    _date: defaultDate, // 指定日期；空字串代表不限日期
  });
  const [autoFilled, setAutoFilled] = useState('');

  const nameIndex = useMemo(() => buildNameIndex(storeMaster), [storeMaster]);

  const update = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // 輸入店號 -> 帶入其餘欄位
      if (field === '店號') {
        const found = lookupStore(storeMaster, value);
        setAutoFilled(found ? '店號' : '');
        if (found) Object.assign(next, found);
      }
      // 輸入店名 -> 反查店號並帶入其餘欄位（記不得店號時使用）
      if (field === '店名') {
        const found = lookupStoreByName(nameIndex, value);
        setAutoFilled(found ? '店名' : '');
        if (found) Object.assign(next, found);
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.店號.trim()) return;
    onSave(form);
  };

  const linked = !!form.課別代號 || !!form.營業課別;

  // 以 portal 掛到 body，避免被側邊面板的 sticky／overflow 裁切
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <h3 className="text-base font-semibold text-gray-800">新增店（暫存區）</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="店號" value={form.店號} onChange={update('店號')} required />
            <Field label="型態" value={form.型態} onChange={update('型態')} />
          </div>

          <Field
            label="店名"
            value={form.店名}
            onChange={update('店名')}
            list="store-name-options"
            hint="記不得店號時，直接打店名即可自動帶入"
          />
          <datalist id="store-name-options">
            {[...nameIndex.keys()].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <Field label="課別" value={form.課別} onChange={update('課別')} />

          {(form.店號 || form.店名) && storeMaster?.size > 0 && (
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-gray-400">連動欄位</span>
                <Chip label="課別代號" value={form.課別代號} />
                <Chip label="營業課別" value={form.營業課別} />
              </div>
              {autoFilled ? (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-teal-600">
                  <CornerDownRight size={10} />
                  已依{autoFilled}自動帶入其餘欄位
                </p>
              ) : (
                !linked && (
                  <p className="mt-1 text-[11px] text-gray-400">
                    此門市不在班表中，請自行填寫；連動欄位將留空。
                  </p>
                )
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              指定日期
            </label>
            <select
              value={form._date}
              onChange={update('_date')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
            >
              <option value="">不限日期（任何日期都可放）</option>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {formatDateLabel(d)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">
              指定後只能拖曳到該日期的槽位，其他日期會擋下。
            </p>
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
              加入暫存區
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function Chip({ label, value }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
        value ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {label} {value || '—'}
    </span>
  );
}

function Field({ label, value, onChange, required, list, hint }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        required={required}
        list={list}
        autoComplete="off"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
      />
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}
