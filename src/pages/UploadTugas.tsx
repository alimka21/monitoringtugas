import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function UploadTugas() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  
  const [taskType, setTaskType] = useState<'individu' | 'kelompok'>('individu');
  const [activityId, setActivityId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [classId, setClassId] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>(['']);
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submissionId, setSubmissionId] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (activityId) {
      supabase.from('tasks').select('*').eq('is_active', true).eq('activity_id', activityId).then(res => {
        if (res.data) setTasks(res.data);
      });
      supabase.from('classes').select('*').eq('activity_id', activityId).order('name').then(res => {
        if (res.data) setClasses(res.data);
      });
    } else {
      setTasks([]);
      setClasses([]);
    }
    setTaskId('');
    setClassId('');
    setParticipants([]);
    setLeaderId('');
    setMemberIds([]);
  }, [activityId]);

  useEffect(() => {
    if (classId) fetchParticipants(classId);
    else {
      setParticipants([]);
      setLeaderId('');
      setMemberIds([]);
    }
  }, [classId]);

  useEffect(() => {
    setMemberIds([]);
  }, [taskType]);

  const fetchInitialData = async () => {
    const { data } = await supabase.from('activities').select('*').order('name');
    if (data) setActivities(data);
  };

  const fetchParticipants = async (cId: string) => {
    const { data } = await supabase.from('participants').select('*').eq('class_id', cId).order('name');
    if (data) {
      setParticipants(data);
    } else {
      setParticipants([]);
    }
    setLeaderId('');
    setMemberIds([]);
  };

  const handleLeaderChange = (newLeaderId: string) => {
    setLeaderId(newLeaderId);
    setMemberIds(prev => prev.filter(id => id !== newLeaderId));
  };

  const handleMemberSlotChange = (index: number, val: string) => {
    const newMembers = [...memberIds];
    newMembers[index] = val;
    setMemberIds(newMembers);
  };

  const addMemberSlot = () => {
    setMemberIds([...memberIds, '']);
  };

  const removeMemberSlot = (index: number) => {
    const newMembers = [...memberIds];
    newMembers.splice(index, 1);
    setMemberIds(newMembers);
  };

  const handleFileUrlChange = (index: number, val: string) => {
    const newUrls = [...fileUrls];
    newUrls[index] = val;
    setFileUrls(newUrls);
  };

  const addFileUrlSlot = () => {
    if (fileUrls.length < 3) {
      setFileUrls([...fileUrls, '']);
    } else {
      setError('Maksimal 3 link yang dapat ditambahkan.');
    }
  };

  const removeFileUrlSlot = (index: number) => {
    const newUrls = [...fileUrls];
    newUrls.splice(index, 1);
    setFileUrls(newUrls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validUrls = fileUrls.filter(u => u.trim() !== '');
    if (!taskId || !classId || !leaderId || validUrls.length === 0) {
      setError('Mohon lengkapi semua field dan masukkan setidaknya satu URL file.');
      return;
    }

    try {
      for (const furl of validUrls) {
        const parsedUrl = new URL(furl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          setError('URL harus menggunakan protokol http:// atau https://');
          return;
        }
      }
    } catch {
      setError('Format URL tidak valid. Pastikan link diawali dengan http:// atau https://');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const joinedUrls = validUrls.join(', ');

      // 2. Insert Submission
      const { data: subData, error: subError } = await supabase.from('submissions')
        .insert([{
          task_id: taskId,
          class_id: classId,
          leader_id: leaderId,
          file_name: validUrls.length > 1 ? 'Multiple Links' : validUrls[0],
          file_url: joinedUrls
        }])
        .select()
        .single();

      if (subError) throw subError;
      
      console.log("subData:", subData);
      if (!subData) {
         throw new Error("Gagal mendapatkan ID pengumpulan dari database.");
      }

      // 3. Insert Members
      const cleanMembers = memberIds.filter(m => m.trim() !== '');
      const allMembers = [leaderId, ...cleanMembers];
      const memberInserts = cleanMembers.map(mId => ({
        submission_id: subData.id,
        participant_id: mId
      }));

      if (memberInserts.length > 0) {
        const { error: memError } = await supabase.from('submission_members').insert(memberInserts);
        if (memError) console.error("Error inserting members:", memError);
      }

      // 4. Update Progress
      const statusInserts = allMembers.map(pId => ({
        participant_id: pId,
        task_id: taskId,
        submission_id: subData.id
      }));

      const { error: statusError } = await supabase.from('participant_task_status').upsert(statusInserts, { onConflict: 'participant_id,task_id' });
      
      if (statusError) throw statusError;
      setSubmissionId(subData.id);

      setSuccess(true);
      
      setTaskId('');
      setClassId('');
      setLeaderId('');
      setMemberIds([]);
      setFileUrls(['']);
      
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyimpan data.');
      console.error(err);
    }
    
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex-grow flex items-center justify-center p-4 min-h-[500px]">
        <div className="max-w-[28rem] w-full text-center bg-surface-container-lowest rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border border-outline-variant p-2xl">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-emerald-500 text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Berhasil!</h2>
          <p className="text-slate-500 mb-6">Tugas Anda telah tersimpan ke dalam sistem dan progres semua anggota telah diperbarui.</p>
          <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600 font-mono mb-8 border border-slate-200">
            ID: {submissionId}
          </div>
          <button 
            className="w-full py-3 bg-primary text-on-primary rounded-xl font-medium hover:bg-primary/90 transition-colors"
            onClick={() => setSuccess(false)}
          >
            Upload Tugas Lain
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start py-xl md:py-3xl px-md">
      <header className="text-center mb-xl max-w-[42rem]">
        <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight mb-sm">Kirim Tugas</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Unggah file tugas Anda dengan mudah dan pantau progres pengiriman secara real-time.</p>
      </header>

      <div className="w-full max-w-[48rem] bg-surface-container-lowest rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] border border-outline-variant p-xl md:p-2xl">
        <form onSubmit={handleSubmit} className="space-y-xl">
          {error && (
            <div className="p-4 bg-error-container text-on-error-container text-sm rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-xs">
            <label className="font-label-md text-label-md text-on-surface-variant ml-1">Tipe Tugas</label>
            <div className="relative">
              <select 
                value={taskType} 
                onChange={e => setTaskType(e.target.value)} 
                className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-lg py-md text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer transition-shadow shadow-xs"
              >
                <option value="individu">Tugas Individu</option>
                <option value="kelompok">Tugas Kelompok</option>
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
            </div>
          </div>

          <div className="space-y-xs">
            <label className="font-label-md text-label-md text-on-surface-variant ml-1">Pilih Kegiatan</label>
            <div className="relative">
              <select 
                value={activityId} 
                onChange={e => setActivityId(e.target.value)} 
                required
                className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-lg py-md text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer transition-shadow shadow-xs"
              >
                <option value="" disabled>Pilih kegiatan...</option>
                {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-1">Pilih Tugas</label>
              <div className="relative">
                <select 
                  value={taskId} 
                  onChange={e => setTaskId(e.target.value)} 
                  required
                  className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-lg py-md text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer transition-shadow shadow-xs"
                >
                  <option value="" disabled>Pilih kegiatan tugas...</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
              </div>
            </div>

            <div className="space-y-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-1">Pilih Kelas</label>
              <div className="relative">
                <select 
                  value={classId} 
                  onChange={e => setClassId(e.target.value)} 
                  required
                  className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-lg py-md text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer transition-shadow shadow-xs"
                >
                  <option value="" disabled>Pilih kode kelas...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
              </div>
            </div>
          </div>

          {classId && participants.length > 0 && (
            <div className="space-y-lg border border-outline-variant/60 rounded-xl p-lg bg-surface-container-lowest shadow-xs">
              <div className="space-y-xs">
                 <label className="font-label-md text-label-md text-on-surface-variant ml-1">
                   {taskType === 'individu' ? 'Pilih Peserta (Anda)' : 'Ketua Kelompok (Pengunggah)'}
                 </label>
                 <div className="relative">
                  <select 
                    value={leaderId} 
                    onChange={e => handleLeaderChange(e.target.value)} 
                    required
                    className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-lg py-md text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer"
                  >
                    <option value="" disabled>-- Pilih Nama --</option>
                    {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                </div>
              </div>

              {taskType === 'kelompok' && leaderId && (
                <div className="space-y-xs">
                  <label className="font-label-md text-label-md text-on-surface-variant ml-1">Anggota Tim Lainnya</label>
                  <p className="text-[11px] text-outline ml-1 italic mb-2">Pilih teman-teman sekelompok agar histori progres mereka diperbarui.</p>
                  
                  <div className="space-y-3">
                    {memberIds.map((mId, index) => (
                      <div key={index} className="flex items-center gap-2">
                         <div className="relative flex-1">
                          <select 
                            value={mId} 
                            onChange={e => handleMemberSlotChange(index, e.target.value)} 
                            className="w-full appearance-none bg-surface border border-outline-variant rounded-xl px-lg py-md text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer"
                          >
                            <option value="">-- Pilih Nama --</option>
                            {participants.filter(p => p.id !== leaderId && (!memberIds.includes(p.id) || p.id === mId)).map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeMemberSlot(index)}
                          className="h-12 w-12 flex items-center justify-center bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors shrink-0"
                          title="Hapus"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    ))}
                    
                    <button 
                      type="button" 
                      onClick={addMemberSlot}
                      className="w-full border-2 border-dashed border-outline-variant hover:border-primary text-on-surface-variant hover:text-primary rounded-xl py-3 flex items-center justify-center gap-2 transition-colors font-medium text-sm"
                    >
                      <span className="material-symbols-outlined">add</span>
                      Tambah Anggota Lagi
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-md border border-outline-variant/60 rounded-xl p-lg bg-surface-container-lowest shadow-xs">
            <h3 className="font-title-lg text-title-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">link</span>
              Link Berkas Utama
            </h3>
            <p className="text-[13px] text-on-surface-variant leading-relaxed mb-4">
              Masukkan link GDrive, Dropbox, atau penyedia layanan file lainnya. Pastikan link dapat diakses oleh publik. Anda bisa menambahkan lebih dari satu link jika diperlukan.
            </p>

            <div className="space-y-3">
              {fileUrls.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input 
                    type="url" 
                    value={url}
                    onChange={e => handleFileUrlChange(index, e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="flex-1 w-full px-lg py-md bg-surface border border-outline-variant rounded-xl text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-shadow text-on-surface"
                    required={index === 0}
                  />
                  {index > 0 && (
                    <button 
                      type="button" 
                      onClick={() => removeFileUrlSlot(index)}
                      className="h-[52px] w-[52px] flex items-center justify-center bg-error/10 text-error rounded-xl hover:bg-error/20 transition-colors shrink-0"
                      title="Hapus Link"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  )}
                </div>
              ))}
              {fileUrls.length < 3 && (
                <button 
                  type="button" 
                  onClick={addFileUrlSlot}
                  className="w-full border border-dashed border-outline-variant hover:border-primary text-on-surface-variant hover:text-primary rounded-xl py-2 flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Tambah Link File Tambahan
                </button>
              )}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container font-title-lg text-title-lg py-md rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-md disabled:opacity-70 disabled:shadow-none"
          >
            <span>{loading ? 'Mengirim...' : 'Kirim Tugas Sekarang'}</span>
            <span className="material-symbols-outlined">{loading ? 'hourglass_empty' : 'send'}</span>
          </button>
        </form>
      </div>

      <div className="mt-2xl flex flex-col md:flex-row gap-lg max-w-[48rem] w-full">
        <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex items-start gap-md shadow-sm hover:shadow-md transition-shadow">
          <div className="p-sm bg-tertiary-fixed rounded-lg text-on-tertiary-fixed-variant">
            <span className="material-symbols-outlined">verified</span>
          </div>
          <div>
            <p className="font-label-md text-label-md font-bold text-on-surface">Validasi Otomatis</p>
            <p className="text-[13px] text-on-surface-variant mt-1">Sistem kami memeriksa format file Anda secara instan sebelum dikirim.</p>
          </div>
        </div>
        <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex items-start gap-md shadow-sm hover:shadow-md transition-shadow">
          <div className="p-sm bg-secondary-fixed rounded-lg text-on-secondary-fixed-variant">
            <span className="material-symbols-outlined">notifications_active</span>
          </div>
          <div>
            <p className="font-label-md text-label-md font-bold text-on-surface">Notifikasi Berhasil</p>
            <p className="text-[13px] text-on-surface-variant mt-1">Konfirmasi pengiriman akan dikirim ke dashboard admin setelah berhasil.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
