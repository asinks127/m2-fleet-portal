import React, { useState } from 'react';
import {
  Link as LinkComponent,
  Button,
  Card,
  Table,
  Typography,
} from '@shadcn/ui/react';

// Mock data representing the dashboard cards
const dashboardCards = [
  {
    title: 'Team Health',
    desc: 'Overview of team performance metrics',
    icon: '🩺',
    href: '/team-health',
  },
  {
    title: 'At Risk',
    desc: 'Team members approaching threshold',
    icon: '⚠️',
    href: '/at-risk',
  },
  {
    title: 'Active Team',
    desc: 'Current active technician roster',
    icon: '👥',
    href: '/active-team',
  },
  {
    title: 'Shadowing',
    desc: 'People currently in shadowing mode',
    icon: '🎓',
    href: '/shadowing',
  },
  {
    title: 'Expiring Soon',
    desc: 'Compliance items expiring within 30 days',
    icon: '⏰',
    href: '/expiring-soon',
  },
  {
    title: 'Pending Tasks',
    desc: 'Tasks requiring immediate attention',
    icon: '📋',
    href: '/pending-tasks',
  },
  {
    title: 'Critical Alerts',
    desc: 'Unresolved critical alerts needing action',
    icon: '🚨',
    href: '/critical-alerts',
  },
];

function DashboardSummaryCards() {
  const [selectedCard, setSelectedCard] = useState(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {dashboardCards.map((card) => (
        <Card
          key={card.title}
          className="rounded-lg border p-4 hover:shadow-md transition-shadow"
          onClick={() => setSelectedCard(card)}
        >
          <Typography variant="h4" className="text-xl font-bold mb-2">{card.icon}</Typography>
          <Typography className="text-gray-700">{card.title}</Typography>
          <Typography className="text-sm text-gray-500 mt-1">{card.desc}</Typography>
          <LinkComponent to={card.href} className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-blue-600 hover:bg-blue-50">
            Click to view
          </LinkComponent>
        </Card>
      ))}
      {selectedCard && (
        <div className="mt-4 p-4 rounded-lg bg-white border border-blue-200">
          <Typography className="text-lg font-semibold">{selectedCard.title}</Typography>
          <Typography className="text-gray-600">{selectedCard.desc}</Typography>
          <Button variant="outline" onClick={() => setSelectedCard(null)}>Close</Button>
        </div>
      )}
    </div>
  );
}

export default DashboardSummaryCards;
