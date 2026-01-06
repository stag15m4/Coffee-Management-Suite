import { Link } from "wouter";
import { useRecipes } from "@/hooks/use-recipes";
import { useIngredients } from "@/hooks/use-ingredients";
import { ChefHat, ShoppingBasket, TrendingUp, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const { data: recipes } = useRecipes();
  const { data: ingredients } = useIngredients();

  const totalRecipes = recipes?.length || 0;
  const totalIngredients = ingredients?.length || 0;
  
  // Quick stats
  const averageRecipeCost = recipes?.reduce((acc, recipe) => {
    // Note: In a real app we'd calculate this properly on backend or fetch details
    // For dashboard summary, we might need a dedicated endpoint or calculate if data is available
    return acc; 
  }, 0) || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-display font-bold text-primary">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your kitchen metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/recipes">
          <div className="bg-card hover:bg-secondary/50 border border-border/50 rounded-2xl p-6 transition-all hover:shadow-lg cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary group-hover:text-white transition-colors">
                <ChefHat className="w-6 h-6 text-primary group-hover:text-white" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-3xl font-mono font-bold text-foreground">{totalRecipes}</h3>
            <p className="text-sm text-muted-foreground mt-1">Total Recipes</p>
          </div>
        </Link>

        <Link href="/ingredients">
          <div className="bg-card hover:bg-secondary/50 border border-border/50 rounded-2xl p-6 transition-all hover:shadow-lg cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-accent/10 rounded-xl group-hover:bg-accent group-hover:text-white transition-colors">
                <ShoppingBasket className="w-6 h-6 text-accent group-hover:text-white" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <h3 className="text-3xl font-mono font-bold text-foreground">{totalIngredients}</h3>
            <p className="text-sm text-muted-foreground mt-1">Pantry Ingredients</p>
          </div>
        </Link>

        <div className="bg-primary text-primary-foreground rounded-2xl p-6 shadow-lg shadow-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-6 -mt-6 blur-2xl" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-white/10 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-lg font-display font-bold relative z-10">Recipe Costs</h3>
          <p className="text-sm opacity-80 mt-1 relative z-10">
            Track margins and pricing for every dish on your menu.
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-8 text-center py-20">
        <h2 className="text-xl font-display font-bold text-foreground">Welcome to Mise</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Start by adding your pantry ingredients, then create recipes to calculate their exact costs.
        </p>
        <div className="flex justify-center gap-4 mt-6">
          <Link href="/ingredients">
            <button className="bg-secondary hover:bg-secondary/80 text-foreground font-medium px-6 py-2 rounded-xl transition-colors">
              Add Ingredients
            </button>
          </Link>
          <Link href="/recipes">
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-2 rounded-xl transition-colors shadow-lg shadow-primary/20">
              Create Recipe
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
