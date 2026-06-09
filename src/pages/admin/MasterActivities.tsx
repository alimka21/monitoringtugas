import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function MasterActivities() {
  const [activities, setActivities] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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

  const fetchActivities = async () => {
    const { data } = await supabase.from('activities').select('*').order('name');
    setActivities(data || []);
  };

  const handleEditClick = (activity: any) => {
    setEditId(activity.id);
    setName(activity.name);
    setOrganizer(activity.organizer || '');
    setStartDate(activity.start_date || '');
    setEndDate(activity.end_date || '');
    setTimeout(() => {
      document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setName('');
    setOrganizer('');
    setStartDate('');
    setEndDate('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('Nama kegiatan wajib diisi');
      return;
    }
    setLoading(true);
    
    try {
      const payload: any = { 
        name, 
        organizer: organizer || null, 
        start_date: startDate || null,
        end_date: endDate || null
      };
      
      if (editId) {
        const { error } = await supabase.from('activities').update(payload).eq('id', editId);
        if (error) throw error;
        alert('Kegiatan berhasil diperbarui.');
      } else {
        const { error } = await supabase.from('activities').insert([payload]);
        if (error) throw error;
        alert('Kegiatan berhasil disimpan.');
      }
      
      handleCancelEdit();
      fetchActivities();
    } catch (err: any) {
      console.error('Error saving activity:', err);
      if (err.code === '42P01') {
        alert('Error: Tabel "activities" belum dibuat di Supabase Anda. Silakan jalankan script SQL yang disediakan di panel query Supabase Anda.');
      } else if (err.code === '42703') {
        alert('Error: Kolom tambahan belum ada di tabel "activities". Silakan jalankan script SQL update_schema.sql di Supabase SQL Editor Anda.');
      } else {
        alert('Gagal menyimpan kegiatan: ' + (err.message || JSON.stringify(err)));
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, activityName: string) => {
    setLoading(true);
    try {
      // 1. Fetch related counts
      const { data: actClasses } = await supabase.from('classes').select('id').eq('activity_id', id);
      const classIds = actClasses?.map((c: any) => c.id) || [];
      const classCount = classIds.length;

      const { data: actTasks } = await supabase.from('tasks').select('id').eq('activity_id', id);
      const taskIds = actTasks?.map((t: any) => t.id) || [];
      const taskCount = taskIds.length;

      let partCount = 0;
      let partIds: string[] = [];
      if (classIds.length > 0) {
        const { data: actParts } = await supabase.from('participants').select('id').in('class_id', classIds);
        partIds = actParts?.map(p => p.id) || [];
        partCount = partIds.length;
      }

      let subCount = 0;
      let subIds: string[] = [];
      if (taskIds.length > 0) {
        const { data: actSubs } = await supabase.from('submissions').select('id').in('task_id', taskIds);
        subIds = actSubs?.map(s => s.id) || [];
        subCount = subIds.length;
      }

      setLoading(false);

      // Warning prompt detailing exact relations
      let warningMsg = `Apakah Anda yakin ingin menghapus kegiatan "${activityName}"?`;
      if (classCount > 0 || taskCount > 0 || partCount > 0 || subCount > 0) {
        warningMsg += `\n\nPERINGATAN: Kegiatan ini memiliki relasi data berikut yang akan ikut TERHAPUS SECARA PERMANEN:`;
        if (classCount > 0) warningMsg += `\n- ${classCount} Kelas`;
        if (taskCount > 0) warningMsg += `\n- ${taskCount} Tugas`;
        if (partCount > 0) warningMsg += `\n- ${partCount} Peserta`;
        if (subCount > 0) warningMsg += `\n- ${subCount} Pengumpulan Tugas/Submission`;
        warningMsg += `\n\nTindakan ini tidak bisa dibatalkan dan akan membersihkan semua data terkait di database. Lanjutkan?`;
      } else {
        warningMsg += `\n\nKegiatan ini belum memiliki data relasi (kelas/peserta/tugas). Lanjutkan hapus?`;
      }

      setConfirmModal({
        isOpen: true,
        title: 'Hapus Kegiatan',
        message: warningMsg,
        onConfirm: () => executeDelete(id, activityName, classIds, taskIds, partIds, subIds)
      });
    } catch (err: any) {
      console.error('Error fetching delete counts:', err);
      alert('Gagal menyiapkan penghapusan kegiatan: ' + err.message);
      setLoading(false);
    }
  };

  const executeDelete = async (id: string, activityName: string, classIds: string[], taskIds: string[], partIds: string[], subIds: string[]) => {
    setLoading(true);
    try {
      // 2. Perform sequential cascading deletes
      // A & B: Delete task progress status
      if (partIds.length > 0) {
        await supabase.from('participant_task_status').delete().in('participant_id', partIds);
      }
      if (taskIds.length > 0) {
        await supabase.from('participant_task_status').delete().in('task_id', taskIds);
      }

      // C & D: Delete submission members
      if (partIds.length > 0) {
        await supabase.from('submission_members').delete().in('participant_id', partIds);
      }
      if (subIds.length > 0) {
        await supabase.from('submission_members').delete().in('submission_id', subIds);
      }

      // Get any other submissions that might exist for classes or leaders
      let extraSubIds: string[] = [];
      if (partIds.length > 0) {
        const { data: pSubs } = await supabase.from('submissions').select('id').in('leader_id', partIds);
        pSubs?.forEach((s: any) => extraSubIds.push(s.id));
      }

      const allUniqueSubIds = Array.from(new Set([...subIds, ...extraSubIds]));
      if (allUniqueSubIds.length > 0) {
        await supabase.from('submission_members').delete().in('submission_id', allUniqueSubIds);
        await supabase.from('submissions').delete().in('id', allUniqueSubIds);
      }

      // F. Delete participants
      if (partIds.length > 0) {
        await supabase.from('participants').delete().in('id', partIds);
      }

      // G. Delete tasks
      if (taskIds.length > 0) {
        await supabase.from('tasks').delete().in('id', taskIds);
      }

      // H. Delete classes
      if (classIds.length > 0) {
        await supabase.from('classes').delete().in('id', classIds);
      }

      // I. Delete the activity itself
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;

      if (editId === id) {
        handleCancelEdit();
      }

      alert(`Kegiatan "${activityName}" beserta seluruh data kelas, peserta, tugas, dan respon pengumpulan terkait berhasil dihapus dari sistem.`);
      fetchActivities();
    } catch (err: any) {
      console.error('Error deleting activity:', err);
      alert('Gagal menghapus kegiatan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-lg max-w-[1400px] w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Master Kegiatan</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Kelola daftar kegiatan.</p>
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
                    Edit Kegiatan
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-primary">add_circle</span>
                    Tambah Kegiatan Baru
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
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Nama Kegiatan</label>
                  <input 
                    type="text"
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Contoh: Kegiatan Guru Inti"
                    required 
                    className="w-full px-4 py-2 bg-surface cursor-text border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Penyelenggara</label>
                  <input 
                    type="text"
                    value={organizer} 
                    onChange={e => setOrganizer(e.target.value)} 
                    placeholder="Contoh: Kemdikbud"
                    className="w-full px-4 py-2 bg-surface cursor-text border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Tgl Mulai</label>
                    <input 
                      type="date"
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)} 
                      className="w-full px-4 py-2 bg-surface cursor-text border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Tgl Selesai</label>
                    <input 
                      type="date"
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)} 
                      className="w-full px-4 py-2 bg-surface cursor-text border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 py-2 bg-primary text-on-primary rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {editId ? 'Simpan Perubahan' : 'Simpan Kegiatan'}
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
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low/50">
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Nama Kegiatan</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Penyelenggara</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Waktu</th>
                    <th className="text-right px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {activities.map(c => (
                    <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="px-lg py-4">
                         <span className="font-body-md text-body-md font-semibold text-on-surface">{c.name}</span>
                      </td>
                      <td className="px-lg py-4">
                         <span className="font-body-md text-body-md text-on-surface-variant">{c.organizer || '-'}</span>
                      </td>
                      <td className="px-lg py-4">
                         <span className="font-body-md text-body-md text-on-surface-variant">
                           {c.start_date ? new Date(c.start_date).toLocaleDateString('id-ID') : '-'}
                           {' - '}
                           {c.end_date ? new Date(c.end_date).toLocaleDateString('id-ID') : '-'}
                         </span>
                      </td>
                      <td className="px-lg py-4 text-right">
                        <button 
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container rounded-lg transition-all mr-1"
                          onClick={() => handleEditClick(c)}
                          title="Edit Kegiatan"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button 
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-all"
                          onClick={() => handleDelete(c.id, c.name)}
                          title="Hapus Kegiatan"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activities.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-lg py-8 text-center text-slate-500">Belum ada data.</td>
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

