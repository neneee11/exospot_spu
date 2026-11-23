import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

/** โครงหน้าแบบมือถือ (กว้างสุด 480px) พร้อมเมนูล่าง */
export function MobileLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-[480px] px-5 pb-32 pt-4">
      <Outlet />
      <BottomNav />
    </div>
  );
}
