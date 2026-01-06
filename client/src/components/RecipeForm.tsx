import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRecipeSchema, type InsertRecipe } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const formSchema = insertRecipeSchema.extend({
  servings: z.coerce.number().int().positive("Must be at least 1 serving"),
});

interface RecipeFormProps {
  defaultValues?: Partial<InsertRecipe>;
  onSubmit: (data: InsertRecipe) => void;
  isLoading: boolean;
  buttonLabel: string;
}

export function RecipeForm({ defaultValues, onSubmit, isLoading, buttonLabel }: RecipeFormProps) {
  const form = useForm<InsertRecipe>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues || {
      name: "",
      servings: 1,
      instructions: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipe Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Classic Beef Bourguignon" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="servings"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Yields (Servings)</FormLabel>
              <FormControl>
                <Input type="number" min="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Add basic preparation steps..." 
                  className="min-h-[120px] resize-none"
                  {...field} 
                  value={field.value || ""} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-xl mt-6"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {buttonLabel}
        </Button>
      </form>
    </Form>
  );
}
