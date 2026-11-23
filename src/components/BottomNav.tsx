import { BarChart3, ClipboardList, House, UserRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "หน้าหลัก", icon: House },
  { to: "/program", label: "โปรแกรม", icon: ClipboardList },
  { to: "/stats", label: "สถิติ", icon: BarChart3 },
  { to: "/profile", label: "โปรไฟล์", icon: UserRound },
];

/** แถบเมนูล่างทรงแคปซูล: แท็บที่เลือกขยายเป็นปุ่มขาวพร้อมชื่อ */
export function BottomNav() {
  return (
    <nav className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-ink p-2 shadow-2xl">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          aria-label={label}
          className={({ isActive }) =>
            `flex h-14 items-center whitespace-nowrap justify-center gap-2 rounded-full transition-all ${
              isActive ? "bg-white px-5 font-semibold text-ink" : "w-14 bg-white/85 text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              {isActive && <span>{label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
