import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Toaster } from 'sonner';
import {
  HomePage,
  ApiPage,
  CliproxyPage,
  AccountsPage,
  SettingsPage,
  HealthPage,
  SharedPage,
} from '@/pages';

function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between p-4 border-b">
          <SidebarTrigger />
          <ThemeToggle />
        </header>
        <Outlet />
      </main>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/api" element={<ApiPage />} />
          <Route path="/cliproxy" element={<CliproxyPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="/shared" element={<SharedPage />} />
        </Route>
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}
