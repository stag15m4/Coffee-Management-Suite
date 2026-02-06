import { useState } from "react";
import { Link } from "wouter";
import { useRecipes, useCreateRecipe } from "@/hooks/use-recipes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipeForm } from "@/components/RecipeForm";
import { Plus, Search, ChefHat, ArrowRight } from "lucide-react";
import { CoffeeLoader } from "@/components/CoffeeLoader";
import { useToast } from "@/hooks/use-toast";

export default function Recipes() {
  const { data: recipes, isLoading } = useRecipes();
  const createMutation = useCreateRecipe();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredRecipes = recipes?.filter(recipe => 
    recipe.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data: { name: string; description?: string | null }) => {
    try {
      await createMutation.mutateAsync({
        name: data.name,
        description: data.description || undefined
      });
      setIsCreateOpen(false);
      toast({ title: "Success", description: "Recipe created!" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message });
    }
  };

  if (isLoading) return <CoffeeLoader fullScreen />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-primary">Recipes</h1>
          <p className="text-muted-foreground mt-1">Design your menu and calculate margins</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-6 rounded-xl shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5">
              <Plus className="mr-2 h-5 w-5" /> New Recipe
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Create Recipe</DialogTitle>
            </DialogHeader>
            <RecipeForm 
              onSubmit={handleCreate} 
              isLoading={createMutation.isPending}
              buttonLabel="Create Recipe"
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search recipes..." 
            className="pl-9 bg-card border-transparent shadow-sm focus:border-primary/20 transition-all rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRecipes?.map((recipe) => (
          <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
            <div className="group bg-card hover:bg-secondary/50 border border-border/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 cursor-pointer h-full flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div>
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-secondary rounded-lg group-hover:bg-background transition-colors">
                    <ChefHat className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-xs font-mono bg-secondary px-2 py-1 rounded text-muted-foreground">
                    Recipe
                  </span>
                </div>
                
                <h3 className="mt-4 text-xl font-display font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                  {recipe.name}
                </h3>
                
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {recipe.description || "No description provided."}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-medium text-muted-foreground group-hover:text-accent transition-colors">
                  View Details
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        ))}
        
        {filteredRecipes?.length === 0 && (
          <div className="col-span-full py-20 text-center text-muted-foreground">
            <p>No recipes found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
