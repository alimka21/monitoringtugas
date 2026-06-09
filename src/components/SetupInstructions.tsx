import React, { useState } from 'react';

export function SetupInstructions() {
  const [copied, setCopied] = useState(false);

  const sqlCode = `
-- Create tables
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organizer TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  participant_number TEXT,
  phone_number TEXT,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'Individu',
  deadline TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  leader_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  UNIQUE(submission_id, participant_id)
);

CREATE TABLE IF NOT EXISTS participant_task_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Unsubmitted',
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(participant_id, task_id)
);

-- RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_task_status ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access for easy setup/prototype use
DROP POLICY IF EXISTS "Allow public all access on activities" ON activities;
DROP POLICY IF EXISTS "Allow public all access on classes" ON classes;
DROP POLICY IF EXISTS "Allow public all access on cities" ON cities;
DROP POLICY IF EXISTS "Allow public all access on participants" ON participants;
DROP POLICY IF EXISTS "Allow public all access on tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public all access on submissions" ON submissions;
DROP POLICY IF EXISTS "Allow public all access on submission_members" ON submission_members;
DROP POLICY IF EXISTS "Allow public all access on participant_task_status" ON participant_task_status;

CREATE POLICY "Allow public all access on activities" ON activities FOR ALL USING (true);
CREATE POLICY "Allow public all access on classes" ON classes FOR ALL USING (true);
CREATE POLICY "Allow public all access on cities" ON cities FOR ALL USING (true);
CREATE POLICY "Allow public all access on participants" ON participants FOR ALL USING (true);
CREATE POLICY "Allow public all access on tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow public all access on submissions" ON submissions FOR ALL USING (true);
CREATE POLICY "Allow public all access on submission_members" ON submission_members FOR ALL USING (true);
CREATE POLICY "Allow public all access on participant_task_status" ON participant_task_status FOR ALL USING (true);

-- Admin full access to all (for auth session safety)
DROP POLICY IF EXISTS "Admin full access activities" ON activities;
DROP POLICY IF EXISTS "Admin full access classes" ON classes;
DROP POLICY IF EXISTS "Admin full access cities" ON cities;
DROP POLICY IF EXISTS "Admin full access participants" ON participants;
DROP POLICY IF EXISTS "Admin full access tasks" ON tasks;
DROP POLICY IF EXISTS "Admin full access submissions" ON submissions;
DROP POLICY IF EXISTS "Admin full access submission members" ON submission_members;
DROP POLICY IF EXISTS "Admin full access participant task status" ON participant_task_status;

CREATE POLICY "Admin full access activities" ON activities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access classes" ON classes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access cities" ON cities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access participants" ON participants FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access tasks" ON tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access submissions" ON submissions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access submission members" ON submission_members FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admin full access participant task status" ON participant_task_status FOR ALL USING (auth.role() = 'authenticated');

-- Storage bucket
insert into storage.buckets (id, name, public) values ('task-files', 'task-files', true) on conflict (id) do nothing;
DROP POLICY IF EXISTS "Public storage upload" ON storage.objects;
DROP POLICY IF EXISTS "Public storage read" ON storage.objects;
DROP POLICY IF EXISTS "Admin full access storage" ON storage.objects;

CREATE POLICY "Public storage upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'task-files');
CREATE POLICY "Public storage read" ON storage.objects FOR SELECT USING (bucket_id = 'task-files');
CREATE POLICY "Admin full access storage" ON storage.objects ALL USING (auth.role() = 'authenticated');
  `.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-[48rem] mx-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-8 border-b border-slate-200 bg-indigo-50">
          <h2 className="text-2xl font-bold text-indigo-900 mb-2">Supabase Configuration Required</h2>
          <p className="text-indigo-700">Please connect your Supabase project to continue.</p>
        </div>
        
        <div className="p-6 space-y-8">
          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">1. Environment Variables</h3>
            <p className="text-sm text-slate-600 mb-4">
              Open the <strong>Settings</strong> panel in AI Studio, go to <strong>Secrets</strong>, and add the following keys from your Supabase project (Project Settings &gt; API):
            </p>
            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-2">
              <li><code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">VITE_SUPABASE_URL</code> : Your Project URL</li>
              <li><code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">VITE_SUPABASE_ANON_KEY</code> : Your Project API Key (anon/public)</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">2. Setup Database Schema</h3>
            <p className="text-sm text-slate-600 mb-4">
              Run the following SQL in your Supabase SQL Editor. This will create tables, setup Row Level Security (RLS), and create the storage bucket.
            </p>
            <div className="relative group">
              <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-96">
                <code>{sqlCode}</code>
              </pre>
              <button 
                onClick={handleCopy}
                className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs transition-colors"
              >
                {copied ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">3. Create Admin User</h3>
            <p className="text-sm text-slate-600">
              Go to Supabase <strong>Authentication &gt; Users</strong> and explicitly add one user. 
              This user will be your dashboard admin.
            </p>
          </section>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-sm font-medium text-amber-600">
              After configuring secrets, the application might need a restart or page reload to apply the env variables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
