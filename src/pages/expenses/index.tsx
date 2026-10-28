import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Receipt, AlertTriangle, Download } from 'lucide-react';

interface Expense {
  id: string;
  date: string;
  expenseType: string;
  description: string;
  paymentMethod: string;
  amount: number;
  paidTo?: string;
  voucherRef?: string;
  remarks?: string;
}

const EXPENSE_TYPES = [
  'Staff Salary', 'Rent', 'Electricity', 'Internet', 'Maintenance',
  'Equipment', 'Fuel', 'Stationery', 'Marketing', 'Transport', 'Other',
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [savingForm, setSavingForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [fType, setFType] = useState('Other');
  const [fDescription, setFDescription] = useState('');
  const [fMethod, setFMethod] = useState('Cash');
  const [fAmount, setFAmount] = useState('');
  const [fPaidTo, setFPaidTo] = useState('');
  const [fVoucherRef, setFVoucherRef] = useState('');
  const [fRemarks, setFRemarks] = useState('');

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ limit: '100' });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/expenses?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        const total = parseFloat(data.total);
        setTotalAmount(isNaN(total) ? 0 : total);
      }
    } finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!fDate || !fType || !fDescription || !fMethod || !fAmount) {
      setFormError('Please fill in all required fields');
      return;
    }
    setSavingForm(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          date: fDate,
          expenseType: fType,
          description: fDescription,
          paymentMethod: fMethod,
          amount: Number(fAmount),
          paidTo: fPaidTo || undefined,
          voucherRef: fVoucherRef || undefined,
          remarks: fRemarks || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message);
      }
      setToast('Expense added!');
      setTimeout(() => setToast(''), 3000);
      setFDescription('');
      setFAmount('');
      setFPaidTo('');
      setFVoucherRef('');
      setFRemarks('');
      fetchExpenses();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense');
    } finally { setSavingForm(false); }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 4000);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setToast('Expense deleted.');
        setTimeout(() => setToast(''), 3000);
        setDeleteConfirm(null);
        fetchExpenses();
      }
    } catch {
      // ignore
    }
  };

  // ── Export Functions ──────────────────────────────────────────────────────
  const exportExpenses = async (format: 'csv' | 'excel') => {
    setExporting(format);
    try {
      if (!expenses.length) {
        setToast('No expenses to export');
        setTimeout(() => setToast(''), 3000);
        return;
      }

      const headers = ['Date', 'Type', 'Description', 'Method', 'Amount (Rs)', 'Paid To', 'Voucher Ref', 'Remarks'];
      const rows = expenses.map(e => [
        String(e.date).split('T')[0],
        e.expenseType,
        e.description,
        e.paymentMethod,
        Number(e.amount).toFixed(2),
        e.paidTo || '',
        e.voucherRef || '',
        e.remarks || '',
      ]);

      const dateRange = startDate && endDate ? `_${startDate}_to_${endDate}` : startDate ? `_from_${startDate}` : '';
      const filename = `Expenses${dateRange}`;

      if (format === 'csv') {
        const escape = (v: any) => {
          if (v === null || v === undefined) return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}.csv`; a.click();
        URL.revokeObjectURL(url);
        setToast(`CSV exported — ${expenses.length} expenses`);
        setTimeout(() => setToast(''), 3000);
      } else {
        const XLSX = (await import('xlsx')).default || await import('xlsx');
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
        XLSX.writeFile(wb, `${filename}.xlsx`);
        setToast(`Excel exported — ${expenses.length} expenses`);
        setTimeout(() => setToast(''), 3000);
      }
    } catch (err: any) {
      setFormError(`Export failed: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <Layout activeTab="expenses" title="Expenses">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-green-600 text-white px-4 py-3 shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Expenses</h2>
          <p className="text-sm text-slate-500 mt-0.5">Track all station expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportExpenses('csv')}
            disabled={exporting === 'csv' || !expenses.length}
            className="gap-1.5"
          >
            {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportExpenses('excel')}
            disabled={exporting === 'excel' || !expenses.length}
            className="gap-1.5"
          >
            {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Expense Form */}
        <div className="lg:col-span-1">
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-800">Add Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Date *</Label>
                  <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="h-8 text-sm border-slate-300" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Expense Type *</Label>
                  <select
                    value={fType}
                    onChange={(e) => setFType(e.target.value)}
                    className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {EXPENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Description *</Label>
                  <Input
                    type="text"
                    placeholder="Brief description"
                    value={fDescription}
                    onChange={(e) => setFDescription(e.target.value)}
                    className="h-8 text-sm border-slate-300"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Method *</Label>
                    <select
                      value={fMethod}
                      onChange={(e) => setFMethod(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank/QR">Bank/QR</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Credit">Credit</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Amount Rs. *</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0.00"
                      value={fAmount}
                      onChange={(e) => setFAmount(e.target.value)}
                      className="h-8 text-sm border-slate-300"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Paid To</Label>
                  <Input type="text" placeholder="Vendor / person" value={fPaidTo} onChange={(e) => setFPaidTo(e.target.value)} className="h-8 text-sm border-slate-300" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Voucher Ref.</Label>
                    <Input type="text" placeholder="Ref #" value={fVoucherRef} onChange={(e) => setFVoucherRef(e.target.value)} className="h-8 text-sm border-slate-300" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600">Remarks</Label>
                    <Input type="text" placeholder="Optional" value={fRemarks} onChange={(e) => setFRemarks(e.target.value)} className="h-8 text-sm border-slate-300" />
                  </div>
                </div>
                {formError && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3 w-3" /> {formError}
                  </div>
                )}
                <Button type="submit" disabled={savingForm} className="w-full bg-blue-600 hover:bg-blue-700 h-8 text-sm">
                  {savingForm && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                  Add Expense
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Expense List */}
        <div className="lg:col-span-2">
          {/* Filter bar */}
          <div className="flex items-end gap-3 mb-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-36 text-sm border-slate-300" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-36 text-sm border-slate-300" />
            </div>
            <Button size="sm" variant="outline" onClick={() => { setStartDate(''); setEndDate(''); }} className="h-8 text-xs">
              Clear
            </Button>
            <div className="ml-auto">
              <span className="text-sm font-semibold text-slate-700">
                Total: <span className="text-red-600">Rs. {(isNaN(totalAmount) ? 0 : totalAmount).toLocaleString()}</span>
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Receipt className="h-8 w-8 mb-2 text-slate-300" />
                <p className="text-sm">No expenses found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Date', 'Type', 'Description', 'Method', 'Amount Rs.', 'Paid To', 'Ref.', ''].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{String(e.date).split('T')[0]}</td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{e.expenseType}</td>
                        <td className="px-3 py-2.5 text-slate-700">{e.description}</td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{e.paymentMethod}</td>
                        <td className="px-3 py-2.5 font-semibold text-red-600 whitespace-nowrap">{Number(e.amount).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-slate-500">{e.paidTo || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-400 text-xs">{e.voucherRef || '—'}</td>
                        <td className="px-3 py-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(e.id)}
                            className={`h-7 w-7 p-0 ${deleteConfirm === e.id ? 'text-red-600 bg-red-50' : 'text-slate-400 hover:text-red-600'}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {deleteConfirm && (
            <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Click the delete button again to confirm deletion.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
