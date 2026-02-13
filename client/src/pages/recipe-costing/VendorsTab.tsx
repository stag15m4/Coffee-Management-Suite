import { useState } from 'react';
import { Check, Plus, Pencil, Trash2, Truck, Phone, Mail, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import { formatCurrency } from './utils';
import type { Ingredient } from './types';
import type { RecipeVendor } from '@/lib/supabase-queries';

interface VendorsTabProps {
  ingredients: Ingredient[];
  recipeVendors: RecipeVendor[];
  tenantId: string;
  onUpdateIngredientCost: (id: string, cost: number) => Promise<void>;
  onAddVendor: (vendor: { tenant_id: string; name: string; phone?: string; email?: string; notes?: string }) => Promise<RecipeVendor>;
  onUpdateVendor: (id: string, updates: Partial<RecipeVendor>) => Promise<RecipeVendor>;
  onDeleteVendor: (id: string) => Promise<void>;
}

export const VendorsTab = ({ ingredients, recipeVendors, tenantId, onUpdateIngredientCost, onAddVendor, onUpdateVendor, onDeleteVendor }: VendorsTabProps) => {
  const { toast } = useToast();
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState<string>('');
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<RecipeVendor | null>(null);
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  const resetVendorForm = () => {
    setVendorForm({ name: '', phone: '', email: '', notes: '' });
    setEditingVendor(null);
    setShowVendorForm(false);
  };

  const handleSaveVendor = async () => {
    if (!vendorForm.name.trim()) return;
    try {
      if (editingVendor) {
        await onUpdateVendor(editingVendor.id, {
          name: vendorForm.name.trim(),
          phone: vendorForm.phone.trim() || null,
          email: vendorForm.email.trim() || null,
          notes: vendorForm.notes.trim() || null,
        });
        toast({ title: 'Vendor updated' });
      } else {
        await onAddVendor({
          tenant_id: tenantId,
          name: vendorForm.name.trim(),
          phone: vendorForm.phone.trim() || undefined,
          email: vendorForm.email.trim() || undefined,
          notes: vendorForm.notes.trim() || undefined,
        });
        toast({ title: 'Vendor added' });
      }
      resetVendorForm();
    } catch (error: any) {
      toast({ title: 'Error saving vendor', description: error?.message || 'Please try again', variant: 'destructive' });
    }
  };

  const openEditVendor = (vendor: RecipeVendor) => {
    setEditingVendor(vendor);
    setVendorForm({
      name: vendor.name,
      phone: vendor.phone || '',
      email: vendor.email || '',
      notes: vendor.notes || '',
    });
    setShowVendorForm(true);
  };

  const vendors = Array.from(new Set(ingredients.map(i => i.vendor).filter(Boolean))) as string[];

  const vendorData = vendors.map(vendor => {
    const vendorIngredients = ingredients.filter(i => i.vendor === vendor);
    const totalValue = vendorIngredients.reduce((sum, ing) => sum + (Number(ing.cost) || 0), 0);
    return {
      name: vendor,
      ingredients: vendorIngredients,
      itemCount: vendorIngredients.length,
      totalValue,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  const displayedVendors = selectedVendor === 'all'
    ? vendorData
    : vendorData.filter(v => v.name === selectedVendor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: colors.brown }}>Vendor:</span>
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="px-4 py-2 rounded-lg border-2 outline-none"
            style={{ borderColor: colors.creamDark, color: colors.brown }}
            data-testid="select-vendor-filter"
          >
            <option value="all">All Vendors ({vendors.length})</option>
            {vendors.sort().map(vendor => (
              <option key={vendor} value={vendor}>{vendor}</option>
            ))}
          </select>
        </div>
        <div className="text-sm" style={{ color: colors.brownLight }}>
          {ingredients.filter(i => !i.vendor).length > 0 && (
            <span>{ingredients.filter(i => !i.vendor).length} items without vendor</span>
          )}
        </div>
      </div>

      {/* Vendor Profiles Section */}
      <div className="rounded-xl shadow-md overflow-hidden" style={{ backgroundColor: colors.white }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: colors.brown }}>
          <h3 className="font-bold text-white">Vendor Profiles</h3>
          <button
            onClick={() => { resetVendorForm(); setShowVendorForm(true); }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: colors.gold, color: colors.brown }}
            data-testid="button-add-vendor"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Vendor
          </button>
        </div>
        <div className="p-4">
          {showVendorForm && (
            <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: colors.cream }}>
              <h4 className="font-semibold mb-3" style={{ color: colors.brown }}>
                {editingVendor ? 'Edit Vendor' : 'New Vendor'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: colors.brownLight }}>Name *</label>
                  <input
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Vendor name"
                    className="w-full px-3 py-2 rounded-lg border-0 outline-none text-sm"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid="input-vendor-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: colors.brownLight }}>Phone</label>
                  <input
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 rounded-lg border-0 outline-none text-sm"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid="input-vendor-phone"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: colors.brownLight }}>Email</label>
                  <input
                    type="email"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="sales@vendor.com"
                    className="w-full px-3 py-2 rounded-lg border-0 outline-none text-sm"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid="input-vendor-email"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: colors.brownLight }}>Notes</label>
                  <input
                    value={vendorForm.notes}
                    onChange={(e) => setVendorForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Account #, rep name, delivery schedule..."
                    className="w-full px-3 py-2 rounded-lg border-0 outline-none text-sm"
                    style={{ backgroundColor: colors.inputBg, color: colors.brown }}
                    data-testid="input-vendor-notes"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveVendor}
                  disabled={!vendorForm.name.trim()}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: colors.gold, color: colors.brown }}
                  data-testid="button-save-vendor"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingVendor ? 'Update' : 'Save'}
                </button>
                <button
                  onClick={resetVendorForm}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ color: colors.brownLight }}
                  data-testid="button-cancel-vendor"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {recipeVendors.length === 0 && !showVendorForm ? (
            <div className="text-center py-6">
              <Truck className="w-8 h-8 mx-auto mb-2" style={{ color: colors.brownLight }} />
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Add vendor profiles to store contact info, account numbers, and notes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recipeVendors.map(vendor => {
                const vendorIngredientCount = ingredients.filter(i => i.vendor === vendor.name).length;
                return (
                  <div
                    key={vendor.id}
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: colors.creamDark }}
                    data-testid={`vendor-profile-${vendor.id}`}
                  >
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedProfile(expandedProfile === vendor.id ? null : vendor.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: colors.cream, color: colors.brown }}>
                          {vendor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm" style={{ color: colors.brown }}>{vendor.name}</div>
                          {vendorIngredientCount > 0 && (
                            <div className="text-xs" style={{ color: colors.brownLight }}>{vendorIngredientCount} ingredients</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {vendor.phone && <Phone className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />}
                        {vendor.email && <Mail className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />}
                        {vendor.notes && <FileText className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />}
                      </div>
                    </button>

                    {expandedProfile === vendor.id && (
                      <div className="px-4 pb-3 pt-1 space-y-2" style={{ borderTop: `1px solid ${colors.cream}` }}>
                        {vendor.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
                            <a href={`tel:${vendor.phone}`} className="hover:underline" style={{ color: colors.brown }}>{vendor.phone}</a>
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-3.5 h-3.5" style={{ color: colors.brownLight }} />
                            <a href={`mailto:${vendor.email}`} className="hover:underline" style={{ color: colors.brown }}>{vendor.email}</a>
                          </div>
                        )}
                        {vendor.notes && (
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="w-3.5 h-3.5 mt-0.5" style={{ color: colors.brownLight }} />
                            <span style={{ color: colors.brownLight }}>{vendor.notes}</span>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => openEditVendor(vendor)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium"
                            style={{ backgroundColor: colors.cream, color: colors.brown }}
                            data-testid={`button-edit-vendor-${vendor.id}`}
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteVendor(vendor.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium hover:bg-red-50"
                            style={{ color: '#ef4444' }}
                            data-testid={`button-delete-vendor-${vendor.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Vendor ingredient cards */}
      <div className="grid gap-4">
        {displayedVendors.map(vendor => (
          <div
            key={vendor.name}
            className="rounded-xl shadow-md overflow-hidden"
            style={{ backgroundColor: colors.white }}
            data-testid={`card-vendor-${vendor.name}`}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: colors.brown }}>
              <div>
                <h3 className="font-bold text-white">{vendor.name}</h3>
                <div className="flex items-center gap-3 text-sm text-white/60">
                  <span>{vendor.itemCount} items</span>
                  {(() => {
                    const profile = recipeVendors.find(v => v.name === vendor.name);
                    if (!profile) return null;
                    return (
                      <>
                        {profile.phone && (
                          <a href={`tel:${profile.phone}`} className="flex items-center gap-1 hover:text-white/90">
                            <Phone className="w-3 h-3" /> {profile.phone}
                          </a>
                        )}
                        {profile.email && (
                          <a href={`mailto:${profile.email}`} className="flex items-center gap-1 hover:text-white/90">
                            <Mail className="w-3 h-3" /> {profile.email}
                          </a>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-white/60">Total Spend</div>
                <div className="font-bold font-mono text-white">
                  {formatCurrency(vendor.totalValue)}
                </div>
              </div>
            </div>

            <div className="p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.creamDark}` }}>
                    <th className="py-2 px-2 text-left font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Product</th>
                    <th className="py-2 px-2 text-left font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Category</th>
                    <th className="py-2 px-2 text-right font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Cost</th>
                    <th className="py-2 px-2 text-right font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Quantity</th>
                    <th className="py-2 px-2 text-left font-medium text-xs uppercase tracking-wider" style={{ color: colors.brownLight }}>Item #</th>
                  </tr>
                </thead>
                <tbody>
                  {vendor.ingredients.map(ing => (
                    <tr
                      key={ing.id}
                      style={{ borderBottom: `1px solid ${colors.cream}` }}
                      data-testid={`row-vendor-item-${ing.id}`}
                    >
                      <td className="py-2 font-medium" style={{ color: colors.brown }}>{ing.name}</td>
                      <td className="py-2" style={{ color: colors.brownLight }}>{ing.category_name}</td>
                      <td className="py-2 text-right font-mono" style={{ color: colors.brown }}>
                        {editingCost === ing.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editCostValue}
                            onChange={(e) => setEditCostValue(e.target.value)}
                            onBlur={async () => {
                              const newCost = parseFloat(editCostValue);
                              if (!isNaN(newCost) && newCost !== Number(ing.cost)) {
                                await onUpdateIngredientCost(ing.id, newCost);
                              }
                              setEditingCost(null);
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const newCost = parseFloat(editCostValue);
                                if (!isNaN(newCost) && newCost !== Number(ing.cost)) {
                                  await onUpdateIngredientCost(ing.id, newCost);
                                }
                                setEditingCost(null);
                              } else if (e.key === 'Escape') {
                                setEditingCost(null);
                              }
                            }}
                            autoFocus
                            className="w-20 px-2 py-1 text-right rounded border"
                            style={{ borderColor: colors.gold, backgroundColor: colors.inputBg }}
                            data-testid={`input-cost-${ing.id}`}
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditingCost(ing.id);
                              setEditCostValue(String(ing.cost || 0));
                            }}
                            className="hover:underline cursor-pointer"
                            style={{ color: colors.brown }}
                            data-testid={`button-edit-cost-${ing.id}`}
                          >
                            {formatCurrency(ing.cost)}
                          </button>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono" style={{ color: colors.brownLight }}>
                        {ing.quantity} {ing.unit}
                      </td>
                      <td className="py-2" style={{ color: colors.brownLight }}>
                        {ing.item_number || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {displayedVendors.length === 0 && (
          <div className="text-center py-10">
            <Truck className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
            <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>No vendors found</h3>
            <p className="text-sm" style={{ color: colors.brownLight }}>
              Add vendor information to your ingredients to see them grouped here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
