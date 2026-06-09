-- Supabase PostgreSQL Database Schema for Sistem Tugas

-- Hapus tabel yang ada jika perlu (hati-hati di environment production)
DROP TABLE IF EXISTS participant_task_status CASCADE;
DROP TABLE IF EXISTS submission_members CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS cities CASCADE;
DROP TABLE IF EXISTS activities CASCADE;

-- Tabel Activities
CREATE TABLE activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Cities
CREATE TABLE cities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Classes
CREATE TABLE classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Participants
CREATE TABLE participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Submissions
CREATE TABLE submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Submission Members (untuk mencatat anggota yang mengumpulkan bersama ketua)
CREATE TABLE submission_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabel Participant Task Status (untuk mencatat status progres setiap tugas untuk setiap peserta)
CREATE TABLE participant_task_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Unsubmitted',
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(participant_id, task_id)
);

-- RLS (Row Level Security) Configuration
-- Jika Anda ingin membuat semuanya bisa dibaca/tulis secara public (karena ini prototype tanpa user auth supabase):
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_task_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access on activities" ON activities;
DROP POLICY IF EXISTS "Allow public all access on cities" ON cities;
DROP POLICY IF EXISTS "Allow public all access on classes" ON classes;
DROP POLICY IF EXISTS "Allow public all access on participants" ON participants;
DROP POLICY IF EXISTS "Allow public all access on tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public all access on submissions" ON submissions;
DROP POLICY IF EXISTS "Allow public all access on submission_members" ON submission_members;
DROP POLICY IF EXISTS "Allow public all access on participant_task_status" ON participant_task_status;

CREATE POLICY "Allow public all access on activities" ON activities FOR ALL USING (true);
CREATE POLICY "Allow public all access on cities" ON cities FOR ALL USING (true);
CREATE POLICY "Allow public all access on classes" ON classes FOR ALL USING (true);
CREATE POLICY "Allow public all access on participants" ON participants FOR ALL USING (true);
CREATE POLICY "Allow public all access on tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow public all access on submissions" ON submissions FOR ALL USING (true);
CREATE POLICY "Allow public all access on submission_members" ON submission_members FOR ALL USING (true);
CREATE POLICY "Allow public all access on participant_task_status" ON participant_task_status FOR ALL USING (true);

-- Storage (Opsional, jika Anda memerlukan upload file langsung ke supabase storage)
-- Pastikan Anda membuat bucket bernama 'tugas' di Supabase Studio Storage
-- INSERT INTO storage.buckets (id, name, public) VALUES ('tugas', 'tugas', true);
