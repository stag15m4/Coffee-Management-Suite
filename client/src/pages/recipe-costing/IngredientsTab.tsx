import { useState } from 'react';
import { Trash2, Pencil, Package, Columns3 } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { colors } from '@/lib/colors';
import { formatCurrency, calculateCostPerUsageUnit, pluralizeType, isOlderThan3Months, formatDate } from './utils';
import type { Ingredient, Category } from './types';
import { INGREDIENT_TYPES } from './types';

interface IngredientsTabProps {
  ingredients: Ingredient[];
  categories: Category[];
  onUpdate: (id: string, updates: Partial<Ingredient>) => Promise<void>;
  onAdd: (ingredient: Partial<Ingredient>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMPTY_FORM = {
  name: '',
  category_id: '',
  ingredient_type: 'FOH Ingredient',
  cost: '',
  quantity: '',
  unit: 'oz',
  usage_unit: '',
  vendor: '',
  manufacturer: '',
  item_number: '',
};

export const IngredientsTab = ({ ingredients, categories, onUpdate, onAdd, onDelete }: IngredientsTabProps) => {
  const [selectedType, setSelectedType] = useState<string>('FOH Ingredient');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [transferTarget, setTransferTarget] = useState<string>('');
  const [showExtraColumns, setShowExtraColumns] = useState(false);

  // Sheet state (unified for add + edit)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Ingredient>>(EMPTY_FORM);

  const normalizeType = (type: string | null | undefined) => (type || 'FOH Ingredient').toLowerCase();

  const filteredIngredients = ingredients
    .filter(i => normalizeType(i.ingredient_type) === selectedType.toLowerCase())
    .filter(i => selectedCategory === 'all' || i.category_id === selectedCategory)
    .sort((a, b) => a.name.localeCompare(b.name));

  const openAddSheet = () => {
    setSheetMode('add');
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, ingredient_type: selectedType });
    setSheetOpen(true);
  };

  const openEditSheet = (ingredient: Ingredient) => {
    setSheetMode('edit');
    setEditingId(ingredient.id);
    setFormData({
      name: ingredient.name,
      category_id: ingredient.category_id,
      ingredient_type: ingredient.ingredient_type || 'FOH Ingredient',
      cost: ingredient.cost,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      usage_unit: ingredient.usage_unit || '',
      vendor: ingredient.vendor || '',
      manufacturer: ingredient.manufacturer || '',
      item_number: ingredient.item_number || '',
    });
    setSheetOpen(true);
  };

  const handleSheetSave = async () => {
    if (sheetMode === 'edit' && editingId) {
      try {
        await onUpdate(editingId, formData);
        setSheetOpen(false);
      } catch (error) {
        console.error('Error saving ingredient:', error);
      }
    } else {
      if (!formData.name || !formData.category_id) {
        alert('Please fill in name and category');
        return;
      }
      await onAdd(formData);
      setSheetOpen(false);
    }
  };

