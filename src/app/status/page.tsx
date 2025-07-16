import { Metadata } from 'next'
import StatusPage from '@/components/monitoring/StatusPage'

export const metadata: Metadata = {
  title: 'System Status | MailGenius',
  description: 'Real-time system status and uptime information for MailGenius',
}

export default function StatusPageRoute() {
  return <StatusPage />
}