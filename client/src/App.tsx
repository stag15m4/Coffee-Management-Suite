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
import { FeedbackButton } from "@/components/FeedbackButton";
import { CommandPalette } from "@/components/CommandPalette";
import { WhatsNew } from "@/components/WhatsNew";
import { Spotlight } from "@/components/Spotlight";
import { AppResumeIndicator } from "@/components/AppResumeIndicator";
import { CoffeeLoader } from "@/components/CoffeeLoader";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import RecipeCostingPage from "@/pages/recipe-costing";
import CashDeposit from "@/pages/cash-deposit";
import TipPayout from "@/pages/tip-payout";
import CoffeeOrder from "@/pages/coffee-order";
import EquipmentMaintenance from "@/pages/equipment";
import AdminTasks from "@/pages/admin-tasks";
import CalendarWorkforce from "@/pages/calendar-workforce";
import AdminUsers from "@/pages/admin-users";
import AdminBranding from "@/pages/admin-branding";
import AdminLocations from "@/pages/admin-locations";
import UserProfile from "@/pages/user-profile";
import MyTeam from "@/pages/my-team";
import OrganizationDashboard from "@/pages/organization-dashboard";
import PlatformAdmin from "@/pages/platform-admin";
import ResellerManagement from "@/pages/reseller-management";
import Billing from "@/pages/billing";
import Reporting from "@/pages/reporting";
import AdminRoleSettings from "@/pages/admin-role-settings";
import StoreProfile from "@/pages/store-profile";
import AdminIntegrations from "@/pages/admin-integrations";
import DocumentLibrary from "@/pages/document-library";
import Kiosk from "@/pages/kiosk";

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
    <Switch>
      <Route path="/kiosk" component={Kiosk} />
      <Route path="/login" component={Login} />
      <Route path="/platform-admin" component={PlatformAdmin} />
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
  );
}

function AuthenticatedFeedbackButton() {
  const { user } = useAuth();
  if (!user) return null;
  return <FeedbackButton />;
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
                <Router />
                <CommandPalette />
                <WhatsNew />
                <Spotlight />
                <AuthenticatedFeedbackButton />
              </NavigationProvider>
            </ThemeProvider>
          </VerticalProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
