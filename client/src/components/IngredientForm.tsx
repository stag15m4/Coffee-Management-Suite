import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertIngredientSchema, type InsertIngredient } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const formSchema = insertIngredientSchema.extend({
  cost: z.coerce.number().positive("Cost must be positive"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
});

interface IngredientFormProps {
  defaultValues?: Partial<InsertIngredient>;
  onSubmit: (data: InsertIngredient) => void;
  isLoading: boolean;
  buttonLabel: string;
}

const COMMON_UNITS = ["g", "kg", "oz", "lb", "ml", "L", "pcs", "cup", "tsp", "tbsp"];

export function IngredientForm({ defaultValues, onSubmit, isLoading, buttonLabel }: IngredientFormProps) {
  const form = useForm<InsertIngredient>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues || {
      name: "",
      unit: "g",
      cost: "0",
      quantity: "0",
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
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. All Purpose Flour" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Package Cost ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" inputMode="decimal" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Package Quantity</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" inputMode="decimal" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unit</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COMMON_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
