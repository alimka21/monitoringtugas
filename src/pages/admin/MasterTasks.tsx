import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function MasterTasks() {
  const [activities, setActivities] = useState<any[]>([]);
  const [activityId, setActivityId] = useState('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('Individu');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchActivities();
  }, []);

  useEffect(() => {
    if (activityId) fetchTasks(activityId);
    else setTasks([]);
  }, [activityId]);

  const fetchActivities = async () => {
    const { data } = await supabase.from('activities').select('*').order('name');
    if (data && data.length > 0) {
      setActivities(data);
      setActivityId(data[0].id);
    }
  };

  const fetchTasks = async (actId: string) => {
    // Note: Assuming `activity_id` column exists in `tasks`, we filter by it.
    // If not, this logic will be slightly disconnected, but meets the functional requirement structure.
    const { data } = await supabase.from('tasks').select('*').eq('activity_id', actId).order('created_at', { ascending: false });
    setTasks(data || []);
  };

  const handleEditClick = (t: any) => {
    setEditId(t.id);
    setTitle(t.title);
    setDescription(t.description || '');
    setTaskType(t.task_type || 'Individu');
    setDeadline(t.deadline ? new Date(t.deadline).toISOString().slice(0, 16) : '');
    setTimeout(() => {
      document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setTitle('');
    setDescription('');
    setTaskType('Individu');
    setDeadline('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityId) {
      alert('Pilih kegiatan terlebih dahulu!');
      return;
    }
    if (!title) {
      alert('Judul tugas wajib diisi!');
      return;
    }
    setLoading(true);
    
    try {
      if (editId) {
        const { error } = await supabase.from('tasks').update({ 
          title,
          description,
          task_type: taskType,
          deadline: deadline ? new Date(deadline).toISOString() : null
        }).eq('id', editId);
        
        if (error) throw error;
        alert('Data tugas berhasil diperbarui.');
      } else {
        const { error } = await supabase.from('tasks').insert([{ 
          title,
          description,
          task_type: taskType,
          activity_id: activityId,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          is_active: true
        }]);
        
        if (error) throw error;
        alert('Data tugas berhasil disimpan.');
      }
      
      handleCancelEdit();
      fetchTasks(activityId);
    } catch (err: any) {
      console.error('Error saving task:', err);
      if (err.code === '42P01') {
        alert('Error: Tabel "tasks" belum dibuat di Supabase Anda. Silakan jalankan script SQL yang disediakan di panel query Supabase Anda.');
      } else if (err.code === '42703') {
        alert('Error: Kolom tambahan belum ada di tabel "tasks". Silakan jalankan script SQL update_schema.sql di Supabase SQL Editor Anda.');
      } else {
        alert('Gagal menyimpan tugas: ' + (err.message || JSON.stringify(err)));
      }
    }
    
    setLoading(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from('tasks').update({ is_active: !current }).eq('id', id);
      if (error) throw error;
      fetchTasks(activityId);
    } catch (err: any) {
       console.error('Error toggling active status on task:', err);
       alert('Gagal mengubah status tugas: ' + err.message);
    }
  };

  const handleDelete = async (id: string, taskTitle: string) => {
    setLoading(true);
    try {
      // 1. Fetch counts of affected items
      const { data: subs } = await supabase.from('submissions').select('id').eq('task_id', id);
      const subIds = subs?.map(s => s.id) || [];

      const { data: statuses } = await supabase.from('participant_task_status').select('id').eq('task_id', id);
      const statusCount = statuses?.length || 0;

      setLoading(false);

      let warningMsg = `Apakah Anda yakin ingin menghapus tugas "${taskTitle}"?`;
      if (subIds.length > 0 || statusCount > 0) {
        warningMsg += `\n\nPERINGATAN: Menghapus tugas ini juga akan MENGHAPUS seluruh relasi terkait secara permanen:`;
        if (subIds.length > 0) {
          warningMsg += `\n- ${subIds.length} Pengumpulan Tugas/Submission Kelompok`;
        }
        if (statusCount > 0) {
          warningMsg += `\n- ${statusCount} data status progres penyelesaian tugas peserta`;
        }
        warningMsg += `\n\nTindakan ini tidak bisa dibatalkan. Lanjutkan?`;
      } else {
        warningMsg += `\n\nTugas ini belum memiliki data pengumpulan. Lanjutkan hapus?`;
      }

      setConfirmModal({
        isOpen: true,
        title: 'Hapus Tugas',
        message: warningMsg,
        onConfirm: () => executeDelete(id, taskTitle, subIds)
      });
    } catch (err: any) {
      console.error('Error fetching delete counts:', err);
      alert('Gagal menyiapkan penghapusan tugas: ' + err.message);
      setLoading(false);
    }
  };

  const executeDelete = async (id: string, taskTitle: string, subIds: string[]) => {
    setLoading(true);
    try {
      // 2. Perform sequential manual cascade deletes
      // A. Delete submission members for these submissions
      if (subIds.length > 0) {
        await supabase.from('submission_members').delete().in('submission_id', subIds);
      }

      // B. Delete participant statuses for this task
      await supabase.from('participant_task_status').delete().eq('task_id', id);

      // C. Delete the submissions themselves
      await supabase.from('submissions').delete().eq('task_id', id);

      // D. Finally, delete the task
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;

      if (editId === id) {
        handleCancelEdit();
      }

      alert(`Tugas "${taskTitle}" beserta semua data progres dan pengumpulan terkait berhasil dihapus.`);
      fetchTasks(activityId);
    } catch (err: any) {
      console.error('Error deleting task:', err);
      alert('Gagal menghapus tugas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Manajemen Data Tugas</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Atur dan pantau progres tugas peserta.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-lg">
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex items-center gap-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]">
          <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">assignment</span>
          </div>
          <div>
            <p className="text-label-md font-label-md text-on-surface-variant">Total Tugas</p>
            <p className="text-title-lg font-bold">{tasks.length}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex items-center gap-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <p className="text-label-md font-label-md text-on-surface-variant">Tugas Aktif</p>
            <p className="text-title-lg font-bold">{tasks.filter(t => t.is_active).length}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] md:col-span-2 flex flex-col justify-center">
          <label className="font-label-md text-label-md text-on-surface-variant mb-2 block">Pilih Kegiatan untuk Ditampilkan</label>
          <div className="relative">
            <select 
              value={activityId}
              onChange={e => setActivityId(e.target.value)}
              className="w-full appearance-none bg-surface border-2 border-primary/20 hover:border-primary rounded-xl px-4 py-3 text-body-lg font-medium focus:ring-2 focus:ring-primary outline-none transition-all pr-12 cursor-pointer shadow-sm"
            >
              {activities.length === 0 && <option value="" disabled>Belum ada kegiatan</option>}
              {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary text-2xl">expand_more</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-lg">
        <div className="md:col-span-1" id="form-section">
          <div className={`bg-surface-container-lowest border rounded-xl overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] transition-all ${editId ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-outline-variant'}`}>
            <div className={`p-lg border-b bg-surface-container-low/50 flex items-center justify-between ${editId ? 'border-amber-500 bg-amber-500/5 text-amber-900' : 'border-outline-variant'}`}>
              <h3 className="font-title-lg text-title-lg font-semibold flex items-center gap-2">
                {editId ? (
                  <>
                    <span className="material-symbols-outlined text-amber-600">edit_note</span>
                    Edit Tugas
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-primary">add_circle</span>
                    Tambah Tugas
                  </>
                )}
              </h3>
              {editId && (
                <span className="text-xs font-semibold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Mode Edit</span>
              )}
            </div>
            <div className="p-lg">
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Judul Tugas</label>
                  <input 
                    type="text"
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    required 
                    className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Deskripsi</label>
                  <input 
                    type="text"
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Tipe Tugas</label>
                  <div className="relative">
                    <select 
                      value={taskType}
                      onChange={e => setTaskType(e.target.value)}
                      className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none"
                    >
                      <option value="Individu">Individu</option>
                      <option value="Kelompok">Kelompok</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Batas Waktu (Opsional)</label>
                  <input 
                    type="datetime-local" 
                    value={deadline} 
                    onChange={e => setDeadline(e.target.value)} 
                    className="w-full px-4 py-2 bg-surface border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 py-2 bg-primary text-on-primary rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {editId ? 'Simpan Perubahan' : 'Simpan Tugas'}
                  </button>
                  {editId && (
                    <button 
                      type="button" 
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-surface-variant text-on-surface-variant rounded-lg font-medium hover:opacity-90 transition-all"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-2">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] flex flex-col h-full">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-lg py-4 font-medium text-label-md text-on-surface-variant uppercase tracking-wider">Nama Tugas</th>
                    <th className="px-lg py-4 font-medium text-label-md text-on-surface-variant uppercase tracking-wider">Tipe</th>
                    <th className="px-lg py-4 font-medium text-label-md text-on-surface-variant uppercase tracking-wider">Deadline</th>
                    <th className="px-lg py-4 font-medium text-label-md text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th className="px-lg py-4 font-medium text-label-md text-on-surface-variant uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {tasks.map(t => (
                    <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="px-lg py-4">
                        <div className="flex flex-col">
                          <span className="font-body-md text-body-md font-semibold text-on-surface">{t.title}</span>
                          <span className="text-xs text-on-surface-variant truncate max-w-[200px]">{t.description}</span>
                        </div>
                      </td>
                      <td className="px-lg py-4 text-body-md text-on-surface whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-1 bg-surface-container border border-outline-variant rounded text-xs font-medium">
                          {t.task_type || 'Individu'}
                        </span>
                      </td>
                      <td className="px-lg py-4 text-body-md text-on-surface">
                        {t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID') : '-'}
                      </td>
                      <td className="px-lg py-4">
                        {t.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="px-lg py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            className={`p-2 rounded-lg transition-all ${t.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            onClick={() => toggleActive(t.id, t.is_active)}
                            title={t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            <span className="material-symbols-outlined text-[20px]">{t.is_active ? 'toggle_on' : 'toggle_off'}</span>
                          </button>
                          <button 
                            className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container rounded-lg transition-all"
                            onClick={() => handleEditClick(t)}
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button 
                            className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-all"
                            onClick={() => handleDelete(t.id, t.title)}
                            title="Hapus"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-lg py-8 text-center text-slate-500">Belum ada data tugas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-xl shadow-2xl w-[90vw] md:w-[450px] flex flex-col overflow-hidden">
            <div className="p-lg border-b border-outline-variant bg-surface-container-low/50 flex items-center gap-3 text-error">
              <span className="material-symbols-outlined text-4xl">warning</span>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                {confirmModal.title}
              </h3>
            </div>
            <div className="p-lg space-y-md">
              <p className="font-body-md text-body-md text-on-surface-variant whitespace-pre-wrap">
                {confirmModal.message}
              </p>
            </div>
            <div className="p-lg bg-surface-container-low/50 border-t border-outline-variant flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-surface cursor-pointer border border-outline-variant text-on-surface hover:bg-surface-container-low rounded-lg font-medium transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  confirmModal.onConfirm();
                }}
                className="px-4 py-2 bg-error cursor-pointer text-on-error hover:bg-error/90 rounded-lg font-medium transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
