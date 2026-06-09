import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function ParticipantDetail() {
  const { id } = useParams<{ id: string }>();
  const [participant, setParticipant] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    
    const [pRes, tRes, sRes] = await Promise.all([
      supabase.from('participants').select('*, classes(name), cities(name)').eq('id', id).single(),
      supabase.from('tasks').select('*').eq('is_active', true).order('created_at'),
      supabase.from('participant_task_status').select('task_id').eq('participant_id', id)
    ]);

    if (pRes.data) setParticipant(pRes.data);
    if (tRes.data) setTasks(tRes.data);
    if (sRes.data) {
      setCompletedTaskIds(new Set(sRes.data.map(s => s.task_id)));
    }
    
    setLoading(false);
  };

  if (loading) return <div className="p-xl text-center">Loading...</div>;
  if (!participant) return <div className="p-xl text-center">Peserta tidak ditemukan.</div>;

  const finishedCount = completedTaskIds.size;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? Math.round((finishedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-lg max-w-[1400px] mx-auto w-full">
      <div className="flex items-center gap-2 text-on-surface-variant mb-6">
        <Link to="/admin/track" className="font-label-md text-label-md hover:text-primary transition-colors hover:underline">Monitoring Peserta</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="font-label-md text-label-md text-primary font-bold">Profile Detail</span>
      </div>

      <section className="bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border border-outline-variant/50 rounded-xl p-xl flex flex-col md:flex-row items-center gap-xl">
        <div className="relative">
          <div className="w-32 h-32 rounded-3xl overflow-hidden ring-4 ring-primary-fixed bg-indigo-100 flex items-center justify-center text-indigo-700 text-5xl font-bold">
             {participant.name?.charAt(0).toUpperCase()}
          </div>
          {progress === 100 && (
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1 rounded-full border-4 border-surface flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 text-center md:text-left">
          <h2 className="font-headline-md text-headline-md text-on-surface">{participant.name}</h2>
          <div className="flex flex-wrap justify-center md:justify-start gap-md mt-sm">
            <div className="flex items-center gap-1 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full">
              <span className="material-symbols-outlined text-[18px]">school</span>
              <span className="font-label-md text-label-md">{participant.classes?.name}</span>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 bg-surface-container-high text-on-surface-variant rounded-full">
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              <span className="font-label-md text-label-md">{participant.cities?.name}</span>
            </div>
            {participant.participant_number && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant rounded-full">
                <span className="material-symbols-outlined text-[18px]">badge</span>
                <span className="font-label-md text-label-md">ID: {participant.participant_number}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-md">
          <button className="px-lg py-md bg-primary text-on-primary font-medium rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap">Edit Profile</button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-lg">
        <div className="bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border border-outline-variant/30 rounded-xl p-lg flex flex-col gap-sm">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant font-label-md text-label-md">Total Tugas</span>
            <span className="material-symbols-outlined text-primary">assignment</span>
          </div>
          <div className="text-[32px] font-bold text-on-surface">{totalCount}</div>
          <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary w-full"></div>
          </div>
        </div>
        <div className="bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border border-outline-variant/30 rounded-xl p-lg flex flex-col gap-sm">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant font-label-md text-label-md">Selesai</span>
            <span className="material-symbols-outlined text-emerald-500">task_alt</span>
          </div>
          <div className="text-[32px] font-bold text-on-surface">{finishedCount}</div>
          <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        <div className="bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border border-outline-variant/30 rounded-xl p-lg flex flex-col gap-sm">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant font-label-md text-label-md">Belum Selesai</span>
            <span className="material-symbols-outlined text-error">pending_actions</span>
          </div>
          <div className="text-[32px] font-bold text-on-surface">{totalCount - finishedCount}</div>
          <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-error transition-all duration-500" style={{ width: `${100 - progress}%` }}></div>
          </div>
        </div>
        <div className="bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border border-outline-variant/30 rounded-xl p-lg flex flex-col gap-sm">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant font-label-md text-label-md">Progress Keseluruhan</span>
            <span className="material-symbols-outlined text-amber-500">bolt</span>
          </div>
          <div className="text-[32px] font-bold text-on-surface">{progress}%</div>
          <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg items-start">
        <section className="lg:col-span-2 flex flex-col gap-lg">
          <div className="flex items-center justify-between">
            <h3 className="font-title-lg text-title-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined">list_alt</span>
              Assignment Tracking
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {tasks.map(task => {
              const isCompleted = completedTaskIds.has(task.id);
              
              if (isCompleted) {
                return (
                  <div key={task.id} className="bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border border-outline-variant/50 rounded-xl p-lg flex flex-col gap-md group hover:border-primary/30 transition-all cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-full tracking-wider">SELESAI</div>
                      <span className="material-symbols-outlined text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <div>
                      <h4 className="font-body-lg font-bold text-on-surface group-hover:text-primary transition-colors">{task.title}</h4>
                      {task.description && <p className="text-label-md text-on-surface-variant mt-1 line-clamp-2">{task.description}</p>}
                    </div>
                  </div>
                );
              } else {
                return (
                   <div key={task.id} className="bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border-l-4 border-l-error border-y-[1px] border-y-outline-variant/50 border-r-[1px] border-r-outline-variant/50 rounded-xl p-lg flex flex-col gap-md group hover:border-error/30 transition-all cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div className="px-3 py-1 bg-error-container text-on-error-container text-[10px] font-bold uppercase rounded-full tracking-wider">BELUM</div>
                      <span className="material-symbols-outlined text-error">cancel</span>
                    </div>
                    <div>
                      <h4 className="font-body-lg font-bold text-on-surface group-hover:text-error transition-colors">{task.title}</h4>
                      {task.description && <p className="text-label-md text-on-surface-variant mt-1 line-clamp-2">{task.description}</p>}
                    </div>
                  </div>
                );
              }
            })}
            
            {tasks.length === 0 && (
              <div className="col-span-2 p-8 text-center text-slate-500 bg-surface-container-lowest rounded-xl">Belum ada tugas aktif.</div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-lg">
          <h3 className="font-title-lg text-title-lg text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined">history</span>
            Activity Details (Coming Soon)
          </h3>
          <div className="bg-surface-container-lowest shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border border-outline-variant/50 rounded-xl p-lg text-center text-on-surface-variant">
             Log audit aktivitas untuk submission spesifik peserta akan tampil di sini.
          </div>
        </aside>
      </div>
    </div>
  );
}
