import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { FeedbackButton } from "@/components/FeedbackButton";
import { AppResumeIndicator } from "@/components/AppResumeIndicator";
import { CoffeeLoader } from "@/components/CoffeeLoader";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Home from "@/pages/home";
import CashDeposit from "@/pages/cash-deposit";
import TipPayout from "@/pages/tip-payout";
import CoffeeOrder from "@/pages/coffee-order";
import EquipmentMaintenance from "@/pages/equipment-maintenance";
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
import StoreProfile from "@/pages/store-profile";

function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <CoffeeLoader fullScreen progressiveTexts={[
      "What can I get started for you?",
      "Grinding fresh beans...",
      "Brewing a fresh pot...",
      "Almost ready...",
    ]} />;
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
      <Route path="/organization">
        <ProtectedRoute>
          <AppLayout><OrganizationDashboard /></AppLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/recipe-costing">
        <ProtectedRoute module="recipe-costing">
          <AppLayout><Home /></AppLayout>
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
          <AppResumeIndicator />
          <Toaster />
          <Router />
          <AuthenticatedFeedbackButton />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
