import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Recipes from "@/pages/Recipes";
import RecipeDetail from "@/pages/RecipeDetail";
import Ingredients from "@/pages/Ingredients";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/recipes" component={Recipes} />
      <Route path="/recipes/:id" component={RecipeDetail} />
      <Route path="/ingredients" component={Ingredients} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="flex flex-col md:flex-row min-h-screen bg-background">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="p-4 md:p-8 lg:p-12 max-w-7xl mx-auto w-full">
              <Router />
            </div>
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
