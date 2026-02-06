import { useState } from "react";
import { useIngredients, useCreateIngredient, useUpdateIngredient, useDeleteIngredient } from "@/hooks/use-ingredients";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IngredientForm } from "@/components/IngredientForm";
import { Plus, Search, Pencil, Trash2, Package } from "lucide-react";
import { CoffeeLoader } from "@/components/CoffeeLoader";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { type InsertIngredient, type Ingredient } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { showDeleteUndoToast } from "@/hooks/use-delete-with-undo";

export default function Ingredients() {
  const { data: ingredients, isLoading } = useIngredients();
  const createMutation = useCreateIngredient();
  const updateMutation = useUpdateIngredient();
  const deleteMutation = useDeleteIngredient();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [search, setSearch] = useState("");

  const filteredIngredients = ingredients?.filter(ing => 
    ing.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data: InsertIngredient) => {
    try {
      await createMutation.mutateAsync(data);
      setIsCreateOpen(false);
      toast({ title: "Success", description: "Ingredient created successfully" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message });
    }
  };

  const handleUpdate = async (data: InsertIngredient) => {
    if (!editingIngredient) return;
    try {
      await updateMutation.mutateAsync({ id: editingIngredient.id, ...data });
      setEditingIngredient(null);
      toast({ title: "Success", description: "Ingredient updated successfully" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message });
    }
  };

  const handleDelete = async (id: string) => {
    const ingredient = ingredients?.find(i => i.id === id);
    const name = ingredient?.name || 'this ingredient';
    if (await confirm({ title: `Delete ${name}?`, description: 'This will remove it from all recipes.', confirmLabel: 'Delete', variant: 'destructive' })) {
      try {
        const savedData = ingredient ? { ...ingredient } : null;
        await deleteMutation.mutateAsync(id);
        showDeleteUndoToast({
          itemName: name,
          undo: savedData
            ? { type: 'reinsert', table: 'ingredients', data: savedData }
            : { type: 'none' },
          invalidateKeys: [['ingredients']],
        });
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: (error as Error).message });
      }
    }
  };

  if (isLoading) return <CoffeeLoader fullScreen />;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-primary">Ingredients</h1>
          <p className="text-muted-foreground mt-1">Manage your pantry inventory and costs</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 text-white font-medium px-6 py-6 rounded-xl shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5">
              <Plus className="mr-2 h-5 w-5" /> Add Ingredient
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">New Ingredient</DialogTitle>
            </DialogHeader>
            <IngredientForm 
              onSubmit={handleCreate} 
              isLoading={createMutation.isPending}
              buttonLabel="Add to Pantry"
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search ingredients..." 
              className="pl-9 bg-secondary/30 border-transparent focus:bg-background transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-secondary/20">
                <TableHead className="w-[40%] pl-6">Name</TableHead>
                <TableHead>Pack Size</TableHead>
                <TableHead>Pack Cost</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIngredients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 opacity-20" />
                      <p>No ingredients found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredIngredients?.map((ing) => {
                  const unitCost = Number(ing.cost) / Number(ing.quantity);
                  return (
                    <TableRow key={ing.id} className="group hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-medium text-foreground pl-6 font-display text-lg">
                        {ing.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {ing.quantity} <span className="text-muted-foreground">{ing.unit}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        ${Number(ing.cost).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono font-medium text-accent">
                        ${unitCost.toFixed(4)} <span className="text-muted-foreground text-xs font-normal">/ {ing.unit}</span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={() => setEditingIngredient(ing)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDelete(ing.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editingIngredient} onOpenChange={(open) => !open && setEditingIngredient(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Edit Ingredient</DialogTitle>
          </DialogHeader>
          {editingIngredient && (
            <div className="space-y-4">
              <IngredientForm
                defaultValues={editingIngredient}
                onSubmit={handleUpdate}
                isLoading={updateMutation.isPending}
                buttonLabel="Save Changes"
              />
              <div className="pt-4 border-t border-border/50">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    handleDelete(editingIngredient.id);
                    setEditingIngredient(null);
                  }}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-ingredient-dialog"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Ingredient
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
