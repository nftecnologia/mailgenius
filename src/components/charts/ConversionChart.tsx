'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ConversionChartProps {
  data: Array<{
    campaign: string
    deliveryRate: number
    openRate: number
    clickRate: number
    totalSent: number
  }>
}

export default function ConversionChart({ data }: ConversionChartProps) {
  const formatTooltipValue = (value: number, name: string) => {
    const labels: { [key: string]: string } = {
      deliveryRate: 'Taxa de Entrega',
      openRate: 'Taxa de Abertura',
      clickRate: 'Taxa de Cliques'
    }
    return [`${value.toFixed(1)}%`, labels[name] || name]
  }

  const formatTooltipLabel = (label: string) => {
    const campaign = data.find(d => d.campaign === label)
    return `${label} (${campaign?.totalSent.toLocaleString()} enviados)`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taxa de Conversão por Campanha</CardTitle>
        <CardDescription>
          Comparativo de performance das últimas campanhas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="campaign"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
              />
              <Tooltip
                formatter={formatTooltipValue}
                labelFormatter={formatTooltipLabel}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Bar
                dataKey="deliveryRate"
                fill="#10b981"
                name="deliveryRate"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="openRate"
                fill="#3b82f6"
                name="openRate"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="clickRate"
                fill="#8b5cf6"
                name="clickRate"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Performance indicators */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">
              {data.length > 0 ? (data.reduce((acc, item) => acc + item.deliveryRate, 0) / data.length).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-green-700">Entrega Média</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">
              {data.length > 0 ? (data.reduce((acc, item) => acc + item.openRate, 0) / data.length).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-blue-700">Abertura Média</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="text-lg font-bold text-purple-600">
              {data.length > 0 ? (data.reduce((acc, item) => acc + item.clickRate, 0) / data.length).toFixed(1) : 0}%
            </div>
            <div className="text-sm text-purple-700">Cliques Média</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
