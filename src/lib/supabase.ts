import { createClient } from '@supabase/supabase-js';

const fallbackUrl = 'https://wudbuumsykjbvposijrg.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1ZGJ1dW1zeWtqYnZwb3NpanJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODk0MzgsImV4cCI6MjA5NjU2NTQzOH0.askr9-Ig15HION9XKA558OA_76L6O1R2jJgsl1fl_Nc';

const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL || fallbackUrl;
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || fallbackKey;

// Clean up URL to strip /rest/v1/ or /rest/v1 ends if present
let cleanUrl = rawUrl.trim();
if (cleanUrl.endsWith('/rest/v1/')) {
  cleanUrl = cleanUrl.slice(0, -9);
} else if (cleanUrl.endsWith('/rest/v1')) {
  cleanUrl = cleanUrl.slice(0, -8);
}

const supabaseUrl = cleanUrl;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials are not configured.');
}

export const isSupabaseConfigured = () => {
  return supabaseUrl && supabaseUrl.trim() !== '' && supabaseKey && supabaseKey.trim() !== '';
};

export const supabase = createClient(supabaseUrl, supabaseKey);

