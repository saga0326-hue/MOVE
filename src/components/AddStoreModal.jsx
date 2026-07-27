import { useState } from 'react';
import { X } from 'lucide-react';

export default function AddStoreModal({ onClose, onSave }) {
  const [form, setForm] = useState({ 店號: '', 店名: '', 型態: '', 課別: '' });

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

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
