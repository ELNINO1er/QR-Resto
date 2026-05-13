import React from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { colors } from '../lib/colors';

const CHART_COLORS = [colors.primary, colors.gold, '#5C8A4A', '#C77D32', colors.primaryLight];

function formatFCFA(value) {
  return `${Number(value).toLocaleString()} F`;
}

export function RevenueChart({ data }) {
  if (!data?.length) return <p className="text-sm" style={{ color: colors.textLight }}>Pas de donnees</p>;
  const chartData = data.map(d => ({
    day: d.day?.slice(5) || d.label?.slice(5) || '',
    revenue: d.revenue,
    orders: d.orders,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.sandDark} />
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: colors.textLight }} />
        <YAxis tick={{ fontSize: 11, fill: colors.textLight }} tickFormatter={formatFCFA} />
        <Tooltip formatter={(val, name) => [name === 'revenue' ? formatFCFA(val) : val, name === 'revenue' ? 'Revenus' : 'Commandes']} />
        <Bar dataKey="revenue" fill={colors.primary} radius={[4, 4, 0, 0]} name="revenue" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PeakHoursChart({ data }) {
  if (!data?.length) return <p className="text-sm" style={{ color: colors.textLight }}>Pas de donnees</p>;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={colors.sandDark} />
        <XAxis type="number" tick={{ fontSize: 11, fill: colors.textLight }} />
        <YAxis type="category" dataKey="hour" tick={{ fontSize: 11, fill: colors.textLight }} width={60} />
        <Tooltip formatter={(val) => [val, 'Commandes']} />
        <Bar dataKey="count" fill={colors.gold} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentMethodsChart({ data }) {
  if (!data?.length) return <p className="text-sm" style={{ color: colors.textLight }}>Pas de donnees</p>;
  const labels = { cash: 'Especes', mobile_money: 'Mobile Money', card: 'Carte', '': 'Non defini' };
  const chartData = data.map(d => ({ name: labels[d.payment_method] || d.payment_method, value: d.revenue, count: d.count }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(val) => formatFCFA(val)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ComparisonCard({ label, today, yesterday, unit = '' }) {
  const diff = yesterday > 0 ? Math.round(((today - yesterday) / yesterday) * 100) : today > 0 ? 100 : 0;
  const isUp = diff >= 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
        background: isUp ? '#5C8A4A20' : '#d32f2f20',
        color: isUp ? '#5C8A4A' : '#d32f2f'
      }}>
        {isUp ? '+' : ''}{diff}%
      </span>
      <span className="text-xs" style={{ color: colors.textLight }}>vs hier ({yesterday.toLocaleString()}{unit})</span>
    </div>
  );
}
