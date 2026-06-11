import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { SetupInstructions } from '@/components/SetupInstructions';
import { PublicLayout, AdminLayout } from '@/components/Layout';

// Placeholder Pages
import LandingPage from '@/pages/LandingPage';
import Login from '@/pages/Login';
import UploadTugas from '@/pages/UploadTugas';
import Dashboard from '@/pages/admin/Dashboard';
import TrackTugas from '@/pages/admin/TrackTugas';
import MasterTasks from '@/pages/admin/MasterTasks';
import MasterParticipants from '@/pages/admin/MasterParticipants';
import MasterClasses from '@/pages/admin/MasterClasses';
import MasterActivities from '@/pages/admin/MasterActivities';
import ParticipantDetail from '@/pages/admin/ParticipantDetail';
import DataPengumpulan from '@/pages/admin/DataPengumpulan';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuth = localStorage.getItem('isAuth');
  if (!isAuth) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  if (!isSupabaseConfigured()) {
    return <SetupInstructions />;
  }

  return (
    <Router>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/upload" element={<UploadTugas />} />
        </Route>
        
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="track" element={<TrackTugas />} />
          <Route path="track/participant/:id" element={<ParticipantDetail />} />
          <Route path="tasks" element={<MasterTasks />} />
          <Route path="submissions" element={<DataPengumpulan />} />
          <Route path="participants" element={<MasterParticipants />} />
          <Route path="classes" element={<MasterClasses />} />
          <Route path="activities" element={<MasterActivities />} />
        </Route>
      </Routes>
    </Router>
  );
}
