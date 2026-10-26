import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function VehicleDetail() {
  const router = useRouter();
  const { vehicleNo } = router.query;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    if (!vehicleNo) return;
    fetch(`/api/vehicles/${encodeURIComponent(String(vehicleNo))}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [vehicleNo]);

  if (loading) return <Layout activeTab="vehicles" title="Vehicle"><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div></Layout>;
  if (!data?.vehicle) return <Layout activeTab="vehicles" title="Vehicle"><p className="text-center py-20 text-slate-500">Vehicle not found</p></Layout>;

  const { vehicle, sessions } = data;
  const totals = { amount: sessions.reduce((s: number, x: any) => s + parseFloat(x.chargeAmount), 0), outstanding: sessions.reduce((s: number, x: any) => s + parseFloat(x.outstanding || 0), 0) };

  return (
    <Layout activeTab="vehicles" title={`Vehicle ${vehicle.vehicleNo}`}>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 text-slate-600 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h2 className="text-xl font-bold text-slate-900">Vehicle {vehicle.vehicleNo}</h2>
        {vehicle.companyBrand && <p className="text-sm text-slate-500">{vehicle.companyBrand}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Visits', value: vehicle.totalVisits },
          { label: 'Total Charged', value: `${parseFloat(vehicle.totalCharged).toFixed(0)}%` },
          { label: 'Total Revenue', value: `Rs. ${parseFloat(vehicle.totalRevenue).toLocaleString()}` },
          { label: 'Outstanding', value: `Rs. ${parseFloat(vehicle.totalOutstanding).toLocaleString()}`, red: parseFloat(vehicle.totalOutstanding) > 0 },
          { label: 'Last Rate', value: `Rs. ${vehicle.lastRate}/%` },
        ].map(stat => (
          <Card key={stat.label} className="border-slate-200 bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className={`text-lg font-bold mt-1 ${stat.red ? 'text-red-600' : 'text-slate-900'}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Session History */}
      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-3"><CardTitle className="text-base">Session History ({sessions.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['#', 'Date', 'Arrival', 'Departure', 'Charged%', 'Rate', 'Amount Rs.', 'Charger', 'Method', 'Status', 'Outstanding Rs.'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any, i: number) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5 text-sm whitespace-nowrap">{String(s.date).slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-sm">{s.arrivalSoc}%</td>
                    <td className="px-4 py-2.5 text-sm">{s.departureSoc}%</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-blue-600">{parseFloat(s.chargedPercent).toFixed(0)}%</td>
                    <td className="px-4 py-2.5 text-sm">{s.ratePerPercent}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-green-700">Rs. {parseFloat(s.chargeAmount).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-sm"><Badge variant="info" className="text-xs">{s.chargerType}</Badge></td>
                    <td className="px-4 py-2.5 text-sm">{s.paymentMethod}</td>
                    <td className="px-4 py-2.5 text-sm"><Badge variant={s.paymentStatus === 'Paid' ? 'success' : 'warning'} className="text-xs">{s.paymentStatus}</Badge></td>
                    <td className="px-4 py-2.5 text-sm text-red-600">{parseFloat(s.outstanding || 0) > 0 ? `Rs. ${parseFloat(s.outstanding).toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={6} className="px-4 py-2.5 text-sm">Totals</td>
                  <td className="px-4 py-2.5 text-sm text-green-700">Rs. {totals.amount.toLocaleString()}</td>
                  <td colSpan={3}></td>
                  <td className="px-4 py-2.5 text-sm text-red-600">{totals.outstanding > 0 ? `Rs. ${totals.outstanding.toLocaleString()}` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
