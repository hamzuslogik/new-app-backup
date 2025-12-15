import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import ChartContainer from './ChartContainer';

const COLORS = ['#9cbfc8', '#4a7a87', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c'];

const StatsCharts = ({ data, type = 'bar', title, height = 300 }) => {
  const chartColors = {
    text: '#333333',
    grid: '#e0e0e0',
    background: '#ffffff'
  };

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="name" stroke={chartColors.text} />
              <YAxis stroke={chartColors.text} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: chartColors.background,
                  border: `1px solid ${chartColors.grid}`,
                  color: chartColors.text
                }}
              />
              <Legend wrapperStyle={{ color: chartColors.text }} />
              <Bar dataKey="value" fill={COLORS[0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="name" stroke={chartColors.text} />
              <YAxis stroke={chartColors.text} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: chartColors.background,
                  border: `1px solid ${chartColors.grid}`,
                  color: chartColors.text
                }}
              />
              <Legend wrapperStyle={{ color: chartColors.text }} />
              <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: chartColors.background,
                  border: `1px solid ${chartColors.grid}`,
                  color: chartColors.text
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <ChartContainer title={title}>
      {renderChart()}
    </ChartContainer>
  );
};

export default StatsCharts;

