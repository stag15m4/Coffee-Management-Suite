import { ReactNode } from 'react';

/**
 * Mock data provider for testing dashboard widgets without database
 * Set VITE_USE_MOCK_DATA=true in .env to enable
 */

export const MOCK_REVENUE_DATA = {
  currentMonth: 15234,
  lastMonth: 13456,
  percentChange: 13.2,
  trend: 'up' as const,
};

export const MOCK_MAINTENANCE_TASKS = {
  tasks: [
    {
      id: '1',
      equipment_name: 'Espresso Machine',
      task_type: 'Deep Clean',
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_overdue: false,
    },
    {
      id: '2',
      equipment_name: 'Coffee Grinder',
      task_type: 'Burr Replacement',
      due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_overdue: false,
    },
    {
      id: '3',
      equipment_name: 'Refrigerator',
      task_type: 'Filter Change',
      due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_overdue: true,
    },
  ],
  overdueCount: 1,
};

export const MOCK_ACTIVE_TASKS = {
  tasks: [
    {
      id: '1',
      title: 'Update menu boards',
      priority: 'high' as const,
      due_date: new Date().toISOString().split('T')[0],
      category_name: 'Urgent',
      category_color: '#ef4444',
    },
    {
      id: '2',
      title: 'Order coffee supplies',
      priority: 'medium' as const,
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category_name: 'Kitchen',
      category_color: '#f97316',
    },
    {
      id: '3',
      title: 'Schedule staff training',
      priority: 'low' as const,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      category_name: 'HR',
      category_color: '#3b82f6',
    },
  ],
  total: 3,
};

export const MOCK_RECENT_ORDERS = {
  orders: [
    {
      id: '1',
      order_date: new Date().toISOString().split('T')[0],
      total_amount: 234,
      items_count: 2,
      vendor_name: 'Blue Bottle Coffee',
    },
    {
      id: '2',
      order_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_amount: 567,
      items_count: 5,
      vendor_name: 'Counter Culture',
    },
    {
      id: '3',
      order_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_amount: 345,
      items_count: 3,
      vendor_name: 'Stumptown Coffee',
    },
    {
      id: '4',
      order_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_amount: 890,
      items_count: 7,
      vendor_name: 'Intelligentsia',
    },
  ],
  totalThisMonth: 2036,
};

interface MockDataProviderProps {
  children: ReactNode;
}

export function MockDataProvider({ children }: MockDataProviderProps) {
  return <>{children}</>;
}

export const useMockData = () => {
  const isMockMode = import.meta.env.VITE_USE_MOCK_DATA === 'true';
  return { isMockMode };
};
