import { pgTable, text, integer, numeric, uuid, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const ingredients = pgTable("ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // e.g., "g", "kg", "oz", "ml"
  cost: numeric("cost").notNull(), // Cost per package
  quantity: numeric("quantity").notNull(), // Amount in package
});

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
});

export const recipeIngredients = pgTable("recipe_ingredients", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: uuid("recipe_id").notNull(),
  ingredientId: uuid("ingredient_id").notNull(),
  quantity: numeric("quantity").notNull(), // Amount used in recipe
});

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(recipeIngredients),
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  usedIn: many(recipeIngredients),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
  ingredient: one(ingredients, {
    fields: [recipeIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));

// Schemas
export const insertIngredientSchema = createInsertSchema(ingredients).omit({ id: true });
export const insertRecipeSchema = createInsertSchema(recipes).omit({ id: true });
export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients).omit({ id: true });

export type Ingredient = typeof ingredients.$inferSelect;
export type InsertIngredient = z.infer<typeof insertIngredientSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;

// =====================================================
// WHOLESALE RESELLER & LICENSE CODE SYSTEM
// =====================================================

export const resellers = pgTable("resellers", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  companyAddress: text("company_address"),
  seatsTotal: integer("seats_total").notNull().default(0),
  seatsUsed: integer("seats_used").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  tier: text("tier").default("authorized"),
  discountPercent: numeric("discount_percent").default("20"),
  minimumSeats: integer("minimum_seats").default(0),
  billingCycle: text("billing_cycle").default("monthly"),
  annualCommitment: integer("annual_commitment").default(0),
  wholesaleRatePerSeat: numeric("wholesale_rate_per_seat").default("0"),
  cardSurchargePercent: numeric("card_surcharge_percent").default("4.00"),
  tierUpdatedAt: timestamp("tier_updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const licenseCodes = pgTable("license_codes", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull().unique(),
  resellerId: uuid("reseller_id").notNull(),
  tenantId: uuid("tenant_id"),
  subscriptionPlan: text("subscription_plan").default("premium"),
  redeemedAt: timestamp("redeemed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: uuid("created_by"),
});

export const resellersRelations = relations(resellers, ({ many }) => ({
  licenseCodes: many(licenseCodes),
}));

export const licenseCodesRelations = relations(licenseCodes, ({ one }) => ({
  reseller: one(resellers, {
    fields: [licenseCodes.resellerId],
    references: [resellers.id],
  }),
}));

// Schemas
export const insertResellerSchema = createInsertSchema(resellers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLicenseCodeSchema = createInsertSchema(licenseCodes).omit({ id: true, createdAt: true });

export type Reseller = typeof resellers.$inferSelect;
export type InsertReseller = z.infer<typeof insertResellerSchema>;
export type LicenseCode = typeof licenseCodes.$inferSelect;
export type InsertLicenseCode = z.infer<typeof insertLicenseCodeSchema>;

// =====================================================
// RESELLER INVOICING
// =====================================================

export const resellerInvoices = pgTable("reseller_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  resellerId: uuid("reseller_id").notNull(),
  stripeInvoiceId: text("stripe_invoice_id"),
  invoiceNumber: text("invoice_number").notNull(),
  status: text("status").notNull().default("draft"),
  paymentMethod: text("payment_method"),
  billableSeats: integer("billable_seats").notNull(),
  ratePerSeat: numeric("rate_per_seat").notNull(),
  subtotal: numeric("subtotal").notNull(),
  surchargeAmount: numeric("surcharge_amount").default("0"),
  total: numeric("total").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  dueDate: date("due_date").notNull(),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: uuid("created_by"),
});

export const resellerInvoicesRelations = relations(resellerInvoices, ({ one }) => ({
  reseller: one(resellers, {
    fields: [resellerInvoices.resellerId],
    references: [resellers.id],
  }),
}));

export const insertResellerInvoiceSchema = createInsertSchema(resellerInvoices).omit({ id: true, createdAt: true });

export type ResellerInvoice = typeof resellerInvoices.$inferSelect;
export type InsertResellerInvoice = z.infer<typeof insertResellerInvoiceSchema>;
