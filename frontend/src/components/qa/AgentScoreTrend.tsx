import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface TrendPoint {
  date: string;
  score: number;
}

export default function AgentScoreTrend({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-[240px] rounded-[24px] border border-[#344453]/10 bg-white p-4 shadow-sm sm:p-5">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(52,68,83,0.08)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={42} domain={[0, 100]} />
          <Tooltip />
          <Line type="monotone" dataKey="score" stroke="#344453" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
