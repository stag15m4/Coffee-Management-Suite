import { useState } from 'react';
import { Trash2, Pencil, Package } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
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

export const IngredientsTab = ({ ingredients, categories, onUpdate, onAdd, onDelete }: IngredientsTabProps) => {
  const [selectedType, setSelectedType] = useState<string>('FOH Ingredient');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Ingredient>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [transferTarget, setTransferTarget] = useState<string>('');
  const [newIngredient, setNewIngredient] = useState({
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
  });

  const normalizeType = (type: string | null | undefined) => (type || 'FOH Ingredient').toLowerCase();

  const filteredIngredients = ingredients
    .filter(i => normalizeType(i.ingredient_type) === selectedType.toLowerCase())
    .filter(i => selectedCategory === 'all' || i.category_id === selectedCategory)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleEdit = (ingredient: Ingredient) => {
    setEditingId(ingredient.id);
    setEditForm({
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
  };

  const handleSave = async (id: string) => {
    try {
      await onUpdate(id, editForm);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving ingredient:', error);
    }
  };

  const handleAddIngredient = async () => {
    if (!newIngredient.name || !newIngredient.category_id) {
      alert('Please fill in name and category');
      return;
    }
    await onAdd(newIngredient);
    setNewIngredient({
      name: '',
      category_id: '',
      ingredient_type: selectedType,
      cost: '',
      quantity: '',
      unit: 'oz',
      usage_unit: '',
      vendor: '',
      manufacturer: '',
      item_number: '',
    });
    setShowAddForm(false);
  };

  const toggleItemSelection = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {INGREDIENT_TYPES.map(type => (
          <button
            key={type}
            onClick={() => { setSelectedType(type); setNewIngredient(prev => ({ ...prev, ingredient_type: type })); }}
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

      {selectedItems.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
          style={{ backgroundColor: colors.creamDark }}
        >
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
              opacity: transferTarget ? 1 : 0.6
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

      <div className="flex flex-wrap items-center gap-4 justify-between">
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
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="button-add-ingredient"
        >
          + Add {selectedType}
        </button>
      </div>

      {showAddForm && (
        <div className="rounded-xl p-4 shadow-md" style={{ backgroundColor: colors.white }}>
          <h3 className="font-bold mb-3" style={{ color: colors.brown }}>New Ingredient</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Name"
              value={newIngredient.name}
              onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-name"
            />
            <select
              value={newIngredient.category_id}
              onChange={(e) => setNewIngredient({ ...newIngredient, category_id: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="select-new-ingredient-category"
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Cost ($)"
              value={newIngredient.cost}
              onChange={(e) => setNewIngredient({ ...newIngredient, cost: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-cost"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Qty"
                value={newIngredient.quantity}
                onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                className="px-3 py-2 rounded-lg border-2 outline-none w-20"
                style={{ borderColor: colors.creamDark }}
                data-testid="input-new-ingredient-quantity"
              />
              <select
                value={newIngredient.unit}
                onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                className="px-3 py-2 rounded-lg border-2 outline-none"
                style={{ borderColor: colors.creamDark }}
                data-testid="select-new-ingredient-unit"
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
            <select
              value={newIngredient.usage_unit}
              onChange={(e) => setNewIngredient({ ...newIngredient, usage_unit: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="select-new-ingredient-usage-unit"
            >
              <option value="">Usage Unit (same)</option>
              <option value="gram">gram</option>
              <option value="oz">oz</option>
              <option value="ml">ml</option>
              <option value="each">each</option>
            </select>
            <input
              type="text"
              placeholder="Vendor"
              value={newIngredient.vendor}
              onChange={(e) => setNewIngredient({ ...newIngredient, vendor: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-vendor"
            />
            <input
              type="text"
              placeholder="Manufacturer"
              value={newIngredient.manufacturer}
              onChange={(e) => setNewIngredient({ ...newIngredient, manufacturer: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-manufacturer"
            />
            <input
              type="text"
              placeholder="Item Number"
              value={newIngredient.item_number}
              onChange={(e) => setNewIngredient({ ...newIngredient, item_number: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-new-ingredient-item-number"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddIngredient}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.gold, color: colors.brown }}
                data-testid="button-save-new-ingredient"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                data-testid="button-cancel-new-ingredient"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 text-right font-semibold text-white">Cost/Unit</th>
                <th className="px-4 py-3 text-right font-semibold text-white">Usage Unit</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: colors.gold }}>Cost/Usage</th>
                <th className="px-4 py-3 text-left font-semibold text-white">Vendor</th>
                <th className="px-4 py-3 text-center font-semibold text-white">Last Updated</th>
                <th className="px-4 py-3 text-center font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.map((ingredient, idx) => (
                editingId === ingredient.id ? (
                  <tr
                    key={ingredient.id}
                    style={{ backgroundColor: colors.cream, borderBottom: `2px solid ${colors.gold}` }}
                    data-testid={`row-ingredient-edit-${ingredient.id}`}
                  >
                    <td colSpan={11} className="px-4 py-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Name</label>
                            <input
                              type="text"
                              value={String(editForm.name || '')}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-name-${ingredient.id}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Category</label>
                            <select
                              value={String(editForm.category_id || '')}
                              onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`select-edit-category-${ingredient.id}`}
                            >
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Type</label>
                            <select
                              value={String(editForm.ingredient_type || 'FOH Ingredient')}
                              onChange={(e) => setEditForm({ ...editForm, ingredient_type: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`select-edit-type-${ingredient.id}`}
                            >
                              {INGREDIENT_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Cost ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={String(editForm.cost || '')}
                              onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                              className="w-full px-2 py-1 rounded border text-right"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-cost-${ingredient.id}`}
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Quantity</label>
                              <input
                                type="number"
                                step="0.01"
                                value={String(editForm.quantity || '')}
                                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                className="w-full px-2 py-1 rounded border text-right"
                                style={{ borderColor: colors.gold }}
                                data-testid={`input-edit-quantity-${ingredient.id}`}
                              />
                            </div>
                            <div className="w-20">
                              <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Unit</label>
                              <select
                                value={String(editForm.unit || '')}
                                onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                className="w-full px-2 py-1 rounded border"
                                style={{ borderColor: colors.gold }}
                                data-testid={`select-edit-unit-${ingredient.id}`}
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
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Usage Unit</label>
                            <select
                              value={String(editForm.usage_unit || '')}
                              onChange={(e) => setEditForm({ ...editForm, usage_unit: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`select-edit-usage-unit-${ingredient.id}`}
                            >
                              <option value="">Same as purchase</option>
                              <option value="gram">gram</option>
                              <option value="oz">oz</option>
                              <option value="ml">ml</option>
                              <option value="each">each</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Vendor</label>
                            <input
                              type="text"
                              value={String(editForm.vendor || '')}
                              onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-vendor-${ingredient.id}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Manufacturer</label>
                            <input
                              type="text"
                              value={String(editForm.manufacturer || '')}
                              onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-manufacturer-${ingredient.id}`}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium" style={{ color: colors.brownLight }}>Item Number</label>
                            <input
                              type="text"
                              value={String(editForm.item_number || '')}
                              onChange={(e) => setEditForm({ ...editForm, item_number: e.target.value })}
                              className="w-full px-2 py-1 rounded border"
                              style={{ borderColor: colors.gold }}
                              data-testid={`input-edit-item-number-${ingredient.id}`}
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <button
                              onClick={() => handleSave(ingredient.id)}
                              className="px-4 py-1 rounded font-medium"
                              style={{ backgroundColor: colors.gold, color: colors.brown }}
                              data-testid={`button-save-${ingredient.id}`}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-4 py-1 rounded font-medium"
                              style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                              data-testid={`button-cancel-${ingredient.id}`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={ingredient.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? colors.white : colors.cream,
                      borderBottom: `1px solid ${colors.creamDark}`,
                    }}
                    data-testid={`row-ingredient-${ingredient.id}`}
                  >
                    <td className="px-2 py-3 text-center">
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
                    <td className="px-4 py-3 text-right font-mono" style={{ color: colors.brownLight }}>
                      {formatCurrency((Number(ingredient.cost) || 0) / (Number(ingredient.quantity) || 1))}/{ingredient.unit}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: colors.brownLight }}>
                      {ingredient.usage_unit || ingredient.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: colors.gold }}>
                      {(() => {
                        const usageUnit = ingredient.usage_unit || ingredient.unit;
                        const costPerUsage = calculateCostPerUsageUnit(
                          Number(ingredient.cost) || 0,
                          Number(ingredient.quantity) || 1,
                          ingredient.unit,
                          usageUnit
                        );
                        return costPerUsage !== null
                          ? `${formatCurrency(costPerUsage)}/${usageUnit}`
                          : '-';
                      })()}
                    </td>
                    <td className="px-4 py-3" style={{ color: colors.brownLight }}>
                      {ingredient.vendor || '-'}
                    </td>
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
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleEdit(ingredient)}
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
                )
              ))}
              {filteredIngredients.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-10">
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
    </div>
  );
};
