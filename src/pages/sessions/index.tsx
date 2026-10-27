import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, X, Clock, DollarSign, Check, Zap, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/router';
import { useToast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';

const CHARGERS = ['GBT', 'CCS2'];
const PAYMENT_METHODS = ['Cash', 'Bank/QR']; // Removed 'Credit' - use isUdaro flag instead
const PAYMENT_STATUSES = ['Paid', 'Pending', 'Partially Paid'];

const statusColor: any = { Paid: 'success', Pending: 'warning', 'Partially Paid': 'info' };

const MANAGE_TABS = [
  { id: 'all', label: 'All', icon: Zap, color: 'slate' },
  { id: 'ongoing', label: 'Ongoing', icon: Clock, color: 'blue' },
  { id: 'pending_payment', label: 'Pending Payment', icon: DollarSign, color: 'yellow' },
  { id: 'completed', label: 'Completed', icon: Check, color: 'green' },
];

export default function Sessions() {
  const router = useRouter();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', vehicleNo: '', chargerType: '', paymentMethod: '', paymentStatus: '' });
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [viewingVehicle, setViewingVehicle] = useState<any>(null);
  const [vehicleHistory, setVehicleHistory] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    vehicleNo: '',
    arrivalSoc: '',
    departureSoc: '',
    ratePerPercent: '',
    chargeAmount: '',
    chargerType: 'GBT',
    paymentMethod: 'Cash',
    paymentStatus: 'Pending',
    companyBrand: '',
    remarks: '',
    creditPaid: '',
    outstanding: '',
    settlementMethod: '',
    settlementDate: '',
    isUdaro: false, // NEW: Settlement (Udaro) flag
    udaroDueDate: '', // NEW: Settlement due date
  });
  const [saving, setSaving] = useState(false);

  // Manage Sessions states - tabs now filter main table
  const [manageTab, setManageTab] = useState('all');
  const [completedPeriod, setCompletedPeriod] = useState('today'); // For future use

  // Vehicle lookup for modal
  const [vehicleInfo, setVehicleInfo] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Tenant settings
  const [tenantSettings, setTenantSettings] = useState<any>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  const headers = { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        page: String(p), 
        limit: '10', // Changed to 10 records per page
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) 
      });
      
      // Add tab filtering
      if (manageTab === 'ongoing') {
        // Ongoing: departureSoc is NULL (still charging)
        params.append('sessionStatus', 'ongoing');
      } else if (manageTab === 'pending_payment') {
        // Pending Payment: filter by payment status, not session status
        params.append('unpaidOnly', 'true'); // Special flag for unpaid/partially paid
      } else if (manageTab === 'completed') {
        // Completed: departureSoc is filled (charging finished)
        params.append('sessionStatus', 'completed');
      }
      // 'all' tab = no session status filter, shows everything
      
      const r = await fetch(`/api/sessions?${params}`, { headers });
      const d = await r.json();
      setSessions(d.sessions || []);
      setTotal(d.total || 0);
      setTotalPages(d.totalPages || 1);
      setPage(p);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, [manageTab]); // Reload when tab changes

  // Fetch tenant settings for live calculation preview
  useEffect(() => {
    fetch('/api/settings', { headers })
      .then(r => r.json())
      .then(d => { if (d.settings) setTenantSettings(d.settings); })
      .catch(() => {});
  }, []);

  // Vehicle lookup when typing vehicle number in Add/Edit modal
  useEffect(() => {
    if (!showAddModal && !showEditModal) {
      setVehicleInfo(null);
      return;
    }
    const v = formData.vehicleNo.trim();
    if (v.length < 1) { setVehicleInfo(null); return; }
    const t = setTimeout(async () => {
      setLookingUp(true);
      try {
        const r = await fetch(`/api/vehicles/lookup?vehicleNo=${encodeURIComponent(v)}`, { headers });
        const d = await r.json();
        setVehicleInfo(d);
      } catch { setVehicleInfo(null); }
      setLookingUp(false);
    }, 400);
    return () => clearTimeout(t);
  }, [formData.vehicleNo, showAddModal, showEditModal]);

  const handleEdit = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    setEditingSession(session);
    setFormData({
      date: String(session.date).slice(0, 10),
      time: session.time || '',
      vehicleNo: session.vehicleNo,
      arrivalSoc: session.arrivalSoc ? String(session.arrivalSoc) : '',
      departureSoc: session.departureSoc ? String(session.departureSoc) : '',
      ratePerPercent: session.ratePerPercent ? String(session.ratePerPercent) : '',
      chargeAmount: session.chargeAmount ? String(session.chargeAmount) : '',
      chargerType: session.chargerType,
      paymentMethod: session.paymentMethod,
      paymentStatus: session.paymentStatus,
      companyBrand: session.companyBrand || '',
      remarks: session.remarks || '',
      creditPaid: session.creditPaid ? String(session.creditPaid) : '0',
      outstanding: session.outstanding ? String(session.outstanding) : '0',
      settlementMethod: session.settlementMethod ? String(session.settlementMethod) : '',
      settlementDate: session.settlementDate ? String(session.settlementDate).slice(0, 10) : '',
      isUdaro: session.isUdaro || false,
      udaroDueDate: session.udaroDueDate ? String(session.udaroDueDate).slice(0, 10) : '',
    });
    setShowEditModal(true);
  };

  const handleAdd = () => {
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      time: new Date().toTimeString().slice(0, 5),
      vehicleNo: '',
      arrivalSoc: '',
      departureSoc: '',
      ratePerPercent: '',
      chargeAmount: '',
      chargerType: 'GBT',
      paymentMethod: 'Cash',
      paymentStatus: 'Pending',
      companyBrand: '',
      remarks: '',
      creditPaid: '',
      outstanding: '',
      settlementMethod: '',
      settlementDate: '',
      isUdaro: false,
      udaroDueDate: '',
    });
    setShowAddModal(true);
  };

  const handleView = async (vehicleNo: string) => {
    setViewingVehicle(vehicleNo);
    setShowViewModal(true);
    setLoadingHistory(true);
    
    try {
      const res = await fetch(`/api/vehicles/${vehicleNo}`, { headers });
      const data = await res.json();
      
      if (res.ok) {
        setVehicleHistory(data);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to load vehicle history",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: "Failed to load vehicle history",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowViewModal(false);
    setEditingSession(null);
    setViewingVehicle(null);
    setVehicleHistory(null);
    setSaving(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only validate if both SOC values are provided
    if (formData.arrivalSoc && formData.departureSoc && Number(formData.departureSoc) <= Number(formData.arrivalSoc)) {
      toast({
        title: "Validation Error",
        description: "Departure SOC must be greater than Arrival SOC",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    try {
      const url = showEditModal ? `/api/sessions/${editingSession.id}` : '/api/sessions';
      const method = showEditModal ? 'PUT' : 'POST';
      
      // Prepare data - convert empty strings to null for optional fields
      const submitData = {
        ...formData,
        arrivalSoc: formData.arrivalSoc || null,
        departureSoc: formData.departureSoc || null,
        ratePerPercent: formData.ratePerPercent || null,
        chargeAmount: formData.chargeAmount || null,
        companyBrand: formData.companyBrand || null,
        remarks: formData.remarks || null,
        creditPaid: formData.creditPaid !== '' ? Number(formData.creditPaid) : null,
        settlementMethod: formData.settlementMethod || null,
        settlementDate: formData.settlementDate || null,
      };
      
      const r = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(submitData),
      });

      const d = await r.json();
      
      if (r.ok) {
        toast({
          title: showEditModal ? "Session Updated" : "Session Created",
          description: showEditModal 
            ? `Successfully updated session for vehicle ${formData.vehicleNo}`
            : `Successfully created session for vehicle ${formData.vehicleNo}`,
          variant: "default",
        });
        closeModals();
        load(page);
      } else {
        toast({
          title: showEditModal ? "Update Failed" : "Create Failed",
          description: d.message || "An error occurred",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sessionId: string, vehicleNo: string) => {
    if (!confirm(`Delete session for vehicle ${vehicleNo}? This action cannot be undone.`)) return;
    
    setDeleting(sessionId);
    try {
      const r = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers,
      });
      
      if (r.ok) {
        toast({
          title: "Session Deleted",
          description: `Successfully deleted session for vehicle ${vehicleNo}`,
          variant: "default",
        });
        load(page); // Reload current page
      } else {
        const d = await r.json();
        toast({
          title: "Delete Failed",
          description: d.message || "Failed to delete session",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  // Live calculation preview
  const liveCalc = (() => {
    if (!formData.arrivalSoc || !formData.departureSoc || !formData.ratePerPercent || !tenantSettings) return null;
    const arrival = parseFloat(formData.arrivalSoc);
    const departure = parseFloat(formData.departureSoc);
    const rate = parseFloat(formData.ratePerPercent);
    if (isNaN(arrival) || isNaN(departure) || isNaN(rate) || departure <= arrival) return null;
    const charged = departure - arrival;
    const amount = charged * rate;
    const electricityRate = parseFloat(tenantSettings.electricityRate) || 17;
    const neaCostRate = parseFloat(tenantSettings.neaCostRate) || 9.35;
    const kwh = amount / electricityRate;
    const cost = kwh * neaCostRate;
    const net = amount - cost;
    return { charged, amount, kwh, cost, net, electricityRate, neaCostRate };
  })();

  return (
    <Layout activeTab="sessions" title="Charging Sessions">
      <Toaster />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Charging Sessions</h2>
          <p className="text-sm text-slate-500 mt-0.5">{total.toLocaleString()} total sessions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/sessions/import')} className="gap-2">
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button size="sm" onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
            + New Session
          </Button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {showEditModal ? 'Edit Charging Session' : 'New Charging Session'}
              </h3>
              <button
                onClick={closeModals}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              {/* Left: Form */}
              <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
                {/* Row 1 - Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Date *</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      required
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Time</Label>
                    <Input
                      type="time"
                      value={formData.time}
                      onChange={e => setFormData({...formData, time: e.target.value})}
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Row 2 - Vehicle */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Vehicle No. *</Label>
                  <div className="relative">
                    <Input
                      value={formData.vehicleNo}
                      onChange={e => setFormData({...formData, vehicleNo: e.target.value})}
                      placeholder="e.g. BA 1 PA 800"
                      required
                      className="h-9"
                    />
                    {lookingUp && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-slate-400" />}
                  </div>
                </div>

                {/* Row 3 - SOC */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Arrival SOC %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.arrivalSoc}
                      onChange={e => setFormData({...formData, arrivalSoc: e.target.value})}
                      placeholder="Optional"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Departure SOC %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.departureSoc}
                      onChange={e => setFormData({...formData, departureSoc: e.target.value})}
                      placeholder="Optional"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Row 4 - Rate & Charge Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Rate Rs/%</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.ratePerPercent}
                      onChange={e => setFormData({...formData, ratePerPercent: e.target.value})}
                      placeholder="Optional"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Charge Amount Rs.</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.chargeAmount}
                      onChange={e => setFormData({...formData, chargeAmount: e.target.value})}
                      placeholder="Or auto-calculated"
                      className="h-9"
                    />
                    <p className="text-xs text-slate-400">Enter manually or auto-calc</p>
                  </div>
                </div>

                {/* Row 5 - Charger & Payment Method */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Charger *</Label>
                    <select
                      value={formData.chargerType}
                      onChange={e => setFormData({...formData, chargerType: e.target.value})}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      {CHARGERS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Payment Method *</Label>
                    <select
                      value={formData.paymentMethod}
                      onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 6 - Payment Status & Company */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Payment Status *</Label>
                    <select
                      value={formData.paymentStatus}
                      onChange={e => setFormData({...formData, paymentStatus: e.target.value})}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    >
                      <option>Pending</option>
                      <option>Paid</option>
                      <option>Partially Paid</option>
                    </select>
                    <p className="text-xs text-slate-400">Default: Pending (Unpaid)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Company/Brand</Label>
                    <Input
                      value={formData.companyBrand}
                      onChange={e => setFormData({...formData, companyBrand: e.target.value})}
                      placeholder="e.g. BYD, Tata"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Row 7 - Remarks */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Remarks</Label>
                  <Input
                    value={formData.remarks}
                    onChange={e => setFormData({...formData, remarks: e.target.value})}
                    placeholder="Optional notes"
                    className="h-9"
                  />
                </div>

                {/* Settlement (Udaro) Section */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isUdaro"
                      checked={formData.isUdaro}
                      onChange={e => setFormData({...formData, isUdaro: e.target.checked})}
                      className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                    />
                    <Label htmlFor="isUdaro" className="text-sm font-semibold text-purple-800 cursor-pointer">
                      Settlement (Udaro) - Credit Arrangement
                    </Label>
                  </div>
                  <p className="text-xs text-purple-600">
                    Check this if customer will pay later according to agreed terms (weekly, monthly, etc.)
                  </p>
                  
                  {formData.isUdaro && (
                    <div className="space-y-2 pt-2 border-t border-purple-200">
                      <Label className="text-sm font-medium text-purple-700">Settlement Due Date</Label>
                      <Input
                        type="date"
                        value={formData.udaroDueDate}
                        onChange={e => setFormData({...formData, udaroDueDate: e.target.value})}
                        className="h-9 border-purple-300"
                        placeholder="When is payment due?"
                      />
                      <p className="text-xs text-purple-500">
                        Set the agreed due date based on vehicle's settlement frequency
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment Status Section (only show in edit mode) */}
                {showEditModal && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-semibold text-green-800 mb-3">Payment Recording</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-700">Credit Paid Rs.</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.creditPaid}
                          onChange={e => {
                            const paid = parseFloat(e.target.value) || 0;
                            const charge = parseFloat(formData.chargeAmount) || parseFloat(String(editingSession?.chargeAmount)) || 0;
                            const remaining = Math.max(0, charge - paid);
                            setFormData({
                              ...formData,
                              creditPaid: e.target.value,
                              outstanding: remaining.toFixed(2),
                              paymentStatus: paid >= charge ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Pending',
                            });
                          }}
                          placeholder="Amount paid so far"
                          className="h-9 border-green-300"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-red-600">Outstanding Rs.</Label>
                        <Input
                          type="number"
                          value={formData.outstanding}
                          readOnly
                          className="h-9 bg-red-50 border-red-200 font-semibold text-red-700"
                        />
                        <p className="text-xs text-slate-400">Auto-calculated</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-700">Settlement Method</Label>
                        <select
                          value={formData.settlementMethod}
                          onChange={e => setFormData({...formData, settlementMethod: e.target.value})}
                          className="h-9 w-full rounded-md border border-green-300 bg-transparent px-3 text-sm"
                        >
                          <option value="">-- Select --</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank/QR">Bank/QR</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-green-700">Settlement Date</Label>
                        <Input
                          type="date"
                          value={formData.settlementDate}
                          onChange={e => setFormData({...formData, settlementDate: e.target.value})}
                          className="h-9 border-green-300"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModals}
                    disabled={saving}
                    className="px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 px-6"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {showEditModal ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      showEditModal ? 'Update Session' : 'Create Session'
                    )}
                  </Button>
                </div>
              </form>

              {/* Right: Sidebar with Vehicle Status & Calculated Values */}
              <div className="space-y-4">
                {/* Vehicle Status Card */}
                <Card className="border-slate-200 bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Vehicle Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!formData.vehicleNo ? (
                      <p className="text-xs text-slate-400">Enter a vehicle number to check status</p>
                    ) : lookingUp ? (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-xs">Looking up...</span>
                      </div>
                    ) : vehicleInfo ? (
                      <div className="space-y-2">
                        <Badge variant={vehicleInfo.isNew ? 'warning' : 'success'} className="text-xs">
                          {vehicleInfo.isNew ? '🆕 NEW VEHICLE' : '✅ EXISTING'}
                        </Badge>
                        {!vehicleInfo.isNew && (
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Previous Visits</span>
                              <span className="font-semibold">{vehicleInfo.visits}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Last Visit</span>
                              <span className="font-semibold">{vehicleInfo.lastVisit}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Last Rate</span>
                              <span className="font-semibold">Rs. {vehicleInfo.lastRate}/%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Total Revenue</span>
                              <span className="font-semibold">Rs. {parseFloat(vehicleInfo.totalAmount).toLocaleString()}</span>
                            </div>
                            {parseFloat(vehicleInfo.totalOutstanding) > 0 && (
                              <div className="flex justify-between text-red-600">
                                <span>Outstanding</span>
                                <span className="font-semibold">Rs. {parseFloat(vehicleInfo.totalOutstanding).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Calculated Values Card */}
                <Card className="border-slate-200 bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Calculated Values</CardTitle>
                    <p className="text-xs text-slate-500">Auto-calculated — read only</p>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {!liveCalc || !tenantSettings ? (
                      <p className="text-slate-400">Fill in SOC and Rate to see calculations</p>
                    ) : (
                      <>
                        <div className="flex justify-between border-b pb-2">
                          <span className="text-slate-500">Charged %</span>
                          <span className="font-bold text-blue-600">{liveCalc.charged.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Charge Amount</span>
                          <span className="font-bold text-green-600">Rs. {liveCalc.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Used kWh</span>
                          <span className="font-medium">{liveCalc.kwh.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Electricity Cost</span>
                          <span className="font-medium text-orange-600">Rs. {liveCalc.cost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-slate-500">Net Contribution</span>
                          <span className="font-bold">Rs. {liveCalc.net.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-slate-400 border-t pt-2 space-y-0.5">
                          <p>Elec. Rate: Rs. {liveCalc.electricityRate}/kWh</p>
                          <p>NEA Cost: Rs. {liveCalc.neaCostRate}/kWh</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Vehicle History Modal */}
      {showViewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
              <div>
                <h3 className="text-lg font-bold">Vehicle History</h3>
                <p className="text-sm text-purple-100">Vehicle No: {viewingVehicle}</p>
              </div>
              <button
                onClick={closeModals}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                </div>
              ) : vehicleHistory ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-600 font-medium">Total Visits</p>
                      <p className="text-2xl font-bold text-blue-900">{vehicleHistory.totalVisits}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-xs text-green-600 font-medium">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-900">Rs. {vehicleHistory.totalRevenue?.toFixed(2)}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <p className="text-xs text-orange-600 font-medium">Total Paid</p>
                      <p className="text-2xl font-bold text-orange-900">Rs. {vehicleHistory.totalPaid?.toFixed(2)}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-xs text-red-600 font-medium">Outstanding</p>
                      <p className="text-2xl font-bold text-red-900">Rs. {vehicleHistory.totalOutstanding?.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Vehicle Info */}
                  <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
                    <h4 className="font-bold text-slate-900 mb-3">Vehicle Information</h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">First Visit</p>
                        <p className="font-medium text-slate-900">{vehicleHistory.firstVisit ? String(vehicleHistory.firstVisit).slice(0, 10) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Last Visit</p>
                        <p className="font-medium text-slate-900">{vehicleHistory.lastVisit ? String(vehicleHistory.lastVisit).slice(0, 10) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Company/Brand</p>
                        <p className="font-medium text-slate-900">{vehicleHistory.companyBrand || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Avg Charge Amount</p>
                        <p className="font-medium text-slate-900">Rs. {vehicleHistory.avgChargeAmount?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Total kWh Used</p>
                        <p className="font-medium text-slate-900">{vehicleHistory.totalKwh?.toFixed(2) || '0.00'} kWh</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Payment Status</p>
                        <Badge variant={vehicleHistory.totalOutstanding > 0 ? 'warning' : 'success'} className="text-xs">
                          {vehicleHistory.totalOutstanding > 0 ? 'Has Outstanding' : 'All Settled'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Recent Sessions */}
                  <div>
                    <h4 className="font-bold text-slate-900 mb-3">Recent Sessions</h4>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200">
                            <th className="px-3 py-2 text-left text-xs font-semibold">Date</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold">Charge Amount</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold">Credit Paid</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold">Outstanding</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold">Status</th>
                            <th className="px-3 py-2 text-center text-xs font-semibold">Settlement Method</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vehicleHistory.sessions?.map((session: any) => (
                            <tr key={session.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2 text-slate-700">{String(session.date).slice(0, 10)}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900">Rs. {parseFloat(session.chargeAmount).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right text-slate-700">Rs. {parseFloat(session.creditPaid || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-medium text-red-600">Rs. {parseFloat(session.outstanding || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant={statusColor[session.paymentStatus] || 'default'} className="text-xs">
                                  {session.paymentStatus}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600">{session.settlementMethod || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  No data available
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end rounded-b-lg">
              <Button onClick={closeModals} variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Session Tabs - Filter Main Table */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {MANAGE_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = manageTab === tab.id;
            const colorMap: any = {
              slate: isActive ? 'bg-slate-100 border-slate-400 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
              blue: isActive ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
              yellow: isActive ? 'bg-yellow-50 border-yellow-400 text-yellow-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
              green: isActive ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
            };
            return (
              <button
                key={tab.id}
                onClick={() => setManageTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${colorMap[tab.color]}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 bg-white mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Input type="date" placeholder="Start date" value={filters.startDate}
              onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
            <Input type="date" placeholder="End date" value={filters.endDate}
              onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
            <Input placeholder="Vehicle No." value={filters.vehicleNo}
              onChange={e => setFilters(f => ({ ...f, vehicleNo: e.target.value }))} />
            <select value={filters.chargerType} onChange={e => setFilters(f => ({ ...f, chargerType: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="">All Chargers</option>
              <option>GBT</option><option>CCS2</option>
            </select>
            <select value={filters.paymentMethod} onChange={e => setFilters(f => ({ ...f, paymentMethod: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
              <option value="">All Methods</option>
              <option>Cash</option><option>Bank/QR</option><option>Credit</option>
            </select>
            <Button onClick={() => load(1)} className="bg-blue-600 hover:bg-blue-700">Filter</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-blue-900 text-white">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Time</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Vehicle No.</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Arrival SOC %</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Departure SOC %</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Charged %</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Rate Rs/%</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Charge Amount Rs.</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Visit No.</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Charger</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Payment Method</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Payment Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Operator</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Remarks</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Used kWh</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap">Electricity Rate</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Electricity Cost Rs.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Net Contribution Rs.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Credit Paid Rs.</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Udaro/Outstanding Rs.</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Settlement Method</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Settlement Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Company/ Brand</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap sticky right-0 bg-blue-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={24} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan={24} className="py-12 text-center text-slate-400 text-sm">No sessions found</td></tr>
                ) : sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">{String(s.date).slice(0, 10)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.time || '—'}</td>
                    <td className="px-3 py-2 text-xs font-bold text-slate-900">{s.vehicleNo}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-700">{s.arrivalSoc ? parseFloat(s.arrivalSoc).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-700">{s.departureSoc ? parseFloat(s.departureSoc).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-center font-medium text-slate-900">{s.chargedPercent ? parseFloat(s.chargedPercent).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-700">{s.ratePerPercent ? parseFloat(s.ratePerPercent).toFixed(2) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold text-slate-900">{parseFloat(s.chargeAmount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-600">{s.visitNo}</td>
                    <td className="px-3 py-2 text-xs text-center">
                      <Badge variant={s.chargerType === 'GBT' ? 'default' : 'info'} className="text-xs">{s.chargerType}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-center text-slate-700">{s.paymentMethod}</td>
                    <td className="px-3 py-2 text-xs text-center">
                      <Badge variant={statusColor[s.paymentStatus] || 'default'} className="text-xs">{s.paymentStatus}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.operator || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-[150px] truncate">{s.remarks || '—'}</td>
                    <td className="px-3 py-2 text-xs text-right text-slate-700">{parseFloat(s.usedKwh || 0).toFixed(3)}</td>
                    <td className="px-3 py-2 text-xs text-center text-slate-600">{parseFloat(s.electricityRate || 0).toFixed(0)}</td>
                    <td className="px-3 py-2 text-xs text-right text-orange-700">{parseFloat(s.electricityCost || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right font-medium text-green-700">{parseFloat(s.netContribution || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right text-slate-700">{parseFloat(s.creditPaid || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right font-medium text-red-600">
                      {(() => {
                        const outstanding = parseFloat(String(s.outstanding));
                        const chargeAmount = parseFloat(String(s.chargeAmount)) || 0;
                        const creditPaid = parseFloat(String(s.creditPaid)) || 0;
                        const actualOutstanding = (!isNaN(outstanding) && outstanding !== null) 
                          ? outstanding 
                          : (chargeAmount - creditPaid);
                        return actualOutstanding > 0 ? actualOutstanding.toFixed(2) : '0.00';
                      })()}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.settlementMethod || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.settlementDate ? String(s.settlementDate).slice(0, 10) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{s.companyBrand || '—'}</td>
                    <td className="px-3 py-2 sticky right-0 bg-white">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          onClick={() => handleView(s.vehicleNo)}
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300"
                        >
                          View
                        </Button>
                        <Button
                          onClick={() => handleEdit(s.id)}
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(s.id, s.vehicleNo)}
                          disabled={deleting === s.id}
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                        >
                          {deleting === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <p className="text-sm text-slate-500">
                Showing {((page - 1) * 10) + 1}-{Math.min(page * 10, total)} of {total.toLocaleString()} sessions
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
