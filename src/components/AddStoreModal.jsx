import { useState } from 'react';
import { X, CornerDownRight } from 'lucide-react';
import { formatDateLabel } from '../utils/date';
import { lookupStore } from '../utils/storeMaster';

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
    if (!form.店號.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
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
          <Field label="店名" value={form.店名} onChange={update('店名')} />
          <Field label="課別" value={form.課別} onChange={update('課別')} />

          {form.店號 && storeMaster?.size > 0 && (
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-gray-400">連動欄位</span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${form.課別代號 ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                  課別代號 {form.課別代號 || '—'}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${form.營業課別 ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>
                  營業課別 {form.營業課別 || '—'}
                </span>
              </div>
              {autoFilled ? (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-teal-600">
                  <CornerDownRight size={10} />
                  已依店號自動帶入店名、型態、課別與上列欄位
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-gray-400">
                  此店號不在班表中，請自行填寫；連動欄位將留空。
                </p>
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
    </div>
  );
}

function Field({ label, value, onChange, required }) {
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
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
      />
    </div>
  );
}
