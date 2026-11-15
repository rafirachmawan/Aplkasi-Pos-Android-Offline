import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { ProtectedRoute } from './ProtectedRoute'

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)

const StoreListPage = lazy(() =>
  import('@/features/stores/pages/StoreListPage').then((module) => ({
    default: module.StoreListPage,
  })),
)

const StoreDetailPage = lazy(() =>
  import('@/features/stores/pages/StoreDetailPage').then((module) => ({
    default: module.StoreDetailPage,
  })),
)

const SubscriptionListPage = lazy(() =>
  import('@/features/subscriptions/pages/SubscriptionListPage').then((module) => ({
    default: module.SubscriptionListPage,
  })),
)

const TransactionListPage = lazy(() =>
  import('@/features/transactions/pages/TransactionListPage').then((module) => ({
    default: module.TransactionListPage,
  })),
)

const SettingsPage = lazy(() =>
  import('@/features/settings/pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
)

const CustomerOrderPage = lazy(() =>
  import('@/features/customerOrder/pages/CustomerOrderPage').then((module) => ({
    default: module.CustomerOrderPage,
  })),
)

const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
)

export const router = createBrowserRouter([
  // Public Customer QR Self-Order Routes (Tanpa Auth Admin)
  {
    path: '/order/:storeId/:tableNumber',
    element: <CustomerOrderPage />,
  },
  {
    path: '/order/:storeId',
    element: <CustomerOrderPage />,
  },
  {
    path: '/m/:storeId/:tableNumber',
    element: <CustomerOrderPage />,
  },
  {
    path: '/m/:storeId',
    element: <CustomerOrderPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'toko', element: <StoreListPage /> },
          { path: 'toko/:storeId', element: <StoreDetailPage /> },
          { path: 'langganan', element: <SubscriptionListPage /> },
          { path: 'lisensi', element: <Navigate to="/langganan" replace /> },
          { path: 'transaksi', element: <TransactionListPage /> },
          { path: 'pengaturan', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
