import { useState } from 'react';
import { Trash2, X, Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { colors } from '@/lib/colors';
import type { BaseTemplate, Ingredient, ProductSize } from './types';

interface BaseTemplatesTabProps {
  baseTemplates: BaseTemplate[];
  ingredients: Ingredient[];
  productSizes: ProductSize[];
  onAddTemplate: (template: { name: string; drink_type: string; description?: string }) => Promise<void>;
  onAddTemplateIngredient: (ingredient: { base_template_id: string; ingredient_id: string; size_id: string; quantity: number; unit?: string }) => Promise<void>;
  onDeleteTemplateIngredient: (id: string) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onAddProductSize: (size: { name: string; size_value: number; product_type: string }) => Promise<string>;
  onRemoveTemplateSize: (templateId: string, sizeId: string) => Promise<void>;
}

export const BaseTemplatesTab = ({ baseTemplates, ingredients, productSizes, onAddTemplate, onAddTemplateIngredient, onDeleteTemplateIngredient, onDeleteTemplate, onAddProductSize, onRemoveTemplateSize }: BaseTemplatesTabProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', drink_type: 'Hot', description: '' });
  const [addingIngredient, setAddingIngredient] = useState<{ templateId: string; sizeId: string } | null>(null);
  const [newIngredient, setNewIngredient] = useState({ ingredient_id: '', quantity: '1', unit: '' });
  const [copying, setCopying] = useState(false);
  const [pendingSizes, setPendingSizes] = useState<Record<string, string[]>>({});
  const [addingSizeFor, setAddingSizeFor] = useState<string | null>(null);
  const [creatingSize, setCreatingSize] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeOz, setNewSizeOz] = useState('');

  const handleCopyFromSize = async (template: BaseTemplate, targetSizeId: string, sourceSizeId: string) => {
    const sourceIngredients = (template.ingredients || []).filter(i => i.size_id === sourceSizeId);
    if (sourceIngredients.length === 0) {
      alert('No ingredients to copy from that size');
      return;
    }
    setCopying(true);
    try {
      for (const ing of sourceIngredients) {
        await onAddTemplateIngredient({
          base_template_id: template.id,
          ingredient_id: ing.ingredient_id,
          size_id: targetSizeId,
          quantity: ing.quantity,
          unit: ing.unit || 'each',
        });
      }
    } finally {
      setCopying(false);
    }
  };

  const handleAddTemplate = async () => {
    if (!newTemplate.name) {
      alert('Please enter a template name');
      return;
    }
    await onAddTemplate(newTemplate);
    setNewTemplate({ name: '', drink_type: 'Hot', description: '' });
    setShowAddForm(false);
  };

  const handleAddIngredient = async (templateId: string, sizeId: string) => {
    if (!newIngredient.ingredient_id) {
      alert('Please select an ingredient');
      return;
    }
    const selectedIng = ingredients.find(i => i.id === newIngredient.ingredient_id);
    const unit = newIngredient.unit || selectedIng?.usage_unit || selectedIng?.unit || 'each';
    await onAddTemplateIngredient({
      base_template_id: templateId,
      ingredient_id: newIngredient.ingredient_id,
      size_id: sizeId,
      quantity: parseFloat(newIngredient.quantity) || 1,
      unit,
    });
    setNewIngredient({ ingredient_id: '', quantity: '1', unit: '' });
    setAddingIngredient(null);
  };

  const drinkTypes = ['Hot', 'Cold', 'Food'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <h3 className="font-bold text-lg" style={{ color: colors.brown }}>Recipe Bases</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 font-semibold rounded-lg transition-all hover:opacity-90"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="button-add-template"
        >
          + New Recipe Base
        </button>
      </div>

      {showAddForm && (
        <div className="rounded-xl p-4 shadow-md" style={{ backgroundColor: colors.white }}>
          <h3 className="font-bold mb-3" style={{ color: colors.brown }}>New Recipe Base</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Name (e.g., Hot Cup, Bagel)"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-template-name"
            />
            <select
              value={newTemplate.drink_type}
              onChange={(e) => setNewTemplate({ ...newTemplate, drink_type: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="select-template-type"
            >
              {drinkTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Description (optional)"
              value={newTemplate.description}
              onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
              className="px-3 py-2 rounded-lg border-0 outline-none"
              style={{ backgroundColor: colors.inputBg, color: colors.brown }}
              data-testid="input-template-description"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddTemplate}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.gold, color: colors.white }}
                data-testid="button-save-template"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 font-semibold rounded-lg"
                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                data-testid="button-cancel-template"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {baseTemplates.map(template => {
          const usedSizeIds = Array.from(new Set((template.ingredients || []).map(i => i.size_id)));
          const pendingForTemplate = (pendingSizes[template.id] || []).filter(id => !usedSizeIds.includes(id));
          const allShownSizeIds = [...usedSizeIds, ...pendingForTemplate];
          const templateSizes = productSizes.filter(s => allShownSizeIds.includes(s.id));
          return (
            <div
              key={template.id}
              className="rounded-xl shadow-md overflow-hidden"
              style={{ backgroundColor: colors.white }}
              data-testid={`card-template-${template.id}`}
            >
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                style={{ backgroundColor: colors.creamDark }}
              >
                <div>
                  <h3 className="font-bold" style={{ color: colors.brown }}>{template.name}</h3>
                  <span className="text-sm" style={{ color: colors.brownLight }}>
                    {template.drink_type === 'Food' ? 'Food items' : `${template.drink_type} items`} {template.description ? `- ${template.description}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTemplate(template.id);
                    }}
                    data-testid={`button-delete-template-${template.id}`}
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <span style={{ color: colors.gold }}>{expandedTemplate === template.id ? '\u25BC' : '\u25B6'}</span>
                </div>
              </div>

              {expandedTemplate === template.id && (
                <div className="p-4">
                  <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
                    Add items for each size:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {templateSizes.map(size => {
                      const sizeIngredients = (template.ingredients || []).filter(i => i.size_id === size.id);
                      const isAdding = addingIngredient?.templateId === template.id && addingIngredient?.sizeId === size.id;

                      return (
                        <div key={size.id} className="rounded-lg p-3" style={{ backgroundColor: colors.cream }}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="font-semibold" style={{ color: colors.brown }}>{size.name}</div>
                            <button
                              onClick={async () => {
                                if (sizeIngredients.length > 0) {
                                  if (!window.confirm(`Remove "${size.name}" and all its items from this template?`)) return;
                                  await onRemoveTemplateSize(template.id, size.id);
                                }
                                setPendingSizes(prev => ({
                                  ...prev,
                                  [template.id]: (prev[template.id] || []).filter(id => id !== size.id),
                                }));
                              }}
                              className="p-0.5 rounded hover:bg-black/5"
                              title="Remove size"
                              data-testid={`button-remove-size-${size.id}`}
                            >
                              <X className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
                            </button>
                          </div>

                          {sizeIngredients.map(ing => {
                            const ingredient = ingredients.find(i => i.id === ing.ingredient_id);
                            const displayUnit = ing.unit || ingredient?.usage_unit || ingredient?.unit || 'each';
                            return (
                              <div key={ing.id} className="flex items-center justify-between text-sm mb-1">
                                <span style={{ color: colors.brownLight }}>
                                  {ingredient?.name || 'Unknown'} — {ing.quantity} {displayUnit}
                                </span>
                                <button
                                  onClick={() => onDeleteTemplateIngredient(ing.id)}
                                  className="p-1 rounded hover:bg-red-50 shrink-0"
                                  title="Remove item"
                                  data-testid={`button-delete-ing-${ing.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                                </button>
                              </div>
                            );
                          })}

                          {isAdding ? (
                            <div className="mt-2 space-y-2">
                              <select
                                value={newIngredient.ingredient_id}
                                onChange={(e) => {
                                  const sel = ingredients.find(i => i.id === e.target.value);
                                  setNewIngredient({
                                    ...newIngredient,
                                    ingredient_id: e.target.value,
                                    unit: sel?.usage_unit || sel?.unit || 'each',
                                  });
                                }}
                                className="w-full px-2 py-1 rounded border text-sm"
                                style={{ borderColor: colors.gold }}
                                data-testid={`select-ing-${size.id}`}
                              >
                                <option value="">Select ingredient</option>
                                {ingredients
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(ing => (
                                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.ingredient_type || 'FOH Ingredient'})</option>
                                  ))}
                              </select>
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={newIngredient.quantity}
                                  onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                                  className="flex-1 px-2 py-1 rounded border text-sm"
                                  style={{ borderColor: colors.gold }}
                                  placeholder="Qty"
                                  data-testid={`input-qty-${size.id}`}
                                />
                                <select
                                  value={(() => {
                                    if (newIngredient.unit) return newIngredient.unit;
                                    const sel = ingredients.find(i => i.id === newIngredient.ingredient_id);
                                    return sel?.usage_unit || sel?.unit || 'each';
                                  })()}
                                  onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                                  className="flex-1 px-2 py-1 rounded border text-sm"
                                  style={{ borderColor: colors.gold }}
                                  data-testid={`select-unit-${size.id}`}
                                >
                                  {(() => {
                                    const sel = ingredients.find(i => i.id === newIngredient.ingredient_id);
                                    const defaultUnit = sel?.usage_unit || sel?.unit || 'each';
                                    const units = ['each', 'oz', 'lb', 'gram', 'ml'];
                                    const sortedUnits = [defaultUnit, ...units.filter(u => u !== defaultUnit)];
                                    return sortedUnits.map(u => (
                                      <option key={u} value={u}>{u}</option>
                                    ));
                                  })()}
                                </select>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleAddIngredient(template.id, size.id)}
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ backgroundColor: colors.gold, color: colors.white }}
                                  data-testid={`button-confirm-ing-${size.id}`}
                                >
                                  Add
                                </button>
                                <button
                                  onClick={() => setAddingIngredient(null)}
                                  className="text-xs px-2 py-1 rounded"
                                  style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                                  data-testid={`button-cancel-ing-${size.id}`}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <button
                                onClick={() => setAddingIngredient({ templateId: template.id, sizeId: size.id })}
                                className="text-sm font-medium"
                                style={{ color: colors.gold }}
                                data-testid={`button-add-ing-${size.id}`}
                              >
                                + Add Item
                              </button>
                              {sizeIngredients.length === 0 && templateSizes.filter(s => s.id !== size.id && (template.ingredients || []).some(i => i.size_id === s.id)).length > 0 && (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleCopyFromSize(template, size.id, e.target.value);
                                      e.target.value = '';
                                    }
                                  }}
                                  disabled={copying}
                                  className="text-xs px-2 py-1 rounded border"
                                  style={{ borderColor: colors.gold, color: colors.brownLight }}
                                  data-testid={`select-copy-${size.id}`}
                                >
                                  <option value="">Copy from...</option>
                                  {templateSizes
                                    .filter(s => s.id !== size.id && (template.ingredients || []).some(i => i.size_id === s.id))
                                    .map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))
                                  }
                                </select>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add Size button */}
                    <Popover open={addingSizeFor === template.id} onOpenChange={(open) => {
                      setAddingSizeFor(open ? template.id : null);
                      if (!open) {
                        setCreatingSize(false);
                        setNewSizeName('');
                        setNewSizeOz('');
                      }
                    }}>
                      <PopoverTrigger asChild>
                        <button
                          className="rounded-lg p-3 border-2 border-dashed flex flex-col items-center justify-center gap-2 min-h-[80px] transition-colors hover:border-solid"
                          style={{ borderColor: colors.gold, color: colors.brownLight }}
                          data-testid={`button-add-size-${template.id}`}
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-sm font-medium">Add Size</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start">
                        {creatingSize ? (
                          <div className="p-3 space-y-2">
                            <p className="text-sm font-semibold" style={{ color: colors.brown }}>New Size</p>
                            <input
                              type="text"
                              placeholder="Name (e.g., 24oz Cold, Small Box)"
                              value={newSizeName}
                              onChange={(e) => setNewSizeName(e.target.value)}
                              className="w-full px-2 py-1.5 rounded border text-sm"
                              style={{ borderColor: colors.gold }}
                              autoFocus
                              data-testid="input-new-size-name"
                            />
                            <input
                              type="number"
                              placeholder="Size (oz) — 0 for non-liquid"
                              value={newSizeOz}
                              onChange={(e) => setNewSizeOz(e.target.value)}
                              className="w-full px-2 py-1.5 rounded border text-sm"
                              style={{ borderColor: colors.gold }}
                              data-testid="input-new-size-oz"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!newSizeName.trim()) return;
                                  try {
                                    const newId = await onAddProductSize({
                                      name: newSizeName.trim(),
                                      size_value: parseFloat(newSizeOz) || 0,
                                      product_type: template.drink_type,
                                    });
                                    setPendingSizes(prev => ({
                                      ...prev,
                                      [template.id]: [...(prev[template.id] || []), newId],
                                    }));
                                    setAddingSizeFor(null);
                                    setCreatingSize(false);
                                    setNewSizeName('');
                                    setNewSizeOz('');
                                  } catch (err: any) {
                                    alert('Error creating size: ' + err.message);
                                  }
                                }}
                                className="flex-1 px-2 py-1.5 rounded text-sm font-medium"
                                style={{ backgroundColor: colors.gold, color: colors.white }}
                                data-testid="button-save-new-size"
                              >
                                Create
                              </button>
                              <button
                                onClick={() => {
                                  setCreatingSize(false);
                                  setNewSizeName('');
                                  setNewSizeOz('');
                                }}
                                className="flex-1 px-2 py-1.5 rounded text-sm font-medium"
                                style={{ backgroundColor: colors.creamDark, color: colors.brown }}
                              >
                                Back
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-1">
                            {(() => {
                              const matchingType = productSizes.filter(s =>
                                (s.product_type || '').toLowerCase() === (template.drink_type || '').toLowerCase()
                                && !allShownSizeIds.includes(s.id)
                              );
                              const otherSizes = productSizes.filter(s =>
                                (s.product_type || '').toLowerCase() !== (template.drink_type || '').toLowerCase()
                                && !allShownSizeIds.includes(s.id)
                                && s.product_type !== 'bulk'
                              );

                              return (
                                <>
                                  {matchingType.length > 0 && (
                                    <>
                                      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.brownLight }}>
                                        {template.drink_type} sizes
                                      </p>
                                      {matchingType.map(size => (
                                        <button
                                          key={size.id}
                                          onClick={() => {
                                            setPendingSizes(prev => ({
                                              ...prev,
                                              [template.id]: [...(prev[template.id] || []), size.id],
                                            }));
                                            setAddingSizeFor(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 transition-colors"
                                          style={{ color: colors.brown }}
                                          data-testid={`option-size-${size.id}`}
                                        >
                                          {size.name}
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {otherSizes.length > 0 && (
                                    <>
                                      <div className="border-t my-1" style={{ borderColor: colors.creamDark }} />
                                      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: colors.brownLight }}>
                                        Other sizes
                                      </p>
                                      {otherSizes.map(size => (
                                        <button
                                          key={size.id}
                                          onClick={() => {
                                            setPendingSizes(prev => ({
                                              ...prev,
                                              [template.id]: [...(prev[template.id] || []), size.id],
                                            }));
                                            setAddingSizeFor(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 transition-colors"
                                          style={{ color: colors.brown }}
                                          data-testid={`option-size-${size.id}`}
                                        >
                                          {size.name} <span className="text-xs" style={{ color: colors.brownLight }}>({size.product_type})</span>
                                        </button>
                                      ))}
                                    </>
                                  )}
                                  {matchingType.length === 0 && otherSizes.length === 0 && (
                                    <p className="px-3 py-2 text-sm" style={{ color: colors.brownLight }}>
                                      No more existing sizes available.
                                    </p>
                                  )}
                                  <div className="border-t my-1" style={{ borderColor: colors.creamDark }} />
                                  <button
                                    onClick={() => setCreatingSize(true)}
                                    className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-black/5 transition-colors flex items-center gap-2"
                                    style={{ color: colors.gold }}
                                    data-testid="button-create-new-size"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Create new size
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {baseTemplates.length === 0 && (
          <div className="text-center py-10">
            <Layers className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>No recipe bases yet</h3>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Create recipe bases to define shared starting ingredients (cups, lids, bulk food items) across your recipes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
