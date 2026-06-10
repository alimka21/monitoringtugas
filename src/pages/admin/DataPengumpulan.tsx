import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

export default function DataPengumpulan() {
  const [participantSubmissions, setParticipantSubmissions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [tasksList, setTasksList] = useState<any[]>([]);
  
  const [activityId, setActivityId] = useState('');
  const [classId, setClassId] = useState('');
  const [taskId, setTaskId] = useState('');
  
  const [loading, setLoading] = useState(true);

  const [showMemberModal, setShowMemberModal] = useState<string[] | null>(null);
  const [showLinksModal, setShowLinksModal] = useState<string[] | null>(null);
  
  // Edit State
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editUrls, setEditUrls] = useState<string>('');

  // Delete State
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, leaderName: string} | null>(null);

  useEffect(() => {
    fetchInitial();
    fetchTaskSubmissions();
  }, []);

  const fetchInitial = async () => {
    const [actRes, clsRes, tskRes] = await Promise.all([
      supabase.from('activities').select('*').order('name'),
      supabase.from('classes').select('*').order('name'),
      supabase.from('tasks').select('*').order('title')
    ]);
    if (actRes.data) setActivities(actRes.data);
    if (clsRes.data) setClassesList(clsRes.data);
    if (tskRes.data) setTasksList(tskRes.data);
  };

  const fetchTaskSubmissions = async () => {
    setLoading(true);
    try {
      const [subRes, partRes, clsRes, taskRes, memRes] = await Promise.all([
        supabase.from('submissions').select('*'),
        supabase.from('participants').select('*'),
        supabase.from('classes').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('submission_members').select('*')
      ]);

      const submissions = subRes.data || [];
      const participants = partRes.data || [];
      const classes = clsRes.data || [];
      const tasks = taskRes.data || [];
      const subMembers = memRes.data || [];

      const results = submissions.map((sub: any) => {
        const leader = participants.find((x: any) => x.id === sub.leader_id);
        const t = tasks.find((x: any) => x.id === sub.task_id);
        
        let cName = '-';
        let activity_id = '';
        let class_id = '';
        if (leader) {
          const c = classes.find((x: any) => x.id === leader.class_id);
          if (c) {
            cName = c.name;
            activity_id = c.activity_id;
            class_id = c.id;
          }
        }
        
        // Members list (only members, not leader)
        const relatedSubMembers = subMembers.filter((sm: any) => sm.submission_id === sub.id && sm.participant_id !== sub.leader_id);
        const memberNames = relatedSubMembers.map((sm: any) => {
            const memP = participants.find((p: any) => p.id === sm.participant_id);
            return memP ? memP.name : 'Unknown';
        });

        return {
          id: sub.id,
          leaderName: leader?.name || 'Unknown',
          memberNames,
          className: cName,
          class_id,
          taskName: t?.title || '-',
          task_id: t?.id || '-',
          activity_id: activity_id,
          submittedAt: sub.created_at,
          fileUrls: sub.file_url ? sub.file_url.split(', ') : []
        };
      }).sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

      setParticipantSubmissions(results);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const confirmDelete = (id: string, leaderName: string) => {
    setDeleteConfirm({ id, leaderName });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const { error } = await supabase.from('submissions').delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      setParticipantSubmissions(prev => prev.filter(s => s.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch (e: any) {
      alert('Gagal menghapus data: ' + e.message);
    }
  };

  const openEdit = (act: any) => {
    setEditingSubId(act.id);
    setEditUrls(act.fileUrls.join(', '));
  };

  const handleUpdateLink = async () => {
    if (!editingSubId) return;
    if (!editUrls.trim()) {
      alert('Link tidak boleh kosong');
      return;
    }
    
    try {
      const { error } = await supabase.from('submissions').update({
        file_url: editUrls.trim(),
        file_name: editUrls.split(',').length > 1 ? 'Multiple Links' : editUrls.trim()
      }).eq('id', editingSubId);

      if (error) throw error;
      
      const newUrls = editUrls.split(',').map(url => url.trim()).filter(url => url);

      setParticipantSubmissions(prev => prev.map(s => {
        if (s.id === editingSubId) {
          return { ...s, fileUrls: newUrls };
        }
        return s;
      }));
      setEditingSubId(null);
      setEditUrls('');
      alert('Link berhasil diperbarui');
    } catch (e: any) {
      alert('Gagal memperbarui link: ' + e.message);
    }
  };

  const exportData = () => {
    const wsData = [
      ["Tanggal Kumpul", "Nama Ketua", "Anggota", "Kelas", "Tugas", "Link Tugas 1", "Link Tugas 2", "Link Tugas 3"],
      ...filteredSubmissions.map(act => [
        new Date(act.submittedAt).toLocaleString('id-ID'),
        act.leaderName,
        act.memberNames.join(', '),
        act.className,
        act.taskName,
        act.fileUrls[0] || '',
        act.fileUrls[1] || '',
        act.fileUrls[2] || ''
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Pengumpulan");
    XLSX.writeFile(wb, "Laporan_Pengumpulan.xlsx");
  };

  let filteredSubmissions = participantSubmissions;
  if (activityId) filteredSubmissions = filteredSubmissions.filter(d => d.activity_id === activityId);
  if (classId) filteredSubmissions = filteredSubmissions.filter(d => d.class_id === classId);
  if (taskId) filteredSubmissions = filteredSubmissions.filter(d => d.task_id === taskId);
  
  // Filter dropdowns options based on Activity
  const availableClasses = activityId ? classesList.filter(c => c.activity_id === activityId) : classesList;
  const availableTasks = activityId ? tasksList.filter(t => t.activity_id === activityId) : tasksList;

  return (
    <div className="space-y-xl fade-in pb-xl relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Data Pengumpulan</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Pantau seluruh pengumpulan tugas terbaru dari setiap peserta.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-lg mb-lg">
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl flex flex-col justify-between shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">data_check</span>
            </div>
            <div>
              <p className="text-label-md font-label-md text-on-surface-variant">Total Pengumpulan</p>
              <p className="text-title-lg font-bold">{filteredSubmissions.length}</p>
            </div>
          </div>
          <button 
            onClick={exportData}
            className="w-full flex items-center justify-center gap-2 bg-on-surface text-surface px-4 py-2 rounded-xl text-sm font-medium hover:bg-on-surface/90 transition-all border border-outline"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export (.xlsx)
          </button>
        </div>
        
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] flex flex-col justify-center">
          <label className="font-label-md text-label-md text-on-surface-variant mb-2 block">Filter Kegiatan</label>
          <div className="relative">
            <select 
              value={activityId}
              onChange={e => { setActivityId(e.target.value); setClassId(''); setTaskId(''); }}
              className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-4 py-2 text-body-md focus:ring-1 focus:ring-primary outline-none transition-all pr-10 cursor-pointer"
            >
              <option value="">Semua Kegiatan</option>
              {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] flex flex-col justify-center">
          <label className="font-label-md text-label-md text-on-surface-variant mb-2 block">Filter Kelas</label>
          <div className="relative">
            <select 
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-4 py-2 text-body-md focus:ring-1 focus:ring-primary outline-none transition-all pr-10 cursor-pointer"
            >
              <option value="">Semua Kelas</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] flex flex-col justify-center">
          <label className="font-label-md text-label-md text-on-surface-variant mb-2 block">Filter Tugas</label>
          <div className="relative">
            <select 
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-4 py-2 text-body-md focus:ring-1 focus:ring-primary outline-none transition-all pr-10 cursor-pointer"
            >
              <option value="">Semua Tugas</option>
              {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
          </div>
        </div>
      </div>

      <div className="bg-surface flex flex-col h-[calc(100vh-320px)] border border-outline-variant rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto flex-1 h-full overflow-y-auto">
          {loading ? (
             <div className="flex h-full items-center justify-center text-on-surface-variant">Memuat data...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-container z-10 shadow-sm border-b border-outline-variant">
                <tr>
                  <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Tanggal Kumpul</th>
                  <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Nama Ketua</th>
                  <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Anggota</th>
                  <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Kelas</th>
                  <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Tugas</th>
                  <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Link Tugas</th>
                  <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-right w-[120px]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant bg-surface">
                {filteredSubmissions.length > 0 ? filteredSubmissions.map((act) => (
                  <tr key={act.id} className="hover:bg-surface-container-lowest transition-colors">
                    <td className="px-lg py-4 text-body-md text-on-surface-variant whitespace-nowrap">
                      {new Date(act.submittedAt).toLocaleDateString('id-ID')} {new Date(act.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-lg py-4 font-body-md text-body-md text-on-surface font-medium">
                      {act.leaderName}
                    </td>
                    <td className="px-lg py-4">
                      {act.memberNames.length > 0 ? (
                        <button 
                          onClick={() => setShowMemberModal(act.memberNames)}
                          className="text-primary hover:text-primary-container font-label-md text-sm border border-primary/30 px-3 py-1 rounded-full hover:bg-primary/5 transition-colors"
                        >
                          Lihat ({act.memberNames.length})
                        </button>
                      ) : (
                        <span className="text-on-surface-variant text-sm italic">-</span>
                      )}
                    </td>
                    <td className="px-lg py-4 text-body-md text-on-surface-variant">
                      {act.className}
                    </td>
                    <td className="px-lg py-4 text-body-md text-on-surface-variant max-w-[200px] truncate" title={act.taskName}>
                      {act.taskName}
                    </td>
                    <td className="px-lg py-4">
                      {act.fileUrls.length > 0 ? (
                         <button 
                          onClick={() => setShowLinksModal(act.fileUrls)}
                          className="text-primary hover:text-primary-container font-label-md text-sm border border-primary/30 px-3 py-1 rounded-full hover:bg-primary/5 transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span> Lihat
                        </button>
                      ) : (
                        <span className="text-on-surface-variant italic text-sm">-</span>
                      )}
                    </td>
                    <td className="px-lg py-4 text-right">
                      <div className="flex items-center justify-end gap-1 flex-nowrap">
                        <button
                          onClick={() => openEdit(act)}
                          className="w-10 h-10 rounded-full flex items-center justify-center text-primary bg-primary/5 hover:bg-primary/20 transition-colors"
                          title="Edit Link"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button
                          onClick={() => confirmDelete(act.id, act.leaderName)}
                          className="w-10 h-10 rounded-full flex items-center justify-center text-error bg-error/5 hover:bg-error/20 transition-colors"
                          title="Hapus"
                        >
                           <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-lg py-12 text-center text-on-surface-variant font-label-md">
                      Belum ada pengumpulan tugas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pop up for Members */}
      {showMemberModal !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-xl min-w-[320px] sm:min-w-[500px] shadow-xl">
            <h3 className="font-title-lg text-title-lg mb-4 text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">groups</span>
              Daftar Anggota
            </h3>
            <ul className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto pr-2">
              {showMemberModal.map((m, idx) => (
                <li key={idx} className="bg-surface-container py-3 px-4 rounded-xl text-body-lg font-medium text-on-surface flex items-center justify-between">
                  <span>{m}</span>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => setShowMemberModal(null)}
              className="w-full bg-outline-variant text-on-surface py-3 rounded-xl font-medium hover:bg-outline transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Pop up for Links */}
      {showLinksModal !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-xl min-w-[320px] sm:min-w-[500px] shadow-xl">
            <h3 className="font-title-lg text-title-lg mb-4 text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">link</span>
              Link Tugas
            </h3>
            <ul className="space-y-3 mb-6 max-h-[60vh] overflow-y-auto pr-2">
              {showLinksModal.map((url, idx) => (
                <li key={idx}>
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-3 bg-surface-container py-3 px-4 rounded-xl text-primary hover:bg-primary/5 transition-colors border border-outline-variant hover:border-primary/30"
                  >
                    <div className="bg-primary-fixed text-on-primary-fixed w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-label-md text-on-surface truncate">Link Tugas {idx + 1}</p>
                      <p className="text-xs text-on-surface-variant truncate">{url}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => setShowLinksModal(null)}
              className="w-full bg-outline-variant text-on-surface py-2 rounded-xl font-medium hover:bg-outline transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Pop up for Edit */}
      {editingSubId !== null && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-xl min-w-[320px] sm:min-w-[500px] shadow-xl">
            <h3 className="font-title-lg text-title-lg mb-4 text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">edit</span>
              Edit Link Tugas
            </h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Masukkan link Google Drive, Dropbox, atau lainnya. Anda bisa menambahkan lebih dari satu link dipisahkan dengan koma.
            </p>
            <textarea 
              value={editUrls}
              onChange={e => setEditUrls(e.target.value)}
              className="w-full bg-surface border border-outline-variant rounded-xl p-4 text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none mb-6 min-h-[100px] resize-y"
              placeholder="https://docs.google.com/... , https://drive.google.com/..."
            ></textarea>
            <div className="flex gap-3">
              <button 
                onClick={() => { setEditingSubId(null); setEditUrls(''); }}
                className="flex-1 bg-outline-variant/30 text-on-surface py-2.5 rounded-xl font-medium hover:bg-outline-variant/50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleUpdateLink}
                className="flex-1 bg-primary text-on-primary py-2.5 rounded-xl font-medium hover:bg-primary-container hover:text-on-primary-container transition-colors"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop up for Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm shadow-xl text-center">
            <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-4">
               <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
            <h3 className="font-title-lg text-title-lg mb-2 text-on-surface">Konfirmasi Hapus</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Apakah Anda yakin ingin menghapus data pengumpulan oleh ketua <strong className="text-on-surface">"{deleteConfirm.leaderName}"</strong>?<br/>Aksi ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-outline-variant text-on-surface py-2.5 rounded-xl font-medium hover:bg-outline-variant/30 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 bg-error text-white py-2.5 rounded-xl font-medium hover:bg-error/90 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
