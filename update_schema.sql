-- Fix the missing columns from the first migration
ALTER TABLE activities ADD COLUMN IF NOT EXISTS organizer TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'Individu';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;

ALTER TABLE participants ADD COLUMN IF NOT EXISTS participant_number TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- For auto-seeding cities
TRUNCATE TABLE cities CASCADE;
INSERT INTO cities (name) VALUES
('Kepulauan Selayar'),
('Bulukumba'),
('Bantaeng'),
('Jeneponto'),
('Takalar'),
('Gowa'),
('Sinjai'),
('Maros'),
('Pangkajene dan Kepulauan'),
('Barru'),
('Bone'),
('Soppeng'),
('Wajo'),
('Sidenreng Rappang'),
('Pinrang'),
('Enrekang'),
('Luwu'),
('Tana Toraja'),
('Luwu Utara'),
('Luwu Timur'),
('Toraja Utara'),
('Kota Makassar'),
('Kota Parepare'),
('Kota Palopo')
ON CONFLICT DO NOTHING;
