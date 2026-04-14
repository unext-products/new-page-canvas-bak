import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityBreakdown {
  activityType: string;
  hours: number;
  percentage: number;
  count: number;
}

interface ActivityBreakdownChartProps {
  data: ActivityBreakdown[];
}

export function ActivityBreakdownChart({ data }: ActivityBreakdownChartProps) {
  const chartData = data
    .filter((item) => item.activityType)
    .map((item) => ({
      name: item.activityType.charAt(0).toUpperCase() + item.activityType.slice(1),
      hours: item.hours,
      percentage: item.percentage,
      count: item.count,
    }))
    .sort((a, b) => b.hours - a.hours);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-foreground">{d.name}</p>
          <p className="text-sm text-muted-foreground">
            {d.hours.toFixed(1)} hours ({d.percentage.toFixed(1)}%)
          </p>
          <p className="text-sm text-muted-foreground">
            {d.count} {d.count === 1 ? "entry" : "entries"}
          </p>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No activity data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const barHeight = 50;
  const chartHeight = Math.max(200, chartData.length * barHeight);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
              <Bar
                dataKey="hours"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                barSize={24}
                label={{
                  position: "right",
                  formatter: (val: number) => `${val.toFixed(1)}h`,
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
