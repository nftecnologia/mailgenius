import { Metadata } from 'next'
import RealtimeMonitoringDashboard from '@/components/monitoring/RealtimeMonitoringDashboard'

export const metadata: Metadata = {
  title: 'Monitoring Dashboard | MailGenius',
  description: 'Real-time monitoring dashboard for MailGenius system health and performance',
}

export default function MonitoringPage() {
  return <RealtimeMonitoringDashboard />
}