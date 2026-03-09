import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { VerticalProvider } from "@/contexts/VerticalContext";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { CommandPalette } from "@/components/CommandPalette";
import { WhatsNew } from "@/components/WhatsNew";
import { Spotlight } from "@/components/Spotlight";
import { AppResumeIndicator } from "@/components/AppResumeIndicator";
import { CoffeeLoader } from "@/components/CoffeeLoader";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eagerly loaded — needed for initial render
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";

// Lazy loaded — only fetched when the route is visited
const RecipeCostingPage = lazy(() => import("@/pages/recipe-costing"));
const CashDeposit = lazy(() => import("@/pages/cash-deposit"));
const TipPayout = lazy(() => import("@/pages/tip-payout"));
const CoffeeOrder = lazy(() => import("@/pages/coffee-order"));
const EquipmentMaintenance = lazy(() => import("@/pages/equipment"));
const AdminTasks = lazy(() => import("@/pages/admin-tasks"));
const CalendarWorkforce = lazy(() => import("@/pages/calendar-workforce"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const AdminBranding = lazy(() => import("@/pages/admin-branding"));
const AdminLocations = lazy(() => import("@/pages/admin-locations"));
const UserProfile = lazy(() => import("@/pages/user-profile"));
const MyTeam = lazy(() => import("@/pages/my-team"));
const OrganizationDashboard = lazy(() => import("@/pages/organization-dashboard"));
const PlatformAdmin = lazy(() => import("@/pages/platform-admin"));
const PlatformAnalytics = lazy(() => import("@/pages/platform-analytics"));
const ResellerManagement = lazy(() => import("@/pages/reseller-management"));
const Billing = lazy(() => import("@/pages/billing"));
const Reporting = lazy(() => import("@/pages/reporting"));
const AdminRoleSettings = lazy(() => import("@/pages/admin-role-settings"));
const StoreProfile = lazy(() => import("@/pages/store-profile"));
const AdminIntegrations = lazy(() => import("@/pages/admin-integrations"));
const DocumentLibrary = lazy(() => import("@/pages/document-library"));
const FinancialBudget = lazy(() => import("@/pages/financial-budget"));
const Kiosk = lazy(() => import("@/pages/kiosk"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const AdminBusinessAccounts = lazy(() => import("@/pages/admin-business-accounts"));
const BugReports = lazy(() => import("@/pages/bug-reports"));
const PlatformBugReports = lazy(() => import("@/pages/platform-bug-reports"));

function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <CoffeeLoader fullScreen />;
  }

  if (!user) {
    return <Landing />;
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <Dashboard />
      </AppLayout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Suspense fallback={<CoffeeLoader fullScreen />}>
    <Switch>
      <Route path="/kiosk" component={Kiosk} />
      <Route path="/login" component={Login} />
      <Route path="/signup/:code?" component={Signup} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/platform-admin" component={PlatformAdmin} />
      <Route path="/platform-analytics" component={PlatformAnalytics} />
      <Route path="/platform-bug-reports">
        <ProtectedRoute>
          <AppLayout><PlatformBugReports /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/reseller-management" component={ResellerManagement} />
      <Route path="/admin/users">
        <ProtectedRoute>
          <AppLayout><AdminUsers /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/branding">
        <ProtectedRoute>
          <AppLayout><AdminBranding /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/locations">
        <ProtectedRoute>
          <AppLayout><AdminLocations /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/role-settings">
        <ProtectedRoute>
          <AppLayout><AdminRoleSettings /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/integrations">
        <ProtectedRoute>
          <AppLayout><AdminIntegrations /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/business-accounts">
        <ProtectedRoute>
          <AppLayout><AdminBusinessAccounts /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/bug-reports">
        <ProtectedRoute>
          <AppLayout><BugReports /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/organization">
        <ProtectedRoute>
          <AppLayout><OrganizationDashboard /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/recipe-costing">
        <ProtectedRoute module="recipe-costing">
          <AppLayout><RecipeCostingPage /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/cash-deposit">
        <ProtectedRoute module="cash-deposit">
          <AppLayout><CashDeposit /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/tip-payout">
        <ProtectedRoute module="tip-payout">
          <AppLayout><TipPayout /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/coffee-order">
        <ProtectedRoute module="bulk-ordering">
          <AppLayout><CoffeeOrder /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/equipment-maintenance">
        <ProtectedRoute module="equipment-maintenance">
          <AppLayout><EquipmentMaintenance /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin-tasks">
        <ProtectedRoute module="admin-tasks">
          <AppLayout><AdminTasks /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/calendar-workforce">
        <ProtectedRoute module="calendar-workforce">
          <AppLayout><CalendarWorkforce /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/reporting">
        <ProtectedRoute module="reporting">
          <AppLayout><Reporting /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/document-library">
        <ProtectedRoute module="document-library">
          <AppLayout><DocumentLibrary /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/financial-budget">
        <ProtectedRoute module="financial-budget">
          <AppLayout><FinancialBudget /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/billing">
        <ProtectedRoute>
          <AppLayout><Billing /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/user-profile">
        <ProtectedRoute>
          <AppLayout><UserProfile /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/my-team">
        <ProtectedRoute>
          <AppLayout><MyTeam /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/store/:id">
        <ProtectedRoute>
          <AppLayout><StoreProfile /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/" component={HomePage} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <VerticalProvider>
            <ThemeProvider>
              <NavigationProvider>
                <AppResumeIndicator />
                <Toaster />
                <ErrorBoundary>
                  <Router />
                </ErrorBoundary>
                <CommandPalette />
                <WhatsNew />
                <Spotlight />
              </NavigationProvider>
            </ThemeProvider>
          </VerticalProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
