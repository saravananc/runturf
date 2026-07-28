import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { MapPage } from './pages/MapPage';

// The map is the landing route, so it stays in the initial bundle. Every other
// screen is fetched on first visit, which keeps that initial payload small.
const ChallengesPage = lazy(() => import('./pages/ChallengesPage').then((m) => ({ default: m.ChallengesPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const RecordPage = lazy(() => import('./pages/RecordPage').then((m) => ({ default: m.RecordPage })));
const ShopPage = lazy(() => import('./pages/ShopPage').then((m) => ({ default: m.ShopPage })));
const SocialPage = lazy(() => import('./pages/SocialPage').then((m) => ({ default: m.SocialPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-ink-2">Loading…</div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <Suspense
      fallback={
        <div role="status" className="flex h-full items-center justify-center text-ink-2">
          Loading…
        </div>
      }
    >
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MapPage />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/challenges" element={<ChallengesPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
