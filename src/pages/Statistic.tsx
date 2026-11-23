import { Activity, Clock3, Footprints, Smile, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, GlassCard, PageHeader, SectionTitle, Segmented } from "../components/ui";
import { useData, useSessions } from "../data/DataContext";
import { alertTrend, averageOf, dailySeries, type Metric } from "../data/stats";
import type { RepEvent } from "../pose/types";

const RANGE = { week: 7, month: 30 } as const;
type Range = keyof typeof RANGE;

const METRIC_INFO: Record<Metric, { label: string; unit: string; caption: string }> = {
  reps: { label: "จำนวนครั้ง", unit: "ครั้ง/วัน", caption: "เฉลี่ย" },
  correct: { label: "ท่าถูก", unit: "%", caption: "เฉลี่ย" },
  pain: { label: "ความปวด", unit: "/ 10", caption: "เฉลี่ย" },
};

export default function Statistic() {
  const { repo } = useData();
  const [range, setRange] = useState<Range>("week");
  const [metric, setMetric] = useState<Metric>("reps");
  const { sessions, loading } = useSessions(RANGE[range]);

  const series = dailySeries(sessions, RANGE[range], metric);
  const avg = averageOf(series);
  const trend = alertTrend(sessions, RANGE[range]);
  const latest = sessions[0];

  const [latestReps, setLatestReps] = useState<RepEvent[]>([]);
  useEffect(() => {
    if (latest) repo.getReps(latest.id).then(setLatestReps);
    else setLatestReps([]);
  }, [repo, latest]);

  return (
    <>
      <PageHeader title="สถิติ" back={false} />

      {/* ---------- กราฟรายวัน ---------- */}
      <GlassCard className="!p-3">
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: "reps", label: "ครั้ง", icon: <Footprints size={18} /> },
            { value: "correct", label: "ท่าถูก", icon: <Activity size={18} /> },
            { value: "pain", label: "ปวด", icon: <Smile size={18} /> },
          ]}
        />
        <div className="mt-3 rounded-[24px] bg-white/35 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-ink">
              <span className="text-4xl font-semibold">{avg ?? "–"}</span>{" "}
              <span className="text-base">
                {METRIC_INFO[metric].unit} ({METRIC_INFO[metric].caption})
              </span>
            </p>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              className="rounded-full bg-white px-4 py-2 text-ink outline-none"
            >
              <option value="week">สัปดาห์นี้</option>
              <option value="month">30 วัน</option>
            </select>
          </div>

          <div className="mt-4 h-48">
            {loading ? null : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series.map((p) => ({ ...p, v: p.value ?? 0 }))} barCategoryGap="18%">
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#2c5856", fontSize: 13 }} />
                  <YAxis hide domain={metric === "pain" ? [0, 10] : metric === "correct" ? [0, 100] : [0, "auto"]} />
                  <Tooltip
                    cursor={false}
                    formatter={(v) => [`${v} ${METRIC_INFO[metric].unit}`, METRIC_INFO[metric].label]}
                  />
                  <Bar dataKey="v" radius={[14, 14, 14, 14]} minPointSize={6}>
                    {series.map((p) => (
                      <Cell key={p.key} fill={p.isToday ? "#0f3b3a" : "rgba(255,255,255,0.75)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </GlassCard>

      {trend !== null && (
        <GlassCard className="mt-4 flex items-center gap-3">
          {trend <= 0 ? <TrendingDown className="text-ok" /> : <TrendingUp className="text-danger" />}
          <p className="text-ink">
            ช่วงหลังนี้การเตือนท่าผิด{trend <= 0 ? "ลดลง" : "เพิ่มขึ้น"} {Math.abs(trend)}% เทียบกับช่วงก่อน
          </p>
        </GlassCard>
      )}

      {/* ---------- ฝึกล่าสุด ---------- */}
      <SectionTitle>ฝึกล่าสุด</SectionTitle>
      {!latest ? (
        <EmptyState>ยังไม่มีข้อมูลการฝึก เริ่มฝึกครั้งแรกกันเลยค่ะ</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <GlassCard strong className="row-span-2 flex flex-col !p-4">
            <p className="text-ink-soft">มุมเข่าต่ำสุดแต่ละครั้ง</p>
            <div className="-mx-2 mt-2 h-32 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latestReps}>
                  <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
                  <Tooltip formatter={(v) => [`${v}°`, "มุมเข่า"]} labelFormatter={(l) => `ครั้งที่ ${Number(l) + 1}`} />
                  <Line type="monotone" dataKey="minKneeAngle" stroke="#0f3b3a" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-ink">
              <span className="text-3xl font-semibold">{latest.romMin ?? "–"}°</span>
            </p>
          </GlassCard>
          <GlassCard strong className="!p-4">
            <Activity className="text-flame" />
            <p className="mt-2 text-ink-soft">ท่าถูก</p>
            <p className="text-2xl font-semibold text-ink">{latest.correctPercent}%</p>
          </GlassCard>
          <GlassCard strong className="!p-4">
            <Clock3 className="text-ink" />
            <p className="mt-2 text-ink-soft">เวลาฝึก</p>
            <p className="text-2xl font-semibold text-ink">{Math.max(1, Math.round(latest.durationSec / 60))} นาที</p>
          </GlassCard>
        </div>
      )}
    </>
  );
}
