import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Home from "@/pages/home";
import CashDeposit from "@/pages/cash-deposit";
import TipPayout from "@/pages/tip-payout";
import CoffeeOrder from "@/pages/coffee-order";
import EquipmentMaintenance from "@/pages/equipment-maintenance";
import AdminUsers from "@/pages/admin-users";
import AdminBranding from "@/pages/admin-branding";
import PlatformAdmin from "@/pages/platform-admin";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/platform-admin" component={PlatformAdmin} />
      <Route path="/admin/users">
        <ProtectedRoute>
          <AdminUsers />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/branding">
        <ProtectedRoute>
          <AdminBranding />
        </ProtectedRoute>
      </Route>
      <Route path="/recipe-costing">
        <ProtectedRoute module="recipe-costing">
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/cash-deposit">
        <ProtectedRoute module="cash-deposit">
          <CashDeposit />
        </ProtectedRoute>
      </Route>
      <Route path="/tip-payout">
        <ProtectedRoute module="tip-payout">
          <TipPayout />
        </ProtectedRoute>
      </Route>
      <Route path="/coffee-order">
        <ProtectedRoute module="bulk-ordering">
          <CoffeeOrder />
        </ProtectedRoute>
      </Route>
      <Route path="/equipment-maintenance">
        <ProtectedRoute module="equipment-maintenance">
          <EquipmentMaintenance />
        </ProtectedRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
