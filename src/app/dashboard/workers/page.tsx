// Workers Dashboard Page

import { Metadata } from 'next';
import WorkersDashboard from '@/components/workers/WorkersDashboard';

export const metadata: Metadata = {
  title: 'Workers Dashboard - MailGenius',
  description: 'Monitor and manage email workers for parallel processing',
};

export default function WorkersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <WorkersDashboard />
    </div>
  );
}