'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CampaignChartProps {
  data: Array<{
    date: string
    sent: number
    delivered: number
    opened: number
    clicked: number
  }>
}

export default function CampaignChart({ data }: CampaignChartProps) {
  const formatTooltipValue = (value: number, name: string) => {
    const labels: { [key: string]: string } = {
      sent: 'Enviados',
      delivered: 'Entregues',
      opened: 'Abertos',
      clicked: 'Cliques'
    }
    return [value.toLocaleString(), labels[name] || name]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance de Campanhas</CardTitle>
        <CardDescription>
          Métricas de entregabilidade dos últimos 30 dias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString('pt-BR', {
                    month: 'short',
                    day: 'numeric'
                  })
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                formatter={formatTooltipValue}
                labelFormatter={(label) => {
                  const date = new Date(label)
                  return date.toLocaleDateString('pt-BR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="sent"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
                strokeWidth={2}
                name="sent"
              />
              <Area
                type="monotone"
                dataKey="delivered"
                stackId="2"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                strokeWidth={2}
                name="delivered"
              />
              <Area
                type="monotone"
                dataKey="opened"
                stackId="3"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.3}
                strokeWidth={2}
                name="opened"
              />
              <Area
                type="monotone"
                dataKey="clicked"
                stackId="4"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.4}
                strokeWidth={2}
                name="clicked"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
