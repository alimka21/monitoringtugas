import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    localStorage.removeItem('isAuth');
    navigate('/login');
  };

    const navItems = [
    { name: 'Dashboard', path: '/admin', icon: 'dashboard' },
    { name: 'Monitoring Peserta', path: '/admin/track', icon: 'monitoring' },
    { name: 'Data Kegiatan', path: '/admin/activities', icon: 'event' },
    { name: 'Data Tugas', path: '/admin/tasks', icon: 'assignment' },
    { name: 'Data Pengumpulan', path: '/admin/submissions', icon: 'data_check' },
    { name: 'Data Kelas', path: '/admin/classes', icon: 'school' },
    { name: 'Data Peserta', path: '/admin/participants', icon: 'group' },
  ];

  return (
    <div className="flex min-h-screen bg-background font-sans text-on-surface">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-[280px] bg-surface border-r border-outline-variant shadow-sm flex flex-col p-lg z-50">
        <div className="mb-3xl">
          <div className="flex items-center gap-3">
            <img src="https://upload.wikimedia.org/wikipedia/commons/9/9c/Logo_of_Ministry_of_Education_and_Culture_of_Republic_of_Indonesia.svg" alt="Logo" className="h-8 w-8 object-contain" />
            <div>
              <h1 className="text-title-lg font-title-lg font-bold text-primary leading-tight">Monitoring Tugas</h1>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Admin Console</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-secondary-container text-on-secondary-container font-medium scale-[0.98]' 
                    : 'text-on-surface-variant hover:bg-surface-container-high group'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                  {item.icon}
                </span>
                <span className="font-label-md text-label-md">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        

      </aside>

      {/* Main Content Wrapper */}
      <div className="ml-[280px] flex-1 flex flex-col min-h-screen">
        {/* TopNavBar */}
        <header className="sticky top-0 z-40 w-full bg-surface/80 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-lg py-md h-16">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-[28rem] group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">search</span>
              <input 
                type="text" 
                className="w-full bg-surface-container-low border-none rounded-full pl-10 pr-4 py-2 text-body-md font-body-md focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
                placeholder="Global Search..."
              />
            </div>
          </div>
          <div className="flex items-center gap-md">
            <button className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface"></span>
            </button>
            <div className="h-8 w-px bg-outline-variant mx-2"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="font-label-md text-label-md font-bold text-on-surface leading-tight">Admin Principal</p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">System Master</p>
              </div>
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 px-4 h-10 rounded-full bg-error-container text-on-error-container hover:bg-error hover:text-error-container transition-colors shadow-sm cursor-pointer font-label-md" 
                title="Logout"
              >
                <span className="material-symbols-outlined text-[20px] mb-[-2px]">logout</span>
                Keluar
              </button>
            </div>
          </div>
        </header>

        <main className="p-xl flex-1 flex flex-col">
          <div className="max-w-[1400px] w-full mx-auto flex-1 flex flex-col">
            <Outlet />
          </div>
          
          <footer className="w-full py-xl mt-auto bg-transparent border-t border-outline-variant mt-xl">
            <div className="flex justify-center items-center">
              <p className="font-body-md text-body-md text-on-surface-variant text-center">
                &copy; {new Date().getFullYear()} Sistem Monitoring Tugas. All rights reserved.
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export function PublicLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col font-sans bg-background text-on-surface">
      {location.pathname !== '/login' && (
        <nav className="sticky top-0 z-40 w-full bg-surface/80 backdrop-blur-md border-b border-outline-variant px-lg py-md">
          <div className="max-w-[80rem] mx-auto flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2">
              <img src="https://upload.wikimedia.org/wikipedia/commons/9/9c/Logo_of_Ministry_of_Education_and_Culture_of_Republic_of_Indonesia.svg" alt="Logo" className="h-8 w-8 object-contain" />
              <span className="font-title-lg text-title-lg font-black text-primary">Monitoring Tugas</span>
            </Link>
            <div className="flex items-center gap-md">
              <Link to="/upload" className="text-on-surface-variant hover:text-primary transition-colors font-label-md text-label-md border-b-2 border-transparent hover:border-primary pb-1">Upload Tugas</Link>
              <Link to="/login" className="bg-primary text-on-primary px-lg py-sm rounded-lg font-label-md text-label-md transition-transform active:scale-95 shadow-sm">
                Login Admin
              </Link>
            </div>
          </div>
        </nav>
      )}

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {location.pathname !== '/login' && (
        <footer className="w-full py-2xl bg-surface-container-lowest mt-auto border-t border-outline-variant">
          <div className="max-w-[80rem] mx-auto px-gutter flex justify-center items-center">
              <p className="font-body-md text-body-md text-on-surface-variant text-center">© {new Date().getFullYear()} Sistem Monitoring Tugas. All rights reserved.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
