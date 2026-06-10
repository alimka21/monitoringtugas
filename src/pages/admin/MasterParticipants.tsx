import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function MasterParticipants() {
  const [participants, setParticipants] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [classId, setClassId] = useState('');
  const [cityId, setCityId] = useState('');
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

  const [filterClass, setFilterClass] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterClass, filterCity, searchTerm]);

  // Import states
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importActId, setImportActId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failedCount: number;
    failures: { rowNum: number; rowData: string[]; reason: string }[];
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const SULSEL_CITIES = [
    'Kabupaten Bantaeng', 'Kabupaten Barru', 'Kabupaten Bone', 'Kabupaten Bulukumba',
    'Kabupaten Enrekang', 'Kabupaten Gowa', 'Kabupaten Jeneponto', 'Kabupaten Kepulauan Selayar',
    'Kabupaten Luwu', 'Kabupaten Luwu Timur', 'Kabupaten Luwu Utara', 'Kabupaten Maros',
    'Kabupaten Pangkajene dan Kepulauan', 'Kabupaten Pinrang', 'Kabupaten Sidenreng Rappang',
    'Kabupaten Sinjai', 'Kabupaten Soppeng', 'Kabupaten Takalar', 'Kabupaten Tana Toraja',
    'Kabupaten Toraja Utara', 'Kabupaten Wajo', 'Kota Makassar', 'Kota Palopo', 'Kota Parepare',
    'Sulawesi Selatan'
  ];

  const fetchData = async () => {
    try {
      const { data: existCities } = await supabase.from('cities').select('*');
      const missingCities = SULSEL_CITIES.filter(c => !existCities?.find((ec: any) => ec.name === c));
      
      if (missingCities.length > 0) {
        const inserts = missingCities.map(cityName => ({ name: cityName }));
        await supabase.from('cities').insert(inserts);
      }
    } catch (err) {
      console.error('Error seeding cities:', err);
    }

    const [pRes, cRes, aRes, cityRes] = await Promise.all([
      supabase.from('participants').select('*, classes(name), cities(name)'),
      supabase.from('classes').select('*').order('name'),
      supabase.from('activities').select('*').order('name'),
      supabase.from('cities').select('*').order('name')
    ]);
    if (pRes.data) setParticipants(pRes.data);
    if (cRes.data) setClasses(cRes.data);
    if (aRes.data) setActivities(aRes.data);
    if (cityRes.data) {
      const validCities = cityRes.data.filter((c: any) => SULSEL_CITIES.includes(c.name));
      const uniqueCities = validCities.reduce((acc: any[], current: any) => {
        if (!acc.find(item => item.name === current.name)) {
          acc.push(current);
        }
        return acc;
      }, []);
      setCities(uniqueCities);
    }
  };

  const handleEditClick = (p: any) => {
    setEditId(p.id);
    setName(p.name);
    setNumber(p.participant_number || '');
    setClassId(p.class_id || '');
    setCityId(p.city_id || '');
    setTimeout(() => {
      document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setName('');
    setNumber('');
    setClassId('');
    setCityId('');
  };

  const filteredParticipants = participants.filter(p => {
    const matchClass = !filterClass || p.class_id === filterClass;
    const matchCity = !filterCity || p.city_id === filterCity;
    const matchSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchCity && matchSearch;
  });

  const totalPages = Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE);
  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) {
      alert('Silahkan pilih kelas terlebih dahulu!');
      return;
    }
    if (!name) {
      alert('Nama peserta wajib diisi!');
      return;
    }
    setLoading(true);
    try {
      if (editId) {
        const { error } = await supabase.from('participants').update({ 
          name, 
          participant_number: number,
          class_id: classId,
          city_id: cityId || null
        }).eq('id', editId);
        if (error) throw error;
        alert('Data peserta berhasil diperbarui.');
      } else {
        const { error } = await supabase.from('participants').insert([{ 
          name, 
          participant_number: number,
          class_id: classId,
          city_id: cityId || null
        }]);
        if (error) throw error;
        alert('Data peserta berhasil disimpan.');
      }
      
      handleCancelEdit();
      fetchData();
    } catch (err: any) {
      console.error('Error saving participant:', err);
      if (err.code === '42P01') {
        alert('Error: Tabel "participants" belum dibuat di Supabase Anda. Silakan jalankan script SQL yang disediakan di panel query Supabase Anda.');
      } else if (err.code === '42703') {
        alert('Error: Kolom tambahan belum ada di tabel "participants". Silakan jalankan script SQL update_schema.sql di Supabase SQL Editor Anda.');
      } else {
        alert('Gagal menyimpan peserta: ' + (err.message || JSON.stringify(err)));
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    setLoading(true);
    try {
      // 1. Fetch counts of affected items
      const { data: leadSubs } = await supabase.from('submissions').select('id').eq('leader_id', id);
      const leadSubIds = leadSubs?.map(s => s.id) || [];
      
      const { data: memberSubs } = await supabase.from('submission_members').select('id').eq('participant_id', id);
      const memberSubCount = memberSubs?.length || 0;

      const { data: pStatuses } = await supabase.from('participant_task_status').select('id').eq('participant_id', id);
      const statusCount = pStatuses?.length || 0;

      setLoading(false);

      let warningMsg = `Apakah Anda yakin ingin menghapus peserta "${name}"?`;
      if (leadSubIds.length > 0 || memberSubCount > 0 || statusCount > 0) {
        warningMsg += `\n\nPERINGATAN: Menghapus peserta ini juga akan menghapus data relasi berikut:`;
        if (leadSubIds.length > 0) {
          warningMsg += `\n- ${leadSubIds.length} pengumpulan tugas kelompok (sebagai ketua kelompok)`;
        }
        if (memberSubCount > 0) {
          warningMsg += `\n- ${memberSubCount} data anggota kelompok di pengumpulan tugas`;
        }
        if (statusCount > 0) {
          warningMsg += `\n- ${statusCount} data progres/status penyelesaian tugas`;
        }
        warningMsg += `\n\nTindakan ini tidak bisa dibatalkan. Lanjutkan?`;
      } else {
        warningMsg += `\n\nPeserta ini belum memiliki riwayat tugas terkumpul atau progres. Lanjutkan hapus?`;
      }

      setConfirmModal({
        isOpen: true,
        title: 'Hapus Peserta',
        message: warningMsg,
        onConfirm: () => executeDelete(id, name, leadSubIds)
      });
    } catch (err: any) {
      console.error('Error fetching delete counts:', err);
      alert('Gagal menyiapkan penghapusan peserta: ' + err.message);
      setLoading(false);
    }
  };

  const executeDelete = async (id: string, name: string, leadSubIds: string[]) => {
    setLoading(true);
    try {
      // 2. Perform sequential, safe cascades
      // A. Delete participant from task progress status
      await supabase.from('participant_task_status').delete().eq('participant_id', id);

      // B. Delete participant as member of submissions
      await supabase.from('submission_members').delete().eq('participant_id', id);

      // C. If participant was a group leader, delete those submissions & their other class members
      if (leadSubIds.length > 0) {
        // delete submission_members of those group submissions first
        await supabase.from('submission_members').delete().in('submission_id', leadSubIds);
        // then delete the submissions themselves
        await supabase.from('submissions').delete().in('id', leadSubIds);
      }

      // D. Finally, delete the participant
      const { error } = await supabase.from('participants').delete().eq('id', id);
      if (error) throw error;

      if (editId === id) {
        handleCancelEdit();
      }

      alert(`Peserta "${name}" dan seluruh relasi tugasnya berhasil dihapus.`);
      fetchData();
    } catch (err: any) {
      console.error('Error deleting participant:', err);
      alert('Gagal menghapus peserta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
      const textRows = rows.map(r => r.join('\t')).join('\n');
      setImportText(textRows);
    } catch (err: any) {
      alert('Gagal membaca file: ' + err.message);
    }
  };

  const handleImport = async () => {
    if (!importText.trim() || !importActId) {
      alert('Pilih kegiatan dan masukkan data Excel.');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const rows = importText.trim().split('\n').map(r => {
        // Tab-separated or Comma-separated
        if (r.includes('\t')) return r.split('\t');
        if (r.includes(',')) return r.split(',');
        return [r];
      });
      
      // Skip header row if present
      let dataRows = rows;
      const firstRowFirstCol = rows[0]?.[0]?.toLowerCase() || '';
      if (firstRowFirstCol.includes('nama') || firstRowFirstCol.includes('name')) {
        dataRows = rows.slice(1);
      }
      
      // Fetch existing classes for the selected activity
      const { data: existClasses, error: classErr } = await supabase
        .from('classes')
        .select('*')
        .eq('activity_id', importActId);
      if (classErr) throw classErr;

      const classMap: Record<string, string> = {};
      existClasses?.forEach(c => {
        classMap[c.name.toLowerCase().trim()] = c.id;
      });

      // Fetch existing cities in database
      const { data: existCities, error: cityErr } = await supabase
        .from('cities')
        .select('*');
      if (cityErr) throw cityErr;

      const cityMap: Record<string, string> = {};
      existCities?.forEach(c => {
        cityMap[c.name.toLowerCase().trim()] = c.id;
      });

      // Fetch existing participants in database to check duplicates
      const { data: existParticipants, error: partErr } = await supabase
        .from('participants')
        .select('name, class_id, city_id');
      if (partErr) throw partErr;

      const existingDbKeys = new Set(
        (existParticipants || []).map(p => 
          `${p.name?.toLowerCase().trim()}|${p.class_id}|${p.city_id || ''}`
        )
      );

      const processedSessionKeys = new Set<string>();
      const successes: any[] = [];
      const failures: { rowNum: number; rowData: string[]; reason: string }[] = [];

      // Helper function to resolve City ID with prefix support
      const getCityId = (raw: string) => {
        const cleanRaw = raw.toLowerCase().trim();
        if (cityMap[cleanRaw]) return cityMap[cleanRaw];
        
        // Try resolving city by stripping prefixes like 'kabupaten' or 'kota'
        const cleanNoPrefix = cleanRaw.replace(/^(kabupaten|kota)\s+/, '');
        for (const [key, val] of Object.entries(cityMap)) {
          const keyNoPrefix = key.replace(/^(kabupaten|kota)\s+/, '');
          if (keyNoPrefix === cleanNoPrefix || key === cleanRaw) {
            return val;
          }
        }
        return null;
      };

      dataRows.forEach((r, idx) => {
        const rowNum = idx + (firstRowFirstCol.includes('nama') || firstRowFirstCol.includes('name') ? 2 : 1);
        
        // Skip completely empty rows
        if (r.length === 0 || r.every(col => !col?.trim())) {
          return;
        }

        const rawName = r[0]?.trim();
        const rawClass = r[1]?.trim();
        const rawCity = r[2]?.trim();
        const rawPhone = r[3]?.trim() || null;

        if (!rawName) {
          failures.push({ rowNum, rowData: r, reason: "Nama Kosong" });
          return;
        }

        if (!rawClass) {
          failures.push({ rowNum, rowData: r, reason: "Kelas Kosong" });
          return;
        }

        const matchedClassId = classMap[rawClass.toLowerCase().trim()];
        if (!matchedClassId) {
          failures.push({ 
            rowNum, 
            rowData: r, 
            reason: `Kelas "${rawClass}" belum terdaftar pada kegiatan ini` 
          });
          return;
        }

        if (!rawCity) {
          failures.push({ rowNum, rowData: r, reason: "Kabupaten/Kota Kosong" });
          return;
        }

        const matchedCityId = getCityId(rawCity);
        if (!matchedCityId) {
          failures.push({ 
            rowNum, 
            rowData: r, 
            reason: `Kabupaten/Kota "${rawCity}" tidak sesuai dengan pilihan di Sulawesi Selatan` 
          });
          return;
        }

        // Duplicate Check Combination: Name + Class + City
        const key = `${rawName.toLowerCase().trim()}|${matchedClassId}|${matchedCityId}`;

        if (existingDbKeys.has(key)) {
          failures.push({ 
            rowNum, 
            rowData: r, 
            reason: `Duplikasi: Peserta dengan Nama, Kelas, dan Kab/Kota tersebut sudah terdaftar di sistem` 
          });
          return;
        }

        if (processedSessionKeys.has(key)) {
          failures.push({ 
            rowNum, 
            rowData: r, 
            reason: `Duplikasi baris: Data peserta sama dengan baris lain di Excel` 
          });
          return;
        }

        processedSessionKeys.add(key);

        successes.push({
          name: rawName,
          class_id: matchedClassId,
          city_id: matchedCityId,
          participant_number: rawPhone
        });
      });

      let insertedCount = 0;
      if (successes.length > 0) {
        const { error: insertErr } = await supabase.from('participants').insert(successes);
        if (insertErr) throw insertErr;
        insertedCount = successes.length;
      }

      setImportResult({
        successCount: insertedCount,
        failedCount: failures.length,
        failures: failures
      });

      // Clear input and reload data
      setImportText('');
      fetchData();
    } catch (err: any) {
      console.error('Error importing:', err);
      alert('Terjadi kesalahan saat memproses import: ' + err.message);
    }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const wsData = [
      ["Nama", "Kelas", "Kabupaten/Kota", "Nomor WA"],
      ["Andi Wijaya", "Kelas Eksekutif A", "Kota Makassar", "08123456789"],
      ["Siti Aminah", "Kelas Eksekutif B", "Kabupaten Gowa", "08987654321"],
      ["Budi Santoso", "Kelas Eksekutif A", "Kabupaten Maros", "082222333444"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Add reference sheet listing all permitted SULSEL_CITIES
    const refData = [
      ["Daftar Kabupaten/Kota Se-Sulawesi Selatan (Wajib ditulis sama persis seperti list di bawah)"],
      ...SULSEL_CITIES.map(c => [c])
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Peserta");
    XLSX.utils.book_append_sheet(wb, wsRef, "Daftar Kab-Kota SulSel");
    XLSX.writeFile(wb, "Template_Import_Peserta.xlsx");
  };



  return (
    <div className="space-y-lg max-w-[1400px] w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Manajemen Data Peserta</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Manage and monitor all student participants across various regions and classes.</p>
        </div>
        <div className="flex gap-sm">
          <button 
            onClick={downloadTemplate}
            className="border border-outline-variant text-on-surface-variant bg-surface px-lg py-2 rounded-lg font-label-md flex items-center gap-xs hover:bg-surface-variant/30 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            Download Template
          </button>

          <button 
            onClick={() => setShowImport(true)}
            className="bg-primary-container text-on-primary-container px-lg py-2 rounded-lg font-label-md flex items-center gap-xs hover:bg-primary-container/80 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            Import Data Excel
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-lg">
        <div className="md:col-span-1" id="form-section">
          <div className={`bg-surface-container-lowest border rounded-xl overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.1)] transition-all sticky top-24 ${editId ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-outline-variant'}`}>
            <div className={`p-lg border-b bg-surface-container-low/50 flex items-center justify-between ${editId ? 'border-amber-500 bg-amber-500/5 text-amber-900' : 'border-outline-variant'}`}>
              <h3 className="font-title-lg text-title-lg font-semibold flex items-center gap-2">
                {editId ? (
                  <>
                    <span className="material-symbols-outlined text-amber-600">edit_note</span>
                    Edit Peserta
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-primary">person_add</span>
                    Tambah Peserta
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
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Nama Lengkap</label>
                  <input 
                    type="text"
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                    className="w-full px-4 py-2 bg-surface cursor-text border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Nomor WA (Opsional)</label>
                  <input 
                    type="text"
                    value={number} 
                    onChange={e => setNumber(e.target.value)} 
                    className="w-full px-4 py-2 bg-surface cursor-text border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Kelas</label>
                  <div className="relative">
                    <select 
                      value={classId} 
                      onChange={e => setClassId(e.target.value)} 
                      required
                      className="w-full px-4 py-2 bg-surface appearance-none border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
                    >
                      <option value="">Pilih Kelas...</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Kabupaten/Kota</label>
                  <div className="relative">
                    <select 
                      value={cityId} 
                      onChange={e => setCityId(e.target.value)} 
                      required
                      className="w-full px-4 py-2 bg-surface appearance-none border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
                    >
                      <option value="">Pilih Kota...</option>
                      {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 py-2 bg-primary text-on-primary rounded-lg font-medium hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {editId ? 'Simpan Perubahan' : 'Simpan Peserta'}
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
        
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
             <div className="flex-1 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
                <input 
                  type="text" 
                  placeholder="Cari nama peserta..." 
                  className="w-full bg-surface border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
             <div className="w-full sm:w-48 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">class</span>
                <select 
                  className="w-full bg-surface border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none"
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
                >
                  <option value="">Semua Kelas</option>
                  {classes.map(c => (
                     <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
             </div>
             <div className="w-full sm:w-48 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">location_city</span>
                <select 
                  className="w-full bg-surface border border-outline-variant rounded-xl pl-10 pr-4 py-2.5 text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none"
                  value={filterCity}
                  onChange={e => setFilterCity(e.target.value)}
                >
                  <option value="">Semua Kota</option>
                  {cities.map(c => (
                     <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
             </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto flex-1 h-full">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low/50">
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Nama Peserta</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Kelas</th>
                    <th className="px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Kab/Kota</th>
                    <th className="text-right px-lg py-md font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {paginatedParticipants.map(p => (
                    <tr key={p.id} className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="px-lg py-4">
                        <Link to={`/admin/track/participant/${p.id}`} className="flex items-center gap-3 hover:bg-surface-variant/30 p-1.5 -ml-1.5 rounded-lg transition-colors w-fit">
                          <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold text-label-md shrink-0">
                            {p.name.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-body-md text-body-md font-semibold text-primary group-hover:underline">{p.name}</p>
                            <p className="text-label-md text-on-surface-variant">WA: {p.participant_number || '-'}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-lg py-4 font-body-md text-body-md">{p.classes?.name}</td>
                      <td className="px-lg py-4 font-body-md text-body-md text-on-surface-variant">{p.cities?.name || '-'}</td>
                      <td className="px-lg py-4 text-right">
                        <button 
                          className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container rounded-lg transition-all mr-1"
                          onClick={() => handleEditClick(p)}
                          title="Edit Peserta"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </button>
                        <button 
                          className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-all"
                          onClick={() => handleDelete(p.id, p.name)}
                          title="Hapus Peserta"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedParticipants.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-lg py-8 text-center text-slate-500">Belum ada data peserta sesuai filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="px-lg py-md bg-surface-container-low/30 border-t border-outline-variant mt-auto flex items-center justify-between">
              <p className="text-label-md text-on-surface-variant">
                Menampilkan <span className="font-bold text-on-surface">{paginatedParticipants.length}</span> dari <span className="font-bold text-on-surface">{filteredParticipants.length}</span> peserta
              </p>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-variant/30 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <span className="text-label-md font-medium text-on-surface px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-variant/30 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                     <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-md bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-2xl shadow-xl w-[95vw] md:w-[600px] lg:w-[750px] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-xl py-lg border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <h3 className="font-title-lg text-title-lg font-bold text-on-surface">Import Data Peserta</h3>
              <button 
                onClick={() => { setShowImport(false); setImportResult(null); }}
                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 p-2 rounded-full transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-xl overflow-y-auto flex-1 space-y-md">
              {importResult ? (
                <div className="space-y-lg">
                  <div className="p-lg bg-emerald-100 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-md">
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[32px]">check_circle</span>
                    <div>
                      <h4 className="font-semibold text-emerald-950 dark:text-emerald-200">Import Selesai</h4>
                      <p className="text-sm text-emerald-900 dark:text-emerald-350">Berhasil mengimpor <span className="font-bold">{importResult.successCount}</span> data peserta ke dalam sistem.</p>
                    </div>
                  </div>

                  {importResult.failedCount > 0 ? (
                    <div className="space-y-sm">
                      <div className="p-lg bg-red-100 dark:bg-red-950/20 border border-red-300 dark:border-red-900 rounded-xl flex items-center gap-md">
                        <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-[32px]">error</span>
                        <div>
                          <h4 className="font-semibold text-red-950 dark:text-red-200">Terjadi Kesalahan ({importResult.failedCount} Baris Gagal)</h4>
                          <p className="text-xs text-red-900 dark:text-red-350">Beberapa baris di bawah ini dilewati karena kelas tidak ada di kegiatan ini, duplikasi peserta, atau format tidak lengkap.</p>
                        </div>
                      </div>

                      <div className="border border-outline-variant rounded-xl overflow-hidden max-h-[250px] overflow-y-auto shadow-inner bg-surface-container-lowest">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-surface-container-low border-b border-outline-variant sticky top-0">
                              <th className="p-3 font-semibold text-on-surface-variant w-[80px]">Baris</th>
                              <th className="p-3 font-semibold text-on-surface-variant">Data Excel</th>
                              <th className="p-3 font-semibold text-on-surface-variant">Alasan Gagal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant">
                            {importResult.failures.map((f, i) => (
                              <tr key={i} className="hover:bg-red-50/25 dark:hover:bg-red-950/5 transition-colors">
                                <td className="p-3 font-medium text-on-surface-variant">Baris {f.rowNum}</td>
                                <td className="p-3 font-mono text-[11px] text-on-surface-variant truncate max-w-[220px]" title={f.rowData.join(' | ')}>
                                  {f.rowData.join(' | ')}
                                </td>
                                <td className="p-3 text-red-600 dark:text-red-400 font-semibold">{f.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div>
                    <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Pilih Kegiatan (Terlebih Dahulu)</label>
                    <div className="relative">
                      <select 
                        value={importActId} 
                        onChange={e => setImportActId(e.target.value)} 
                        className="w-full px-4 py-2 bg-surface appearance-none border border-outline-variant rounded-lg text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all cursor-pointer"
                      >
                        <option value="">Pilih Kegiatan...</option>
                        {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                    </div>
                    <span className="text-xs text-on-surface-variant mt-1 block">Peserta hanya bisa diimpor ke kelas yang sudah ada di dalam kegiatan ini. Silakan tambahkan kelas terlebih dahulu di menu <b>Master Kelas</b> jika belum ada.</span>
                  </div>

                  <div>
                    <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Upload File .xlsx</label>
                    <div className="flex items-center gap-3 mb-2">
                       <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-container file:text-primary hover:file:bg-primary/20" />
                    </div>
                    <label className="font-label-md text-label-md text-on-surface-variant mb-1 block">Atau Paste Data Di Sini</label>
                    <textarea 
                      value={importText}
                      onChange={e => setImportText(e.target.value)}
                      placeholder="Andi Wijaya&#9;Kelas Eksekutif A&#9;Kota Makassar&#9;08123456789"
                      className="w-full h-32 px-4 py-3 bg-surface border border-outline-variant rounded-xl text-body-md font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none whitespace-pre"
                    ></textarea>
                  </div>
                </>
              )}
            </div>

            <div className="px-xl py-lg border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-md shrink-0">
              {importResult ? (
                <>
                  <button 
                    onClick={() => setImportResult(null)}
                    className="px-lg py-2 border border-outline-variant text-on-surface-variant hover:bg-surface-variant/30 rounded-lg font-label-md transition-all"
                  >
                    Import File Lain
                  </button>
                  <button 
                    onClick={() => {
                      setImportResult(null);
                      setShowImport(false);
                    }}
                    className="px-lg py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 transition-all"
                  >
                    Selesai
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setShowImport(false)}
                    className="px-lg py-2 text-on-surface-variant hover:bg-surface-variant/30 rounded-lg font-label-md transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleImport}
                    disabled={importing || !importText || !importActId}
                    className="px-lg py-2 bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-xs"
                  >
                    {importing ? 'Memproses...' : 'Proses Import'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