  const toggleItemSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredIngredients.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredIngredients.map(i => i.id)));
    }
  };

  const handleBulkTransfer = async () => {
    if (!transferTarget || selectedItems.size === 0) {
      alert('Please select items and a target type');
      return;
    }
    try {
      const itemIds = Array.from(selectedItems);
      let successCount = 0;
      let failCount = 0;
      for (const id of itemIds) {
        try {
          await onUpdate(id, { ingredient_type: transferTarget });
          successCount++;
        } catch {
          failCount++;
        }
      }
      if (failCount > 0) {
        alert(`Transfer issue: ${failCount} item(s) failed. This is likely due to Supabase security policies. Please check RLS settings.`);
      } else if (successCount > 0) {
        alert(`Successfully transferred ${successCount} item(s) to ${pluralizeType(transferTarget)}`);
      }
      setSelectedItems(new Set());
      setTransferTarget('');
    } catch (error: any) {
      alert('Transfer failed: ' + error.message);
    }
  };

  const colCount = showExtraColumns ? 11 : 8;

  return (
    <div className="space-y-4">
      {/* Type sub-tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {INGREDIENT_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className="px-4 py-2 font-semibold rounded-lg transition-all"
            style={{
              backgroundColor: selectedType === type ? colors.gold : colors.creamDark,
              color: selectedType === type ? colors.white : colors.brown,
            }}
            data-testid={`tab-${type.toLowerCase().replace(' ', '-')}`}
          >
            {pluralizeType(type)} ({ingredients.filter(i => normalizeType(i.ingredient_type) === type.toLowerCase()).length})
          </button>
        ))}
      </div>

      {/* Bulk transfer bar */}
      {selectedItems.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: colors.creamDark }}>
          <span className="font-medium" style={{ color: colors.brown }}>
            {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
          </span>
          <select
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
            className="px-3 py-2 rounded-lg border-2 outline-none"
            style={{ borderColor: colors.gold, color: colors.brown }}
            data-testid="select-transfer-target"
          >
            <option value="">Transfer to...</option>
            {INGREDIENT_TYPES.filter(t => t !== selectedType).map(type => (
              <option key={type} value={type}>{pluralizeType(type)}</option>
            ))}
          </select>
          <button
            onClick={handleBulkTransfer}
            disabled={!transferTarget}
            className="px-4 py-2 font-semibold rounded-lg transition-all"
            style={{
              backgroundColor: transferTarget ? colors.gold : colors.creamDark,
              color: transferTarget ? colors.white : colors.brownLight,
              opacity: transferTarget ? 1 : 0.6,
            }}
            data-testid="button-bulk-transfer"
          >
            Transfer
          </button>
          <button
            onClick={() => setSelectedItems(new Set())}
            className="px-4 py-2 font-semibold rounded-lg transition-all"
            style={{ backgroundColor: colors.white, color: colors.brown, border: `1px solid ${colors.creamDark}` }}
            data-testid="button-clear-selection"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Filters + column toggle + Add button */}
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium" style={{ color: colors.brown }}>Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 rounded-lg border-2 outline-none"
              style={{ borderColor: colors.creamDark, color: colors.brown }}
              data-testid="select-ingredient-category"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowExtraColumns(!showExtraColumns)}
                  className="p-2 rounded-lg border-2 transition-all"
                  style={{
                    borderColor: showExtraColumns ? colors.gold : colors.creamDark,
                    backgroundColor: showExtraColumns ? colors.cream : colors.white,
                    color: colors.brown,
                  }}
                  data-testid="button-toggle-columns"
                >
                  <Columns3 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{showExtraColumns ? 'Hide extra columns' : 'Show all columns'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <button
          onClick={openAddSheet}
          className="px-4 py-2 font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="button-add-ingredient"
        >
          + Add {selectedType}
        </button>
      </div>

      {/* Ingredients table */}
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ backgroundColor: colors.white }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: colors.brown }}>
                <th className="px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredIngredients.length && filteredIngredients.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: colors.gold }}
                    data-testid="checkbox-select-all"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-white">Ingredient</th>
                <th className="px-4 py-3 text-left font-semibold text-white">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-white">Cost</th>
                <th className="px-4 py-3 text-right font-semibold text-white">Quantity</th>
                {showExtraColumns && (
                  <>
                    <th className="px-4 py-3 text-right font-semibold text-white">Cost/Unit</th>
                    <th className="px-4 py-3 text-right font-semibold text-white">Usage Unit</th>
                  </>
                )}
                <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.gold }}>Cost/Usage</th>
                {showExtraColumns && (
                  <th className="px-4 py-3 text-left font-semibold text-white">Vendor</th>
                )}
                <th className="px-4 py-3 text-center font-semibold text-white">Last Updated</th>
                <th className="px-4 py-3 text-center font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.map((ingredient, idx) => (
                <tr
                  key={ingredient.id}
                  className="cursor-pointer hover:brightness-95 transition-all"
                  onClick={() => openEditSheet(ingredient)}
                  style={{
                    backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                    borderBottom: `1px solid ${colors.creamDark}`,
                  }}
                  data-testid={`row-ingredient-${ingredient.id}`}
                >
                  <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(ingredient.id)}
                      onChange={() => toggleItemSelection(ingredient.id)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: colors.gold }}
                      data-testid={`checkbox-ingredient-${ingredient.id}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: colors.brown }}>
                    {ingredient.name}
                  </td>
                  <td className="px-4 py-3" style={{ color: colors.brownLight }}>
                    {ingredient.category_name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: colors.brown }}>
                    {formatCurrency(ingredient.cost)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: colors.brown }}>
                    {ingredient.quantity} {ingredient.unit}
                  </td>
                  {showExtraColumns && (
                    <>
                      <td className="px-4 py-3 text-right font-mono" style={{ color: colors.brownLight }}>
                        {formatCurrency((Number(ingredient.cost) || 0) / (Number(ingredient.quantity) || 1))}/{ingredient.unit}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: colors.brownLight }}>
                        {ingredient.usage_unit || ingredient.unit}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: colors.gold }}>
                    {(() => {
                      const usageUnit = ingredient.usage_unit || ingredient.unit;
                      const costPerUsage = calculateCostPerUsageUnit(
                        Number(ingredient.cost) || 0,
                        Number(ingredient.quantity) || 1,
                        ingredient.unit,
                        usageUnit
                      );
                      return costPerUsage !== null ? `${formatCurrency(costPerUsage)}/${usageUnit}` : '-';
                    })()}
                  </td>
                  {showExtraColumns && (
                    <td className="px-4 py-3" style={{ color: colors.brownLight }}>
                      {ingredient.vendor || '-'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {isOlderThan3Months(ingredient.updated_at) && (
                        <span
                          title="Price check needed - not updated in 3+ months"
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: colors.red, color: colors.white }}
                          data-testid={`badge-needs-update-${ingredient.id}`}
                        >
                          Check
                        </span>
                      )}
                      <span className="text-xs" style={{ color: colors.brownLight }}>
                        {formatDate(ingredient.updated_at)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => openEditSheet(ingredient)}
                              className="p-1 rounded"
                              style={{ color: colors.brownLight }}
                              data-testid={`button-edit-${ingredient.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onDelete(ingredient.id)}
                              className="p-1 rounded"
                              style={{ color: colors.brownLight }}
                              data-testid={`button-delete-${ingredient.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredIngredients.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="text-center py-10">
                    <Package className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
                    <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>No ingredients yet</h3>
                    <p className="text-sm" style={{ color: colors.brownLight }}>
                      Add your first ingredient to start building recipes and tracking costs.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Sheet (slide-over drawer) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle style={{ color: colors.brown }}>
              {sheetMode === 'edit' ? 'Edit Ingredient' : `New ${selectedType}`}
            </SheetTitle>
            <SheetDescription>
              {sheetMode === 'edit'
                ? 'Update the ingredient details below.'
                : 'Fill in the details to add a new ingredient.'}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 mt-6">
            {/* Name */}
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>Name *</label>
              <input
                type="text"
                value={String(formData.name || '')}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.creamDark, color: colors.brown }}
                placeholder="Ingredient name"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>Category *</label>
              <select
                value={String(formData.category_id || '')}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.creamDark, color: colors.brown }}
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Type (edit only — when adding, type is the selected sub-tab) */}
            {sheetMode === 'edit' && (
              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>Type</label>
                <select
                  value={String(formData.ingredient_type || 'FOH Ingredient')}
                  onChange={(e) => setFormData({ ...formData, ingredient_type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none"
                  style={{ borderColor: colors.creamDark, color: colors.brown }}
                >
                  {INGREDIENT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Cost + Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium" style={{ color: colors.brown }}>Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={String(formData.cost || '')}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none text-right"
                  style={{ borderColor: colors.creamDark, color: colors.brown }}
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium" style={{ color: colors.brown }}>Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={String(formData.quantity || '')}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none text-right"
                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                    placeholder="0"
                  />
                </div>
                <div className="w-24">
                  <label className="text-sm font-medium" style={{ color: colors.brown }}>Unit</label>
                  <select
                    value={String(formData.unit || 'oz')}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none"
                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                  >
                    <option value="oz">oz</option>
                    <option value="lb">lb</option>
                    <option value="gal">gal</option>
                    <option value="gram">gram</option>
                    <option value="kg">kg</option>
                    <option value="l">l</option>
                    <option value="each">each</option>
                    <option value="count">count</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Usage Unit */}
            <div>
              <label className="text-sm font-medium" style={{ color: colors.brown }}>Usage Unit</label>
              <select
                value={String(formData.usage_unit || '')}
                onChange={(e) => setFormData({ ...formData, usage_unit: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.creamDark, color: colors.brown }}
              >
                <option value="">Same as purchase unit</option>
                <option value="gram">gram</option>
                <option value="oz">oz</option>
                <option value="ml">ml</option>
                <option value="each">each</option>
              </select>
            </div>

            {/* Vendor details — secondary fields */}
            <div className="pt-2 border-t" style={{ borderColor: colors.creamDark }}>
              <p className="text-xs font-medium mb-3" style={{ color: colors.brownLight }}>Vendor Details</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium" style={{ color: colors.brown }}>Vendor</label>
                  <input
                    type="text"
                    value={String(formData.vendor || '')}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none"
                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                    placeholder="Vendor name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" style={{ color: colors.brown }}>Manufacturer</label>
                  <input
                    type="text"
                    value={String(formData.manufacturer || '')}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none"
                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                    placeholder="Manufacturer name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium" style={{ color: colors.brown }}>Item Number</label>
                  <input
                    type="text"
                    value={String(formData.item_number || '')}
                    onChange={(e) => setFormData({ ...formData, item_number: e.target.value })}
                    className="w-full mt-1 px-3 py-2 rounded-lg border-2 outline-none"
                    style={{ borderColor: colors.creamDark, color: colors.brown }}
                    placeholder="SKU / item #"
                  />
                </div>
              </div>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSheetSave}
                className="flex-1 px-4 py-2 font-semibold rounded-lg transition-all hover:opacity-90"
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                {sheetMode === 'edit' ? 'Save Changes' : 'Add Ingredient'}
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
              >
                Cancel
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
