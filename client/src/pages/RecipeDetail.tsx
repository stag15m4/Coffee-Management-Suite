import { useRoute, Link } from "wouter";
import { useRecipe, useUpdateRecipe, useDeleteRecipe, useAddRecipeIngredient, useDeleteRecipeIngredient } from "@/hooks/use-recipes";
import { useIngredients } from "@/hooks/use-ingredients";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RecipeForm } from "@/components/RecipeForm";
import { ArrowLeft, Trash2, Plus, DollarSign, Scale, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const addIngredientSchema = z.object({
  quantity: z.coerce.number().positive("Quantity must be positive"),
  ingredientId: z.string().min(1, "Select an ingredient"),
});

type AddIngredientForm = z.infer<typeof addIngredientSchema>;

export default function RecipeDetail() {
  const [, params] = useRoute("/recipes/:id");
  const id = params?.id || "";
  const { data: recipe, isLoading } = useRecipe(id);
  const { data: ingredients } = useIngredients();

  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const addIngredient = useAddRecipeIngredient();
  const deleteIngredient = useDeleteRecipeIngredient();

  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const form = useForm<AddIngredientForm>({
    resolver: zodResolver(addIngredientSchema),
    defaultValues: { quantity: 1, ingredientId: "" },
  });

  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!recipe) return <div className="flex flex-col items-center justify-center h-screen gap-4"><h1 className="text-2xl font-bold">Recipe Not Found</h1><Link href="/recipes"><Button>Back to List</Button></Link></div>;

  // Calculate totals
  const totalCost = recipe.ingredients?.reduce((sum, ri) => {
    const unitCost = Number(ri.ingredient.cost) / Number(ri.ingredient.quantity);
    return sum + (unitCost * Number(ri.quantity));
  }, 0) || 0;

  const onAddIngredient = async (data: AddIngredientForm) => {
    try {
      await addIngredient.mutateAsync({ recipeId: id, ...data });
      form.reset();
      toast({ title: "Added", description: "Ingredient added to recipe" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message });
    }
  };

  const onUpdateRecipe = async (data: any) => {
    try {
      await updateRecipe.mutateAsync({ id, ...data });
      setIsEditOpen(false);
      toast({ title: "Updated", description: "Recipe details updated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message });
    }
  };

  const onDeleteRecipe = async () => {
    if (confirm("Are you sure? This cannot be undone.")) {
      await deleteRecipe.mutateAsync(id);
      window.location.href = "/recipes";
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <Link href="/recipes" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Recipes
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Header & Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-display font-bold text-primary">{recipe.name}</h1>
            </div>

            <div className="flex gap-2">
              <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-border/50 hover:bg-secondary">Edit</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Edit Recipe</DialogTitle></DialogHeader>
                  <RecipeForm
                    defaultValues={recipe}
                    onSubmit={onUpdateRecipe}
                    isLoading={updateRecipe.isPending}
                    buttonLabel="Update"
                  />
                </DialogContent>
              </Dialog>
              <Button variant="destructive" size="icon" onClick={onDeleteRecipe}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
            <h3 className="font-display font-bold text-lg mb-4 text-primary">Ingredients</h3>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[40%]">Ingredient</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipe.ingredients?.map((ri) => {
                  const unitCost = Number(ri.ingredient.cost) / Number(ri.ingredient.quantity);
                  const lineCost = unitCost * Number(ri.quantity);

                  return (
                    <TableRow key={ri.id} className="group hover:bg-secondary/30 transition-colors border-border/50">
                      <TableCell className="font-medium">{ri.ingredient.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {ri.quantity} <span className="text-muted-foreground">{ri.ingredient.unit}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        ${unitCost.toFixed(4)}/{ri.ingredient.unit}
                      </TableCell>
                      <TableCell className="font-mono font-medium text-right text-foreground">
                        ${lineCost.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteIngredient.mutate({ recipeId: id, id: ri.id })}
                            data-testid={`button-delete-ingredient-${ri.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!recipe.ingredients || recipe.ingredients.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Scale className="w-6 h-6 opacity-20" />
                        <span className="text-sm">No ingredients yet. Add some below.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="mt-8 bg-secondary/20 p-4 rounded-xl border border-dashed border-border">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Add Ingredient
              </h4>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddIngredient)} className="flex gap-2 items-end">
                  <FormField
                    control={form.control}
                    name="ingredientId"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <Select onValueChange={field.onChange} value={String(field.value || "")}>
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select ingredient..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ingredients?.map((ing) => (
                              <SelectItem key={ing.id} value={String(ing.id)}>
                                {ing.name} ({ing.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input type="number" step="any" placeholder="Qty" {...field} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={addIngredient.isPending}>Add</Button>
                </form>
              </Form>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
            <h3 className="font-display font-bold text-lg mb-4 text-primary">Description</h3>
            {recipe.description ? (
              <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{recipe.description}</p>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground/50 italic">
                <AlertCircle className="w-4 h-4" /> No description provided
              </div>
            )}
          </div>
        </div>

        {/* Cost Panel */}
        <div className="space-y-6">
          <div className="bg-primary text-primary-foreground rounded-2xl p-6 shadow-xl shadow-primary/25 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl" />

            <h3 className="font-display font-bold text-xl relative z-10 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-accent" /> Cost Analysis
            </h3>

            <div className="mt-6 space-y-6 relative z-10">
              <div>
                <p className="text-primary-foreground/60 text-sm uppercase tracking-wider font-semibold">Total Cost</p>
                <p className="text-4xl font-mono font-bold mt-1 tracking-tight">${totalCost.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
