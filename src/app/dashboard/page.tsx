'use client';

import AppShell from '@/components/AppShell';

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="font-heading text-5xl md:text-6xl text-hot-pink text-center mb-4">
          Welcome back to the Jungle 🌿🦩
        </h1>
        <p className="text-flamingo-blush text-lg font-body text-center max-w-xl">
          Your rare exotic plant business intelligence dashboard. Track inventory, sales, streams, and more.
        </p>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Revenue', value: '$0', icon: '💰' },
            { label: 'Profit', value: '$0', icon: '📈' },
            { label: 'Sales', value: '0', icon: '🛒' },
            { label: 'Customers', value: '0', icon: '👥' },
          ].map((card) => (
            <div key={card.label} className="bg-deep-jungle/40 border border-tropical-leaf/20 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">{card.icon}</div>
              <div className="font-heading text-2xl text-white">{card.value}</div>
              <div className="text-sm text-flamingo-blush font-body">{card.label}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
