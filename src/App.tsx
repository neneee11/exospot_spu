import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { MobileLayout } from "./components/Layout";
import { useData } from "./data/DataContext";
import Home from "./pages/Home";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import Program from "./pages/Program";
import SafetySettings from "./pages/SafetySettings";
import Summary from "./pages/Summary";

// โหลดแยกไฟล์: หน้าฝึก (MediaPipe) และหน้าสถิติ (กราฟ) ขนาดใหญ่
const Session = lazy(() => import("./pages/Session"));
const Statistic = lazy(() => import("./pages/Statistic"));

export default function App() {
  const { loading, error, profile } = useData();

  if (loading) return <FullScreen>กำลังโหลด…</FullScreen>;
  if (error) return <FullScreen>เชื่อมต่อฐานข้อมูลไม่สำเร็จ: {error}</FullScreen>;

  // ยังไม่มีโปรไฟล์ → ต้องกรอกข้อมูลก่อน
  if (!profile) {
    return (
      <Routes>
        <Route path="*" element={<Onboarding />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<FullScreen>กำลังโหลด…</FullScreen>}>
    <Routes>
      <Route element={<MobileLayout />}>
        <Route index element={<Home />} />
        <Route path="program" element={<Program />} />
        <Route path="stats" element={<Statistic />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="profile/edit" element={<Onboarding />} />
      <Route path="safety" element={<SafetySettings />} />
      <Route path="session" element={<Session />} />
      <Route path="summary" element={<Summary />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center p-8 text-center text-xl text-ink">{children}</div>;
}
