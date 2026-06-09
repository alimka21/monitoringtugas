import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

export default function Dashboard() {
  const [stats, setStats] = useState({
    participants: 0,
    tasks: 0,
    submissions: 0,
    classes: 0,
    cities: 0,
  });
  
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [pRes, tRes, sRes, cRes, cityRes] = await Promise.all([
        supabase.from('participants').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('submissions').select('id', { count: 'exact', head: true }),
        supabase.from('classes').select('id', { count: 'exact', head: true }),
        supabase.from('cities').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        participants: pRes.count || 0,
        tasks: tRes.count || 0,
        submissions: sRes.count || 0,
        classes: cRes.count || 0,
        cities: cityRes.count || 0,
      });

      // Fetch class completion stats
      const { data: classesData } = await supabase.from('classes').select('id, name');
      if (classesData) {
        const { data: allParticipants } = await supabase.from('participants').select('id, class_id');
        const pCounts: Record<string, number> = {}; // class_id -> total participants
        const classOfParticipant: Record<string, string> = {}; // participant_id -> class_id
        
        allParticipants?.forEach(p => {
            pCounts[p.class_id] = (pCounts[p.class_id] || 0) + 1;
            classOfParticipant[p.id] = p.class_id;
        });

        const { data: statusData } = await supabase.from('participant_task_status').select('participant_id');
        
        const completedParticipantsPerClass: Record<string, Set<string>> = {}; // class_id -> Set of participant_ids who completed something
        
        statusData?.forEach(s => {
          const cId = classOfParticipant[s.participant_id];
          if (cId) {
            if (!completedParticipantsPerClass[cId]) completedParticipantsPerClass[cId] = new Set();
            completedParticipantsPerClass[cId].add(s.participant_id);
          }
        });

        const cData = classesData.map(c => {
          const totalP = pCounts[c.id] || 0;
          const selesai = completedParticipantsPerClass[c.id]?.size || 0;
          return {
            name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
            Selesai: selesai,
            Belum: Math.max(0, totalP - selesai)
          };
        });
        
        setChartData(cData);
      }

    } catch (e) {
      console.error(e);
    }
  };

  const exportData = () => {
    const wsData = [
      ["Kelas", "Total Selesai", "Total Belum"],
      ...chartData.map(c => [
        c.name,
        c.Selesai,
        c.Belum
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Pengumpulan Kelas");
    XLSX.writeFile(wb, "Rekap_Dashboard.xlsx");
  };

  const avgCompletion = stats.participants > 0 
    ? Math.round((chartData.reduce((acc, curr) => acc + curr.Selesai, 0) / stats.participants) * 100) 
    : 0;

  return (
    <div className="space-y-lg">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-lg">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Dashboard Overview</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Monitor program health and participant engagement in real-time.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface-variant font-label-md text-label-md hover:bg-surface-container transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            {new Date().toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })}
          </button>
          <button onClick={exportData} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md shadow-sm hover:shadow-md transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Report
          </button>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-secondary-container text-primary rounded-lg">
              <span className="material-symbols-outlined">group</span>
            </div>
            <span className="flex items-center text-emerald-600 font-label-md text-label-md bg-emerald-50 px-2 py-1 rounded-full">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
            </span>
          </div>
          <h3 className="font-label-md text-label-md text-on-surface-variant mb-1">Total Peserta</h3>
          <p className="font-headline-md text-headline-md text-on-surface font-bold">{stats.participants}</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-tertiary-fixed text-tertiary rounded-lg">
              <span className="material-symbols-outlined">assignment</span>
            </div>
            <span className="font-label-md text-label-md text-on-surface-variant">Active Tasks</span>
          </div>
          <h3 className="font-label-md text-label-md text-on-surface-variant mb-1">Total Tugas</h3>
          <p className="font-headline-md text-headline-md text-on-surface font-bold">{stats.tasks}</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-primary-fixed text-primary rounded-lg">
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <span className="flex items-center text-emerald-600 font-label-md text-label-md bg-emerald-50 px-2 py-1 rounded-full">
              <span className="material-symbols-outlined text-[16px]">add</span>
            </span>
          </div>
          <h3 className="font-label-md text-label-md text-on-surface-variant mb-1">Total Submission</h3>
          <p className="font-headline-md text-headline-md text-on-surface font-bold">{stats.submissions}</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-secondary-container text-secondary rounded-lg">
              <span className="material-symbols-outlined">speed</span>
            </div>
          </div>
          <h3 className="font-label-md text-label-md text-on-surface-variant mb-1">Completion Rate</h3>
          <div className="flex items-end gap-2">
            <p className="font-headline-md text-headline-md text-on-surface font-bold">{avgCompletion}%</p>
            <div className="flex-1 h-2 bg-surface-container rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${avgCompletion}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">bar_chart</span>
              <h3 className="font-title-lg text-title-lg text-on-surface">Upload Tugas per Kelas/Materi</h3>
            </div>
          </div>
          <div className="h-[300px] w-full mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="99%" height={300}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} fill="#777587" />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} fill="#777587" />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  <Bar dataKey="Selesai" stackId="a" fill="#3525cd" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Belum" stackId="a" fill="#e2dfff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400">
                Memuat data grafik...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
