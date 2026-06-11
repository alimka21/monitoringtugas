import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function LandingPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  
  const [participants, setParticipants] = useState<any[]>([]);
  const [tasksCount, setTasksCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    const { data } = await supabase.from('activities').select('*').order('name');
    if (data && data.length > 0) {
      setActivities(data);
      setSelectedActivity(data[0].id);
    }
  };

  useEffect(() => {
    if (selectedActivity) {
      fetchClasses(selectedActivity);
      fetchDashboardData(selectedActivity, selectedClass);
    } else {
      setClasses([]);
      setParticipants([]);
    }
  }, [selectedActivity]);

  useEffect(() => {
    if (selectedActivity) {
      fetchDashboardData(selectedActivity, selectedClass);
    }
  }, [selectedClass]);

  const fetchClasses = async (actId: string) => {
    const { data } = await supabase.from('classes').select('*').eq('activity_id', actId).order('name');
    setClasses(data || []);
  };

  const fetchDashboardData = async (actId: string, clsId: string) => {
    setLoading(true);
    try {
      const { data: tData } = await supabase.from('tasks').select('id').eq('activity_id', actId).eq('is_active', true);
      const tCount = tData?.length || 0;
      setTasksCount(tCount);

      let pQuery = supabase.from('participants').select('*, classes(name), cities(name)');
      if (clsId) {
        pQuery = pQuery.eq('class_id', clsId);
      }
      const { data: pDataRaw } = await pQuery;
      let pData = pDataRaw || [];
      
      if (!clsId) {
        const { data: actClasses } = await supabase.from('classes').select('id').eq('activity_id', actId);
        const actClassIds = actClasses?.map(c => c.id) || [];
        pData = pData.filter((p: any) => actClassIds.includes(p.class_id));
      }
      
      const { data: sData } = await supabase.from('participant_task_status').select('*');
      const { data: subsData } = await supabase.from('submissions').select('*');
      const { data: subMemsData } = await supabase.from('submission_members').select('*');

      if (pData) {
        const counts: Record<string, Set<string>> = {};
        const latestTime: Record<string, number> = {};
        
        // initialize sets
        pData.forEach(p => counts[p.id] = new Set());

        const updateLatestTime = (pId: string, timeStr: string | null) => {
          if (!timeStr) return;
          const time = new Date(timeStr).getTime();
          if (!latestTime[pId] || time > latestTime[pId]) {
            latestTime[pId] = time;
          }
        };

        // from status
        const taskIds = new Set(tData?.map(t => t.id) || []);
        
        sData?.forEach(s => {
          if (counts[s.participant_id] && taskIds.has(s.task_id)) {
             counts[s.participant_id].add(s.task_id);
             updateLatestTime(s.participant_id, s.completed_at || s.submitted_at || s.created_at);
          }
        });

        // from leader submissions
        const subMap = new Map();
        subsData?.forEach(sub => {
          subMap.set(sub.id, sub);
          if (counts[sub.leader_id] && taskIds.has(sub.task_id)) {
             counts[sub.leader_id].add(sub.task_id);
             updateLatestTime(sub.leader_id, sub.created_at || sub.uploaded_at || sub.submitted_at);
          }
        });

        // from member submissions
        subMemsData?.forEach(sm => {
          const sub = subMap.get(sm.submission_id);
          if (sub && counts[sm.participant_id] && taskIds.has(sub.task_id)) {
            counts[sm.participant_id].add(sub.task_id);
            updateLatestTime(sm.participant_id, sub.created_at || sub.uploaded_at || sub.submitted_at);
          }
        });

        const merged = pData.map(p => {
          const finished = counts[p.id] ? counts[p.id].size : 0;
          return {
            ...p,
            finished,
            progress: tCount > 0 ? Math.min(100, Math.round((finished / tCount) * 100)) : 0,
            completionTime: latestTime[p.id] || Infinity
          };
        });
        
        merged.sort((a, b) => {
          if (b.progress !== a.progress) {
             return b.progress - a.progress;
          }
          if (a.completionTime !== b.completionTime) {
            return a.completionTime - b.completionTime;
          }
          return 0; // remain same
        });
        setParticipants(merged);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-fixed to-transparent opacity-20"></div>
        <div className="max-w-7xl mx-auto px-lg">
          <div className="grid lg:grid-cols-2 gap-xl items-center">
            <div className="text-center lg:text-left space-y-lg">
              <div className="inline-flex items-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-1.5 rounded-full font-label-md text-label-md">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                New: Real-time submission tracking enabled
              </div>
              <h1 className="font-display-lg text-display-lg text-on-background tracking-tight">
                Pantau Progres Tugas dengan <span className="text-primary">Presisi</span>
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[36rem] mx-auto lg:mx-0">
                Platform monitoring terpadu untuk instansi pendidikan dan institusi. Kelola tugas, pantau pengiriman peserta, dan automasi feedback dalam satu dashboard intuitif.
              </p>
              <div className="flex flex-col sm:flex-row gap-md justify-center lg:justify-start pt-md">
                <Link to="/upload" className="flex items-center justify-center gap-2 bg-primary text-on-primary px-xl py-md rounded-xl font-title-lg text-title-lg shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                  <span className="material-symbols-outlined">upload_file</span>
                  Upload Tugas
                </Link>
                <Link to="/login" className="flex items-center justify-center gap-2 bg-surface text-primary border border-outline-variant px-xl py-md rounded-xl font-title-lg text-title-lg hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined">admin_panel_settings</span>
                  Login Admin
                </Link>
              </div>
            </div>
            <div className="relative mt-xl lg:mt-0">
              <div className="bg-white/70 backdrop-blur-md border border-outline-variant/50 rounded-xl p-md shadow-2xl relative z-10 overflow-hidden">
                <img alt="Dashboard Preview" className="rounded-lg w-full h-auto object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVKyGcZNXfqvv36PBws2UVGXzRsZgY8pXk8qwUix4Y0D5R22iYcW-cXN2r8iBnMvLdpbotbXroagECdy-OfCd3ws8d5Z-vfAKgAKN3Nzi3EKRvmQe5rBVwr_8oHrIYVmft1Zj4qI0asOtWIkUya6QOtAEBeORir7s6DaP_LpVz63bbEBhVxn91lvZseMEkUeZqWh2abXODklRRbzYqk2AwFnsZb6m6uokDvDrGQH6RgKliYf2kJBQp0_XmUhvYklezVLmbBeVCjzat"/>
              </div>
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary-container rounded-full blur-3xl opacity-20 -z-10"></div>
              <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-secondary rounded-full blur-3xl opacity-10 -z-10"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Section */}
      <section id="monitoring-dashboard" className="py-3xl bg-surface">
        <div className="max-w-7xl mx-auto px-lg">
          <div className="text-center mb-xl">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-md">Monitoring Spesifik Tugas Peserta</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[42rem] mx-auto">Pantau progres pengumpulan tugas secara real-time berdasarkan aktivitas dan kelas yang berjalan.</p>
          </div>
          
          <div className="bg-surface-container-lowest border border-outline-variant shadow-sm rounded-2xl overflow-hidden">
            <div className="p-xl border-b border-outline-variant bg-surface-container-low flex flex-col md:flex-row gap-lg justify-between items-center">
              <div className="flex gap-4 w-full md:w-auto">
                <div className="flex-1 md:w-64">
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Pilih Kegiatan</label>
                  <div className="relative">
                    <select 
                      value={selectedActivity} 
                      onChange={e => setSelectedActivity(e.target.value)}
                      className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-4 py-2 text-body-md focus:ring-1 focus:ring-primary outline-none transition-shadow pr-10"
                    >
                      {activities.length === 0 && <option value="" disabled>Belum ada kegiatan</option>}
                      {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>
                <div className="flex-1 md:w-64">
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Pilih Kelas</label>
                  <div className="relative">
                    <select 
                      value={selectedClass} 
                      onChange={e => setSelectedClass(e.target.value)}
                      className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-4 py-2 text-body-md focus:ring-1 focus:ring-primary outline-none transition-shadow pr-10"
                    >
                      <option value="">Semua Kelas</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface">
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Nama</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Kelas</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-center">Tugas Selesai</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {loading ? (
                    <tr><td colSpan={4} className="px-lg py-8 text-center text-slate-500">Loading data...</td></tr>
                  ) : participants.length === 0 ? (
                    <tr><td colSpan={4} className="px-lg py-8 text-center text-slate-500">Belum ada peserta.</td></tr>
                  ) : (
                    participants.map(p => (
                      <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-lg py-4">
                          <div className="font-body-md text-body-md font-semibold text-on-surface">{p.name}</div>
                          <div className="text-xs text-on-surface-variant mt-1">{p.cities?.name || '-'}</div>
                        </td>
                        <td className="px-lg py-4 font-body-md text-body-md">{p.classes?.name}</td>
                        <td className="px-lg py-4 font-body-md text-body-md text-center">
                          <span className="inline-block bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-sm">
                            {p.finished} / {tasksCount}
                          </span>
                        </td>
                        <td className="px-lg py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2.5 bg-surface-variant rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-500" 
                                style={{ width: `${p.progress}%` }}
                              ></div>
                            </div>
                            <span className="font-label-md text-label-md text-on-surface w-10 text-right">{p.progress}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-3xl">
        <div className="max-w-7xl mx-auto px-lg">
          <div className="bg-primary rounded-3xl p-2xl text-center text-on-primary shadow-2xl shadow-primary/20 relative overflow-hidden">
            <div className="relative z-10 space-y-lg">
              <h2 className="font-headline-lg text-headline-lg">Siap Meningkatkan Efisiensi Monitoring Anda?</h2>
              <p className="font-body-lg text-body-lg text-on-primary-container max-w-[36rem] mx-auto">Mulai pantau setiap tugas dan progres peserta dengan satu klik. Akses dari mana saja.</p>
              <div className="pt-md">
                <Link to="/login" className="inline-block bg-surface text-primary px-3xl py-md rounded-xl font-title-lg text-title-lg hover:scale-105 transition-transform">
                  Mulai Sekarang
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}