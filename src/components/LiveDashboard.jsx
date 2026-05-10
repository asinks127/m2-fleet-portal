import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

/**
 * Live updating dashboard with real-time charts
 */
export function LiveDashboard({ children, refreshInterval = 30000 }) {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsRefreshing(true);
      setLastUpdate(new Date());
      setTimeout(() => setIsRefreshing(false), 500);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return (
    <div className="space-y-4">
      {/* Last Update Indicator */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </div>
      
      {children}
    </div>
  );
}

/**
 * Metric card with trend indicator
 */
export function MetricCard({ title, value, previousValue, icon: Icon, color = "blue" }) {
  const asNumber = (v) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getTrend = () => {
    const current = asNumber(value);
    const previous = asNumber(previousValue);
    if (!previousValue || previous === current) return 'stable';
    return current > previous ? 'up' : 'down';
  };

  const trend = getTrend();
  const current = asNumber(value);
  const previous = asNumber(previousValue);
  const percentChange = previousValue ? ((current - previous) / previous * 100).toFixed(1) : 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value ?? 0}</p>
            {previousValue !== undefined && (
              <div className="flex items-center mt-2 text-sm">
                {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500 mr-1" />}
                {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500 mr-1" />}
                {trend === 'stable' && <Minus className="w-4 h-4 text-gray-500 mr-1" />}
                <span className={
                  trend === 'up' ? 'text-green-600' : 
                  trend === 'down' ? 'text-red-600' : 
                  'text-gray-600'
                }>
                  {Math.abs(percentChange)}% from last period
                </span>
              </div>
            )}
          </div>
          <div className={`p-4 rounded-full bg-${color}-100`}>
            <Icon className={`w-8 h-8 text-${color}-600`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Real-time line chart with gradient
 */
export function LiveLineChart({ data, dataKey, xAxisKey, title, color = "#3b82f6" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey={dataKey} stroke={color} fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Real-time bar chart
 */
export function LiveBarChart({ data, dataKey, xAxisKey, title, color = "#3b82f6" }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Real-time pie chart
 */
export function LivePieChart({ data, title }) {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}