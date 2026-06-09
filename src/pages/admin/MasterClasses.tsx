import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function MasterClasses() {
  const [activities, setActivities] = useState<any[]>([]);
  const [activityId, setActivityId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [name, setName] = useState('');
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
    if (activityId) fetchClasses(activityId);
    else setClasses([]);
  }, [activityId]);

  const fetchActivities = async () => {
    const { data } = await supabase.from('activities').select('*').order('name');
    if (data && data.length > 0) {
      setActivities(data);
      setActivityId(data[0].id);
    }
  };

  const fetchClasses = async (actId: string) => {
    const { data } = await supabase.from('classes').select('*').eq('activity_id', actId).order('name');
    setClasses(data || []);
  };

  const handleEditClick = (c: any) => {
    setEditId(c.id);
    setName(c.name);
    setTimeout(() => {
      document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setName('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityId) {
      alert('Pilih kegiatan terlebih dahulu!');
      return;
    }
    if (!name) {
      alert('Nama kelas wajib diisi!');
      return;
    }
    setLoading(true);
    try {
      if (editId) {
        const { error } = await supabase.from('classes').update({ name }).eq('id', editId);
        if (error) throw error;
        alert('Data kelas berhasil diperbarui.');
      } else {
        const { error } = await supabase.from('classes').insert([{ name, activity_id: activityId }]);
        if (error) throw error;
        alert('Data kelas berhasil disimpan.');
      }
      
      handleCancelEdit();
      fetchClasses(activityId);
    } catch (err: any) {
      console.error('Error saving class:', err);
      if (err.code === '42P01') {
        alert('Error: Tabel "classes" belum dibuat di Supabase Anda. Silakan jalankan script SQL yang disediakan di panel query Supabase Anda.');
      } else {
        alert('Gagal menyimpan kelas: ' + (err.message || JSON.stringify(err)));
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, className: string) => {
    setLoading(true);
    try {
      // 1. Fetch counts of affected items
      // Participants in this class
      const { data: parts } = await supabase.from('participants').select('id, name').eq('class_id', id);
      const partIds = parts?.map(p => p.id) || [];

      // Submissions where leader belongs to class
      let leadSubIds: string[] = [];
      if (partIds.length > 0) {
        const { data: leadSubs } = await supabase.from('submissions').select('id').in('leader_id', partIds);
        leadSubIds = leadSubs?.map(s => s.id) || [];
      }

      // Consolidate unique submission IDs that will be affected
      const uniqueSubIds = Array.from(new Set([...leadSubIds]));
      
      // Member relations in submissions where class participants are members
      let memberRelCount = 0;
      if (partIds.length > 0) {
        const { data: mRels } = await supabase.from('submission_members').select('id').in('participant_id', partIds);
        memberRelCount = mRels?.length || 0;
      }

      // Task statuses
      let statusCount = 0;
      if (partIds.length > 0) {
        const { data: sRels } = await supabase.from('participant_task_status').select('id').in('participant_id', partIds);
        statusCount = sRels?.length || 0;
      }

      setLoading(false);

      let warningMsg = `Apakah Anda yakin ingin menghapus kelas "${className}"?`;
      if (partIds.length > 0 || uniqueSubIds.length > 0) {
        warningMsg += `\n\nPERINGATAN: Menghapus kelas ini juga akan MENGHAPUS seluruh relasi terkait secara permanen:`;
        if (partIds.length > 0) {
          warningMsg += `\n- ${partIds.length} Peserta (beserta progres tugasnya)`;
        }
        if (uniqueSubIds.length > 0) {
          warningMsg += `\n- ${uniqueSubIds.length} Pengumpulan Tugas/Submission Kelompok`;
        }
        if (statusCount > 0) {
          warningMsg += `\n- ${statusCount} Status Penyelesaian Tugas`;
        }
        warningMsg += `\n\nTindakan ini tidak bisa dibatalkan. Lanjutkan?`;
      } else {
        warningMsg += `\n\nKelas ini belum memiliki data peserta atau tugas terkumpul. Lanjutkan hapus?`;
      }

      setConfirmModal({
        isOpen: true,
        title: 'Hapus Kelas',
        message: warningMsg,
        onConfirm: () => executeDelete(id, className, partIds, uniqueSubIds)
      });
    } catch (err: any) {
      console.error('Error fetching delete counts:', err);
      alert('Gagal menyiapkan penghapusan kelas: ' + err.message);
      setLoading(false);
    }
  };

  const executeDelete = async (id: string, className: string, partIds: string[], uniqueSubIds: string[]) => {
    setLoading(true);
    try {
      // 2. Perform sequential manual cascade deletes
      // A. Delete task progress status for those participants
      if (partIds.length > 0) {
        await supabase.from('participant_task_status').delete().in('participant_id', partIds);
      }

      // B. Delete participation in other submissions
      if (partIds.length > 0) {
        await supabase.from('submission_members').delete().in('participant_id', partIds);
      }

      // C. Delete submission members for submissions owned by class or these participants
      if (uniqueSubIds.length > 0) {
        await supabase.from('submission_members').delete().in('submission_id', uniqueSubIds);
      }

      // D. Delete submissions belonging to the class or led by these participants
      if (uniqueSubIds.length > 0) {
        await supabase.from('submissions').delete().in('id', uniqueSubIds);
      }

      // E. Delete the participants themselves
      if (partIds.length > 0) {
        await supabase.from('participants').delete().in('id', partIds);
      }

      // F. Delete the class itself
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;

      if (editId === id) {
        handleCancelEdit();
      }

      alert(`Kelas "${className}" beserta seluruh data peserta & tugas terkait berhasil dihapus.`);
      fetchClasses(activityId);
    } catch (err: any) {
      console.error('Error deleting class:', err);
      alert('Gagal menghapus kelas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-lg max-w-[1400px] w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Master Kelas</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Kelola daftar kelas berdasarkan kegiatan.</p>
        </div>
      </div>

      {/* Filter Besar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg mb-lg">
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex items-center gap-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]">
          <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">class</span>
          </div>
          <div>
            <p className="text-label-md font-label-md text-on-surface-variant">Total Kelas</p>
            <p className="text-title-lg font-bold">{classes.length}</p>
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
                    Edit Kelas
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-primary">add_circle</span>
                    Tambah Kelas Baru
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
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Nama Kelas</label>
                  <input 
                    type="text"
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Contoh: Kelas A"
                    required 
                    className="w-full px-4 py-2 bg-surface cursor-text border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 py-2 bg-primary text-on-primary rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {editId ? 'Simpan Perubahan' : 'Simpan Kelas'}
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
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Nama Kelas</th>
                    <th className="text-right px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {classes.map(c => (
                    <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="px-lg py-4">
                         <span className="font-body-md text-body-md font-semibold text-on-surface">{c.name}</span>
                      </td>
                      <td className="px-lg py-4 text-right">
                        <button 
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container rounded-lg transition-all mr-1"
                          onClick={() => handleEditClick(c)}
                          title="Edit Kelas"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button 
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-all"
                          onClick={() => handleDelete(c.id, c.name)}
                          title="Hapus Kelas"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {classes.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-lg py-8 text-center text-slate-500">Belum ada data kelas.</td>
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
