import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function TrackTugas() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [tasksCount, setTasksCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tData } = await supabase.from('tasks').select('id', { count: 'exact' }).eq('is_active', true);
      const tCount = tData?.length || 0;
      setTasksCount(tCount);

      const { data: pData } = await supabase.from('participants').select('*, classes(name), cities(name)');
      
      const { data: sData } = await supabase.from('participant_task_status').select('participant_id, task_id');
      
      // We also should count submissions for "finished" logic to match what ParticipantDetail does
      const { data: subsData } = await supabase.from('submissions').select('id, leader_id, task_id');
      const { data: subMemsData } = await supabase.from('submission_members').select('participant_id, submission_id');

      if (pData) {
        const counts: Record<string, Set<string>> = {};
        
        // initialize sets
        pData.forEach(p => counts[p.id] = new Set());

        // from status
        sData?.forEach(s => {
          if (counts[s.participant_id]) counts[s.participant_id].add(s.task_id);
        });

        // from leader submissions
        const subMap = new Map();
        subsData?.forEach(sub => {
          subMap.set(sub.id, sub.task_id);
          if (counts[sub.leader_id]) counts[sub.leader_id].add(sub.task_id);
        });

        // from member submissions
        subMemsData?.forEach(sm => {
          const tId = subMap.get(sm.submission_id);
          if (tId && counts[sm.participant_id]) {
            counts[sm.participant_id].add(tId);
          }
        });

        const merged = pData.map(p => {
          const finished = counts[p.id].size;
          return {
            ...p,
            finished,
            progress: tCount > 0 ? Math.round((finished / tCount) * 100) : 0
          };
        });
        
        merged.sort((a, b) => b.progress - a.progress);
        setParticipants(merged);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const { data: tasks } = await supabase.from('tasks').select('*').eq('is_active', true).order('created_at');
      const { data: parts } = await supabase.from('participants').select('*, classes(name), cities(name)').order('name');
      const { data: submissions } = await supabase.from('submissions').select('*');
      const { data: submissionMembers } = await supabase.from('submission_members').select('*');

      if (!tasks || !parts) {
        alert("Gagal mengambil data untuk export");
        return;
      }

      const subMap = new Map();
      submissions?.forEach(sub => subMap.set(sub.id, sub));

      const pTaskLinks = new Map();

      submissions?.forEach(sub => {
        const pId = sub.leader_id;
        const tId = sub.task_id;
        if (!pTaskLinks.has(pId)) pTaskLinks.set(pId, {});
        pTaskLinks.get(pId)[tId] = sub.file_url;
      });

      submissionMembers?.forEach(sm => {
        const pId = sm.participant_id;
        const sub = subMap.get(sm.submission_id);
        if (sub) {
            const tId = sub.task_id;
            if (!pTaskLinks.has(pId)) pTaskLinks.set(pId, {});
            pTaskLinks.get(pId)[tId] = sub.file_url;
        }
      });

      const headers = ["Nama Peserta", "Kelas", "Kab/Kota"];
      tasks.forEach(t => headers.push(`Tugas: ${t.title}`));
      
      const wsData = [headers];

      parts.forEach(p => {
        const row = [
          p.name,
          p.classes?.name || '-',
          p.cities?.name || '-'
        ];

        const pLinks = pTaskLinks.get(p.id) || {};
        
        tasks.forEach(t => {
          row.push(pLinks[t.id] || "Belum");
        });

        wsData.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Auto-size columns to be wider
      const wscols = [
        { wch: 30 }, // Nama 
        { wch: 25 }, // Kelas
        { wch: 20 }, // Kota
      ];
      tasks.forEach(() => wscols.push({ wch: 40 })); // Task URLs
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Pengumpulan Lengkap");
      XLSX.writeFile(wb, "Rekap_Monitoring_Peserta_Dan_Tugas.xlsx");

    } catch (err: any) {
      alert("Error exporting: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const filtered = participants.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.classes?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cities?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-xl">
        <div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-xs">Monitoring Peserta</h3>
          <p className="text-body-md text-on-surface-variant">Real-time academic progress and assignment tracking across all regions. Total {tasksCount} tugas aktif.</p>
        </div>
        <div>
          <button 
            onClick={handleExportAll}
            disabled={exporting}
            className="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
          >
            {exporting ? (
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">download</span>
            )}
            {exporting ? 'Mengekspor...' : 'Export Data Lengkap'}
          </button>
        </div>
      </div>

      <section className="bg-surface border border-outline-variant rounded-2xl p-lg mb-lg shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)] flex flex-wrap gap-4 items-end">

        <div className="flex-1 min-w-[240px]">
          <label className="font-label-md text-label-md text-on-surface-variant mb-2 block">Search Participant</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">person_search</span>
            <input 
              type="text" 
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
              placeholder="Search by name, class, city..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="bg-surface border border-outline-variant rounded-2xl overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-lg py-4 font-label-md text-label-md text-outline uppercase tracking-wider">Nama Peserta</th>
                <th className="px-lg py-4 font-label-md text-label-md text-outline uppercase tracking-wider">Kelas</th>
                <th className="px-lg py-4 font-label-md text-label-md text-outline uppercase tracking-wider">Kota</th>
                <th className="px-lg py-4 font-label-md text-label-md text-outline uppercase tracking-wider text-center">Tugas</th>
                <th className="px-lg py-4 font-label-md text-label-md text-outline uppercase tracking-wider text-center">Selesai</th>
                <th className="px-lg py-4 font-label-md text-label-md text-outline uppercase tracking-wider text-center">Belum</th>
                <th className="px-lg py-4 font-label-md text-label-md text-outline uppercase tracking-wider min-w-[200px]">Progress %</th>
                <th className="px-lg py-4 font-label-md text-label-md text-outline uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-lg py-8 text-center text-on-surface-variant">Loading data...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-lg py-8 text-center text-on-surface-variant">Data tidak ditemukan.</td>
                </tr>
              ) : (
                filtered.map(p => {
                  let progressColor = 'bg-primary-container';
                  let textColor = 'text-primary';
                  let badgeBg = 'bg-primary/10';
                  
                  if (p.progress < 25) {
                    progressColor = 'bg-error'; textColor = 'text-error'; badgeBg = 'bg-error/10';
                  } else if (p.progress < 50) {
                    progressColor = 'bg-amber-500'; textColor = 'text-amber-600'; badgeBg = 'bg-amber-100';
                  } else if (p.progress === 100) {
                    progressColor = 'bg-emerald-500'; textColor = 'text-emerald-600'; badgeBg = 'bg-emerald-100';
                  }

                  return (
                    <tr key={p.id} className="hover:bg-surface-container-low transition-colors group">
                      <td className="px-lg py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${badgeBg} ${textColor} flex items-center justify-center font-bold text-[12px]`}>
                            {p.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-body-md text-body-md font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-lg py-4 text-body-md text-on-surface-variant">{p.classes?.name || '-'}</td>
                      <td className="px-lg py-4 text-body-md text-on-surface-variant">{p.cities?.name || '-'}</td>
                      <td className="px-lg py-4 text-center font-code text-code">{tasksCount}</td>
                      <td className="px-lg py-4 text-center font-code text-code">{p.finished}</td>
                      <td className={`px-lg py-4 text-center font-code text-code ${p.progress < 50 ? 'text-error' : ''}`}>
                        {Math.max(0, tasksCount - p.finished)}
                      </td>
                      <td className="px-lg py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 bg-surface-container-high h-2 rounded-full overflow-hidden">
                            <div className={`${progressColor} h-full rounded-full transition-all duration-500`} style={{ width: `${p.progress}%` }}></div>
                          </div>
                          <span className={`font-code text-code font-bold ${textColor}`}>{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-lg py-4 text-right">
                        <Link to={`/admin/track/participant/${p.id}`} className="p-2 inline-flex items-center justify-center hover:bg-surface-container-high rounded-full transition-colors text-outline group-hover:text-primary">
                          <span className="material-symbols-outlined">visibility</span>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
