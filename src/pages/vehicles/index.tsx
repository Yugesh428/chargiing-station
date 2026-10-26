import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function Vehicles() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    fetch('/api/vehicles', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setVehicles(d.vehicles || []); setFiltered(d.vehicles || []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search) { setFiltered(vehicles); return; }
    setFiltered(vehicles.filter((v: any) => v.vehicleNo?.toLowerCase().includes(search.toLowerCase()) || v.companyBrand?.toLowerCase().includes(search.toLowerCase())));
  }, [search, vehicles]);

  return (
    <Layout activeTab="vehicles" title="Vehicle Master">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Vehicle Master</h2>
          <p className="text-sm text-slate-500 mt-0.5">{vehicles.length} unique vehicles</p>
        </div>
        <Input placeholder="Search vehicle no. or brand..." value={search}
          onChange={e => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <Card className="border-slate-200 bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Vehicle No.', 'Brand', 'First Visit', 'Last Visit', 'Visits', 'Charged%', 'Revenue Rs.', 'Avg Rate', 'Last Rate', 'Outstanding Rs.', 'Net Contribution Rs.'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={11} className="py-12 text-center text-slate-400 text-sm">No vehicles found</td></tr>
                ) : filtered.map((v: any) => (
                  <tr key={v.vehicleNo} onClick={() => router.push(`/vehicles/${encodeURIComponent(v.vehicleNo)}`)}
                    className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5 text-sm font-bold text-blue-700">{v.vehicleNo}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-600">{v.companyBrand || '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-600 whitespace-nowrap">{String(v.firstVisit).slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-600 whitespace-nowrap">{String(v.lastVisit).slice(0, 10)}</td>
                    <td className="px-4 py-2.5 text-sm font-medium">{v.totalVisits}</td>
                    <td className="px-4 py-2.5 text-sm">{parseFloat(v.totalCharged).toFixed(0)}%</td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-green-700">Rs. {parseFloat(v.totalRevenue).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-sm">{parseFloat(v.avgRate).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-sm">{v.lastRate}</td>
                    <td className="px-4 py-2.5 text-sm font-medium text-red-600">{parseFloat(v.totalOutstanding) > 0 ? `Rs. ${parseFloat(v.totalOutstanding).toLocaleString()}` : '—'}</td>
                    <td className="px-4 py-2.5 text-sm font-medium">Rs. {parseFloat(v.netContribution).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
