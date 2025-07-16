'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface LeadsSourceChartProps {
  data: Array<{
    source: string
    count: number
    percentage: number
  }>
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // yellow
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
]

export default function LeadsSourceChart({ data }: LeadsSourceChartProps) {
  const formatTooltipValue = (value: number, name: string) => {
    return [`${value} leads (${((value / data.reduce((acc, item) => acc + item.count, 0)) * 100).toFixed(1)}%)`, 'Total']
  }

  const renderCustomLabel = (props: any) => {
    const percentage = ((props.value / data.reduce((acc, item) => acc + item.count, 0)) * 100)
    return percentage > 5 ? `${percentage.toFixed(1)}%` : ''
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Origem dos Leads</CardTitle>
        <CardDescription>
          Distribuição por fonte de aquisição
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                nameKey="source"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={formatTooltipValue}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend
                formatter={(value) => {
                  const item = data.find(d => d.source === value)
                  return `${value} (${item?.count || 0})`
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend with detailed info */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.map((item, index) => (
            <div key={item.source} className="flex items-center text-sm">
              <div
                className="w-3 h-3 rounded mr-2"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="font-medium capitalize">{item.source}:</span>
              <span className="ml-1 text-gray-600">
                {item.count} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
