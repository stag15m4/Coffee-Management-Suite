import { getErrorMessage } from '@/lib/utils';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useAppResume } from '@/hooks/use-app-resume';
import { useLocationChange } from '@/hooks/use-location-change';
import { escapeHtml } from '@/lib/escapeHtml';
import { closeWindowScript } from '@/components/tip-payout/export-helpers';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, Plus, Trash2, Edit2, Save, X, Coffee, ShoppingCart, Store } from 'lucide-react';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { showDeleteUndoToast } from '@/hooks/use-delete-with-undo';
import { colors } from '@/lib/colors';

const localColors = {
  teal: '#4A7C8C',
};

interface CoffeeProduct {
  id: string;
  sku: string;
  name: string;
  size: string;
  category: string;
  default_price: number;
  is_active: boolean;
  display_order: number;
  vendor_id: string | null;
}

interface CoffeeVendor {
  id: string;
  display_name: string;
  contact_email: string;
  cc_email: string;
  logo_url: string;
  notes: string;
  supports_retail_labels: boolean;
}

interface OrderHistoryItem {
  id: string;
  order_date: string;
  items: Record<string, number>;
  retail_labels?: Record<string, number> | null;
  units: number;
  total_cost: number | null;
  notes?: string;
  sent_to_vendor: boolean;
  vendor_id?: string | null;
  received_at?: string | null;
}

export default function CoffeeOrder() {
  const { tenant, branding, primaryTenant } = useAuth();

  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : branding?.company_name || tenant?.name || 'Erwin Mills Coffee';
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [orderItems, setOrderItems] = useState<Record<string, number>>({});
  const [retailLabels, setRetailLabels] = useState<Record<string, number>>({});
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Multi-vendor state
  const [vendors, setVendors] = useState<CoffeeVendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<CoffeeProduct[]>([]);

  // Vendor form state (for add/edit)
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vendorForm, setVendorForm] = useState({
    display_name: '',
    contact_email: '',
    cc_email: '',
    supports_retail_labels: true,
  });
  const [addingVendor, setAddingVendor] = useState(false);
  const [newVendorForm, setNewVendorForm] = useState({
    display_name: '',
    contact_email: '',
    cc_email: '',
    supports_retail_labels: true,
  });

  const [newProduct, setNewProduct] = useState({ name: '', size: '', category: '', default_price: '' });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProductForm, setEditProductForm] = useState({ name: '', size: '', category: '', default_price: '' });

  // Derived: selected vendor object
  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId) || null,
    [vendors, selectedVendorId]
  );

  // Derived: products for selected vendor
  const products = useMemo(
    () => allProducts.filter((p) => p.vendor_id === selectedVendorId),
    [allProducts, selectedVendorId]
  );

  // Derived: order history for selected vendor
  const vendorHistory = useMemo(() => {
    if (!selectedVendorId) return orderHistory;
    return orderHistory.filter((o) => o.vendor_id === selectedVendorId);
  }, [orderHistory, selectedVendorId]);

  useEffect(() => {
    if (tenant?.id) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [tenant?.id]);

  const loadData = useCallback(
    async (silent = false) => {
      if (!tenant?.id) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const [vendorRes, productsRes, historyRes] = await Promise.all([
          supabase.from('tenant_coffee_vendors').select('*').eq('tenant_id', tenant.id).order('created_at'),
          supabase
            .from('tenant_coffee_products')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('is_active', true)
            .order('display_order'),
          supabase
            .from('coffee_order_history')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('order_date', { ascending: false })
            .limit(50),
        ]);

        if (vendorRes.error)
          toast({ title: 'Failed to load vendors', description: vendorRes.error.message, variant: 'destructive' });
        if (productsRes.error)
          toast({ title: 'Failed to load products', description: productsRes.error.message, variant: 'destructive' });
        if (historyRes.error)
          toast({
            title: 'Failed to load order history',
            description: historyRes.error.message,
            variant: 'destructive',
          });

        const loadedVendors: CoffeeVendor[] = (vendorRes.data || []).map((v: any) => ({
          ...v,
          supports_retail_labels: v.supports_retail_labels ?? true,
        }));
        setVendors(loadedVendors);

        // Auto-select first vendor if none selected or selected no longer exists
        if (loadedVendors.length > 0) {
          setSelectedVendorId((prev) => {
            if (prev && loadedVendors.some((v) => v.id === prev)) return prev;
            return loadedVendors[0].id;
          });
        } else {
          setSelectedVendorId(null);
        }

        if (productsRes.data) {
          setAllProducts(
            productsRes.data.map((p: any) => ({
              ...p,
              default_price: parseFloat(String(p.default_price || 0)),
            }))
          );
        }

        if (historyRes.data) {
          setOrderHistory(historyRes.data);
        }
      } catch (error: unknown) {
        console.error('Error loading coffee data:', error);
        toast({ title: 'Error loading data', description: getErrorMessage(error), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    },
    [tenant?.id, toast]
  );

  // Refresh data when app resumes from background (iPad multitasking)
  useAppResume(() => {
    if (tenant?.id) {
      loadData(true);
    }
  }, [tenant?.id, loadData]);

  // Refresh data when location changes
  useLocationChange(() => {
    loadData();
  }, [loadData]);

  // Clear order when switching vendors
  const switchVendor = (vendorId: string) => {
    if (vendorId === selectedVendorId) return;
    setOrderItems({});
    setRetailLabels({});
    setOrderNotes('');
    setSelectedVendorId(vendorId);
  };

  // =====================================================
  // VENDOR CRUD
  // =====================================================

  const saveVendor = async (vendorId: string) => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenant_coffee_vendors')
        .update({
          display_name: vendorForm.display_name || 'Vendor',
          contact_email: vendorForm.contact_email || '',
          cc_email: vendorForm.cc_email || '',
          supports_retail_labels: vendorForm.supports_retail_labels,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendorId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      toast({ title: 'Vendor settings saved' });
      setEditingVendorId(null);
      loadData();
    } catch (error: unknown) {
      toast({ title: 'Error saving vendor', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addVendor = async () => {
    if (!tenant?.id) return;
    if (!newVendorForm.display_name.trim()) {
      toast({ title: 'Vendor name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('tenant_coffee_vendors')
        .insert({
          tenant_id: tenant.id,
          display_name: newVendorForm.display_name.trim(),
          contact_email: newVendorForm.contact_email || '',
          cc_email: newVendorForm.cc_email || '',
          supports_retail_labels: newVendorForm.supports_retail_labels,
        })
        .select()
        .single();

      if (error) throw error;
      toast({ title: `${newVendorForm.display_name.trim()} added` });
      setNewVendorForm({ display_name: '', contact_email: '', cc_email: '', supports_retail_labels: true });
      setAddingVendor(false);
      // Select the new vendor
      if (data?.id) setSelectedVendorId(data.id);
      loadData();
    } catch (error: unknown) {
      toast({ title: 'Error adding vendor', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteVendor = async (vendorId: string) => {
    const vendorToDelete = vendors.find((v) => v.id === vendorId);
    const name = vendorToDelete?.display_name || 'this vendor';
    if (
      !(await confirm({
        title: `Remove ${name}?`,
        description: 'This will also remove all products and order history for this vendor. This cannot be undone.',
        confirmLabel: 'Remove',
        variant: 'destructive',
      }))
    )
      return;

    try {
      const { error } = await supabase
        .from('tenant_coffee_vendors')
        .delete()
        .eq('id', vendorId)
        .eq('tenant_id', tenant!.id);

      if (error) throw error;
      toast({ title: `${name} removed` });
      if (selectedVendorId === vendorId) {
        setSelectedVendorId(null);
        setOrderItems({});
        setRetailLabels({});
      }
      loadData();
    } catch (error: unknown) {
      toast({ title: 'Error removing vendor', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const startEditVendor = (vendor: CoffeeVendor) => {
    setEditingVendorId(vendor.id);
    setVendorForm({
      display_name: vendor.display_name || '',
      contact_email: vendor.contact_email || '',
      cc_email: vendor.cc_email || '',
      supports_retail_labels: vendor.supports_retail_labels,
    });
  };

  // =====================================================
  // PRODUCT CRUD
  // =====================================================

  const normalizeCategory = (cat: string): string => {
    return cat.trim().toLowerCase().replace(/\s+/g, '').replace(/oz$/, 'oz');
  };

  const parsePrice = (value: string): number => {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : Math.max(0, num);
  };

  const addProduct = async () => {
    if (!tenant?.id || !selectedVendorId) return;
    if (!newProduct.name.trim()) {
      toast({ title: 'Product name is required', variant: 'destructive' });
      return;
    }
    const price = parsePrice(newProduct.default_price);
    if (newProduct.default_price && price === 0) {
      toast({ title: 'Please enter a valid price', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const sizeValue = newProduct.size.trim() || 'unit';
      const categoryValue = normalizeCategory(newProduct.category || sizeValue);
      const sku = `${newProduct.name.trim().toLowerCase().replace(/\s+/g, '-')}-${sizeValue.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const { error } = await supabase.from('tenant_coffee_products').insert({
        tenant_id: tenant.id,
        vendor_id: selectedVendorId,
        sku,
        name: newProduct.name.trim(),
        size: sizeValue,
        category: categoryValue,
        default_price: price,
        display_order: products.length,
      });

      if (error) throw error;
      toast({ title: 'Product added' });
      setNewProduct({ name: '', size: '', category: '', default_price: '' });
      loadData();
    } catch (error: unknown) {
      toast({ title: 'Error adding product', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateProduct = async (productId: string) => {
    if (!tenant?.id) return;
    if (!editProductForm.name.trim()) {
      toast({ title: 'Product name is required', variant: 'destructive' });
      return;
    }
    const price = parsePrice(editProductForm.default_price);
    if (editProductForm.default_price && price === 0) {
      toast({ title: 'Please enter a valid price', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const sizeValue = editProductForm.size.trim() || 'unit';
      const categoryValue = normalizeCategory(editProductForm.category || sizeValue);
      const { error } = await supabase
        .from('tenant_coffee_products')
        .update({
          name: editProductForm.name.trim(),
          size: sizeValue,
          category: categoryValue,
          default_price: price,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      toast({ title: 'Product updated' });
      setEditingProductId(null);
      loadData();
    } catch (error: unknown) {
      toast({ title: 'Error updating product', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!tenant?.id) return;
    const name = products.find((p) => p.id === productId)?.name || 'this product';
    if (
      !(await confirm({
        title: `Remove ${name}?`,
        description: 'This cannot be undone.',
        confirmLabel: 'Remove',
        variant: 'destructive',
      }))
    )
      return;

    try {
      const { error } = await supabase
        .from('tenant_coffee_products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      showDeleteUndoToast({
        itemName: name,
        undo: { type: 'soft-reactivate', table: 'tenant_coffee_products', id: productId },
        onReload: loadData,
      });
      loadData();
    } catch (error: unknown) {
      toast({ title: 'Error removing product', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const startEditProduct = (product: CoffeeProduct) => {
    setEditingProductId(product.id);
    setEditProductForm({
      name: product.name,
      size: product.size,
      category: product.category,
      default_price: product.default_price.toString(),
    });
  };

  // =====================================================
  // ORDER LOGIC
  // =====================================================

  const updateQty = (productId: string, delta: number) => {
    setOrderItems((prev) => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQty };
    });
  };

  const setQty = (productId: string, value: string) => {
    const qty = Math.max(0, parseInt(value) || 0);
    setOrderItems((prev) => {
      if (qty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: qty };
    });
  };

  const setRetailLabelCount = (productId: string, value: string) => {
    const count = Math.max(0, parseInt(value) || 0);
    const maxQty = orderItems[productId] || 0;
    const clamped = Math.min(count, maxQty);
    setRetailLabels((prev) => {
      if (clamped === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: clamped };
    });
  };

  // Auto-clamp retail labels when quantity decreases or item is removed
  useEffect(() => {
    setRetailLabels((prev) => {
      const updated = { ...prev };
      let changed = false;
      for (const [productId, labelCount] of Object.entries(updated)) {
        const qty = orderItems[productId] || 0;
        if (qty === 0) {
          delete updated[productId];
          changed = true;
        } else if (labelCount > qty) {
          updated[productId] = qty;
          changed = true;
        }
      }
      return changed ? updated : prev;
    });
  }, [orderItems]);

  const calculateTotalCost = () => {
    let total = 0;
    for (const [id, qty] of Object.entries(orderItems)) {
      const product = allProducts.find((p) => p.id === id);
      const price = product?.default_price || 0;
      total += price * qty;
    }
    return total;
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const totalUnits = Object.values(orderItems).reduce((a, b) => a + b, 0);
  const totalItems = Object.keys(orderItems).length;
  const totalCost = calculateTotalCost();

  // Retail label totals — only relevant when vendor supports them
  const showRetailLabels = selectedVendor?.supports_retail_labels ?? false;

  const totalRetailLabels5lb = Object.entries(retailLabels).reduce((sum, [id, count]) => {
    return sum + (orderItems[id] ? count : 0);
  }, 0);
  const total12ozUnits = Object.entries(orderItems).reduce((sum, [id, qty]) => {
    const product = allProducts.find((p) => p.id === id);
    return sum + (normalizeCategory(product?.category || '') === '12oz' ? qty : 0);
  }, 0);
  const totalRetailLabelsAll = totalRetailLabels5lb + total12ozUnits;

  const clearOrder = () => {
    setOrderItems({});
    setRetailLabels({});
    setOrderNotes('');
    toast({ title: 'Order cleared' });
  };

  const markReceived = async (order: OrderHistoryItem) => {
    const receivedAt = new Date().toISOString();
    const { error } = await supabase
      .from('coffee_order_history')
      .update({ received_at: receivedAt })
      .eq('id', order.id);
    if (error) {
      toast({ title: 'Failed to mark received', description: error.message, variant: 'destructive' });
      return;
    }
    setOrderHistory((prev) => prev.map((o) => (o.id === order.id ? { ...o, received_at: receivedAt } : o)));
    toast({ title: 'Order marked received' });
  };

  const saveToHistory = async (sentToVendor = false) => {
    if (!tenant?.id || totalItems === 0) return;

    setSaving(true);
    try {
      const retailLabelsToSave = showRetailLabels && Object.keys(retailLabels).length > 0 ? retailLabels : null;

      const { error } = await supabase.from('coffee_order_history').insert({
        tenant_id: tenant.id,
        vendor_id: selectedVendorId,
        items: orderItems,
        retail_labels: retailLabelsToSave,
        units: totalUnits,
        total_cost: totalCost,
        notes: orderNotes || null,
        sent_to_vendor: sentToVendor,
        vendor_email: sentToVendor ? selectedVendor?.contact_email : null,
      });

      if (error) throw error;

      toast({ title: sentToVendor ? 'Order sent and saved!' : 'Order saved to history' });
      clearOrder();
      loadData();
    } catch (error: unknown) {
      toast({ title: 'Error saving order', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const sendOrder = async () => {
    if (!selectedVendor?.contact_email) {
      toast({ title: 'Please set vendor email in Settings', variant: 'destructive' });
      setShowSettings(true);
      return;
    }

    if (totalItems === 0) {
      toast({ title: 'No items in order', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const orderItemsForEmail = Object.entries(orderItems)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, qty]) => {
          const product = allProducts.find((p) => p.id === productId);
          const productCategory = normalizeCategory(product?.category || '');
          const is12oz = productCategory === '12oz';
          return {
            name: product?.name || 'Unknown',
            size: product?.size || '',
            quantity: qty,
            price: product?.default_price || 0,
            retailLabels: showRetailLabels ? (is12oz ? qty : retailLabels[productId] || 0) : undefined,
            category: productCategory,
          };
        });

      const { getAuthHeaders } = await import('@/lib/api-helpers');
      const response = await fetch('/api/coffee-order/send-email', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          vendorEmail: selectedVendor.contact_email,
          ccEmail: selectedVendor.cc_email || '',
          vendorName: selectedVendor.display_name,
          orderItems: orderItemsForEmail,
          totalUnits,
          totalCost,
          notes: orderNotes,
          tenantName: tenant?.name || 'Customer',
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Order sent successfully!' });
        await saveToHistory(true);
      } else {
        toast({
          title: 'Failed to send email',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      toast({
        title: 'Failed to send order',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const loadOrder = (order: OrderHistoryItem) => {
    // If the order belongs to a different vendor, switch to that vendor first
    if (order.vendor_id && order.vendor_id !== selectedVendorId) {
      setSelectedVendorId(order.vendor_id);
    }
    setOrderItems(order.items);
    setRetailLabels(order.retail_labels || {});
    setShowHistory(false);
    toast({ title: 'Previous order loaded' });
  };

  const vendorName = selectedVendor?.display_name || 'Vendor';

  // =====================================================
  // EXPORT FUNCTIONS
  // =====================================================

  const exportCSV = () => {
    if (vendorHistory.length === 0) {
      toast({ title: 'No order history to export', variant: 'destructive' });
      return;
    }

    const hasLabels = showRetailLabels;
    let csv = hasLabels ? 'Date,Units,Total Cost,Items,Retail Labels\n' : 'Date,Units,Total Cost,Items\n';
    vendorHistory.forEach((order) => {
      const date = new Date(order.order_date).toLocaleDateString('en-US');
      const cost = order.total_cost ? order.total_cost.toFixed(2) : '0.00';
      const orderRetailLabels = order.retail_labels || {};
      const items = Object.entries(order.items)
        .map(([id, qty]) => {
          const product = allProducts.find((p) => p.id === id);
          return product ? `${product.name} ${product.size} x${qty}` : `Unknown x${qty}`;
        })
        .filter(Boolean)
        .join('; ');

      if (hasLabels) {
        const labels = Object.entries(order.items)
          .map(([id, qty]) => {
            const product = allProducts.find((p) => p.id === id);
            const productCategory = normalizeCategory(product?.category || '');
            const retailCount = productCategory === '12oz' ? qty : orderRetailLabels[id] || 0;
            if (retailCount > 0) {
              return `${product?.name || 'Unknown'}: ${retailCount} retail`;
            }
            return null;
          })
          .filter(Boolean)
          .join('; ');
        csv += `"${date}",${order.units},$${cost},"${items}","${labels || 'none'}"\n`;
      } else {
        csv += `"${date}",${order.units},$${cost},"${items}"\n`;
      }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const csvUrl = URL.createObjectURL(blob);

    const dates = vendorHistory.map((o) => new Date(o.order_date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0].toLocaleDateString('en-US');
    const endDate = dates[dates.length - 1].toLocaleDateString('en-US');

    const downloadPage = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(vendorName)} Order CSV Export</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #4A3728;
            max-width: 600px;
            margin: 0 auto;
            text-align: center;
          }
          .container {
            border: 1px solid #C9A227;
            border-radius: 12px;
            padding: 40px;
            background: #FFFDF7;
          }
          h1 { color: #4A3728; margin-bottom: 10px; }
          p { color: #6B5344; margin: 10px 0; }
          .button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background-color: #C9A227;
            color: #4A3728;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 8px;
            cursor: pointer;
            border: none;
            font-size: 14px;
          }
          .button:hover { background-color: #b8911f; }
          .button.secondary {
            background-color: #f5f5f5;
            border: 1px solid #ddd;
          }
          .button.secondary:hover { background-color: #e5e5e5; }
          .info {
            background: #F5F0E1;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
          }
          .info p { margin: 5px 0; }
        </style>
        <script>${closeWindowScript}</script>
      </head>
      <body>
        <div class="container">
          <h1>CSV Export Ready</h1>
          <p>${escapeHtml(vendorName)} Order History</p>

          <div class="info">
            <p><strong>Vendor:</strong> ${escapeHtml(vendorName)}</p>
            <p><strong>Date Range:</strong> ${startDate} - ${endDate}</p>
            <p><strong>Total Orders:</strong> ${vendorHistory.length}</p>
          </div>

          <div style="margin: 30px 0;">
            <a href="${csvUrl}" download="${vendorName.toLowerCase().replace(/\s+/g, '-')}-orders.csv" class="button">
              Download CSV File
            </a>
          </div>

          <div>
            <button class="button secondary" onclick="closeAndReturn()">
              Close & Return to App
            </button>
          </div>
        </div>
      </body>
      </html>
    `;

    const downloadWindow = window.open('', '_blank');
    if (downloadWindow) {
      downloadWindow.document.write(downloadPage);
      downloadWindow.document.close();
    }
    toast({ title: 'CSV export ready' });
  };

  const exportPDF = () => {
    if (vendorHistory.length === 0) {
      toast({ title: 'No order history to export', variant: 'destructive' });
      return;
    }

    const hasLabels = showRetailLabels;
    let grandTotalUnits = 0;
    let grandTotalCost = 0;

    const productTotals: Record<
      string,
      {
        name: string;
        size: string;
        qty: number;
        totalCost: number;
        unitPrice: number;
        retailLabels: number;
        category: string;
      }
    > = {};

    vendorHistory.forEach((order) => {
      grandTotalUnits += order.units || 0;
      grandTotalCost += order.total_cost || 0;
      const orderRetailLabels = order.retail_labels || {};

      Object.entries(order.items).forEach(([id, qty]) => {
        const product = allProducts.find((p) => p.id === id);
        const unitPrice = product?.default_price || 0;
        const lineTotal = unitPrice * (qty as number);
        const productCategory = normalizeCategory(product?.category || '');

        if (!productTotals[id]) {
          productTotals[id] = {
            name: product?.name || 'Unknown',
            size: product?.size || '',
            qty: 0,
            totalCost: 0,
            unitPrice: unitPrice,
            retailLabels: 0,
            category: productCategory,
          };
        }
        productTotals[id].qty += qty as number;
        productTotals[id].totalCost += lineTotal;
        if (hasLabels) {
          if (productCategory === '12oz') {
            productTotals[id].retailLabels += qty as number;
          } else {
            productTotals[id].retailLabels += orderRetailLabels[id] || 0;
          }
        }
      });
    });

    const dates = vendorHistory.map((o) => new Date(o.order_date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0].toLocaleDateString('en-US');
    const endDate = dates[dates.length - 1].toLocaleDateString('en-US');

    const sortedOrders = [...vendorHistory].sort(
      (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    );

    const retailLabelHeader = hasLabels ? '<th>Retail Labels</th>' : '';
    const retailLabelColspan = hasLabels ? 3 : 2;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(vendorName)} Order History</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #4A3728; max-width: 800px; margin: 0 auto; }
          .back-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background-color: #C9A227;
            color: #4A3728;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin-bottom: 20px;
            cursor: pointer;
            border: none;
            font-size: 14px;
          }
          .back-button:hover { background-color: #b8911f; }
          @media print { .back-button, .no-print { display: none !important; } }
          .page {
            border: 1px solid #C9A227;
            border-radius: 8px;
            padding: 25px;
            background: #FFFDF7;
            margin-bottom: 30px;
            page-break-after: always;
          }
          .page:last-child { page-break-after: avoid; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; color: #4A3728; }
          .header h2 { margin: 5px 0; font-size: 18px; font-weight: normal; color: #6B5344; }
          .header p { margin: 5px 0; font-size: 14px; color: #6B5344; }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 20px 0;
            padding: 20px;
            background: #F5F0E1;
            border-radius: 8px;
          }
          .summary-item { font-size: 14px; }
          .summary-item strong { display: block; font-size: 20px; color: #4A3728; }
          .summary-item.highlight {
            grid-column: span 2;
            text-align: center;
            background: #C9A227;
            padding: 15px;
            border-radius: 8px;
            font-size: 18px;
          }
          .summary-item.highlight strong { font-size: 28px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background-color: #C9A227; color: #4A3728; padding: 12px 10px; text-align: left; font-weight: bold; }
          td { padding: 10px; border-bottom: 1px solid #E8E0CC; }
          .total-row { background-color: #C9A227; font-weight: bold; }
          .order-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #C9A227;
          }
          .order-header h3 { margin: 0; font-size: 18px; }
          .order-header .order-total { font-size: 16px; color: #C9A227; font-weight: bold; }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #C9A227;
            margin: 25px 0 15px;
            padding-bottom: 5px;
            border-bottom: 1px solid #E8E0CC;
          }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; padding: 0; }
            .page { border: none; box-shadow: none; margin-bottom: 0; }
          }
        </style>
        <script>${closeWindowScript}</script>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px;">
          <button class="back-button" onclick="closeAndReturn()">
            Close & Return to App
          </button>
          <button class="back-button" onclick="window.print()" style="margin-left: 10px;">
            Print / Save as PDF
          </button>
        </div>

        <!-- SUMMARY PAGE -->
        <div class="page">
          <div class="header">
            <h1>${escapeHtml(tenant?.name) || 'Order Report'}</h1>
            <h2>${escapeHtml(vendorName)} — Order Summary</h2>
            <p>${startDate} - ${endDate}</p>
          </div>

          <div class="summary-grid">
            <div class="summary-item">
              Total Orders
              <strong>${vendorHistory.length}</strong>
            </div>
            <div class="summary-item">
              Total Units Ordered
              <strong>${grandTotalUnits}</strong>
            </div>
            <div class="summary-item">
              Vendor
              <strong>${escapeHtml(vendorName)}</strong>
            </div>
            <div class="summary-item">
              Report Generated
              <strong>${new Date().toLocaleDateString('en-US')}</strong>
            </div>
            <div class="summary-item highlight">
              Total Spent
              <strong>${formatCurrency(grandTotalCost)}</strong>
            </div>
          </div>

          <div class="section-title">Product Breakdown (All Orders)</div>
          <table>
            <thead>
              <tr><th>Product</th><th>Size</th><th>Total Qty</th>${retailLabelHeader}<th>Unit Price</th><th>Total Cost</th></tr>
            </thead>
            <tbody>
              ${Object.values(productTotals)
                .sort((a, b) => b.qty - a.qty)
                .map(
                  (p) => `
                  <tr>
                    <td>${p.name}</td>
                    <td>${p.size}</td>
                    <td>${p.qty}</td>
                    ${hasLabels ? `<td>${p.retailLabels > 0 ? (p.category === '12oz' ? `${p.retailLabels} (all)` : p.retailLabels) : '-'}</td>` : ''}
                    <td>${p.unitPrice > 0 ? formatCurrency(p.unitPrice) : '-'}</td>
                    <td>${p.totalCost > 0 ? formatCurrency(p.totalCost) : '-'}</td>
                  </tr>
                `
                )
                .join('')}
              <tr class="total-row">
                <td colspan="${retailLabelColspan}">GRAND TOTAL</td>
                <td>${grandTotalUnits}</td>
                ${hasLabels ? '<td></td>' : ''}
                <td></td>
                <td>${formatCurrency(grandTotalCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- INDIVIDUAL ORDER PAGES -->
        ${sortedOrders
          .map(
            (order, index) => `
          <div class="page">
            <div class="header">
              <h1>${escapeHtml(tenant?.name) || 'Order Report'}</h1>
              <h2>${escapeHtml(vendorName)} — Order Details</h2>
              <p>Order ${index + 1} of ${vendorHistory.length}</p>
            </div>

            <div class="order-header">
              <h3>Order Date: ${new Date(order.order_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}</h3>
              <div class="order-total">Total: ${order.total_cost ? formatCurrency(order.total_cost) : '-'}</div>
            </div>

            <table>
              <thead>
                <tr><th>Product</th><th>Size</th><th>Qty</th>${retailLabelHeader}<th>Unit Price</th><th>Line Total</th></tr>
              </thead>
              <tbody>
                ${Object.entries(order.items)
                  .map(([id, qty]) => {
                    const product = allProducts.find((p) => p.id === id);
                    const unitPrice = product?.default_price || 0;
                    const lineTotal = unitPrice * (qty as number);
                    const productCategory = normalizeCategory(product?.category || '');
                    const orderRetailLabels = order.retail_labels || {};
                    const retailCount = productCategory === '12oz' ? (qty as number) : orderRetailLabels[id] || 0;
                    return `
                    <tr>
                      <td>${escapeHtml(product?.name) || 'Unknown Product'}</td>
                      <td>${product?.size || '-'}</td>
                      <td>${qty}</td>
                      ${hasLabels ? `<td>${retailCount > 0 ? (productCategory === '12oz' ? `${retailCount} (all)` : retailCount) : '-'}</td>` : ''}
                      <td>${unitPrice > 0 ? formatCurrency(unitPrice) : '-'}</td>
                      <td>${lineTotal > 0 ? formatCurrency(lineTotal) : '-'}</td>
                    </tr>
                  `;
                  })
                  .join('')}
                <tr class="total-row">
                  <td colspan="${retailLabelColspan}">ORDER TOTAL</td>
                  <td>${order.units}</td>
                  ${hasLabels ? '<td></td>' : ''}
                  <td></td>
                  <td>${order.total_cost ? formatCurrency(order.total_cost) : '-'}</td>
                </tr>
              </tbody>
            </table>

            ${
              order.notes
                ? `
              <div class="section-title">Order Notes</div>
              <p style="padding: 15px; background: #FDF8F0; border-radius: 8px; font-style: italic;">
                ${escapeHtml(order.notes)}
              </p>
            `
                : ''
            }
          </div>
        `
          )
          .join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  // =====================================================
  // DERIVED UI DATA
  // =====================================================

  const categories = Array.from(new Set(products.map((p) => p.category))).sort();
  const productsByCategory = categories.reduce(
    (acc, cat) => {
      acc[cat] = products.filter((p) => p.category === cat);
      return acc;
    },
    {} as Record<string, CoffeeProduct[]>
  );

  if (loading) {
    return <CoffeeLoader fullScreen text="Loading..." />;
  }

  const hasProducts = products.length > 0;
  const hasVendors = vendors.length > 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-5 py-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
            Bulk Ordering
          </h2>
          <p className="text-sm" style={{ color: colors.brownLight }}>
            {hasVendors ? `Vendor: ${vendorName}` : 'No vendors configured'}
            {isChildLocation && orgName ? ` · ${displayName} · ${orgName}` : ''}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {/* VENDOR TABS */}
        {vendors.length > 1 && (
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {vendors.map((v) => (
              <button
                key={v.id}
                onClick={() => switchVendor(v.id)}
                className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2"
                style={{
                  backgroundColor: v.id === selectedVendorId ? colors.gold : colors.white,
                  color: v.id === selectedVendorId ? colors.white : colors.brown,
                  border: `1px solid ${v.id === selectedVendorId ? colors.gold : colors.creamDark}`,
                  boxShadow: v.id === selectedVendorId ? `0 2px 8px rgba(201,162,39,0.3)` : 'none',
                }}
              >
                <Store className="w-4 h-4" />
                {v.display_name}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 mb-6 flex-wrap">
          <button
            onClick={() => {
              setShowSettings(!showSettings);
              setShowHistory(false);
            }}
            className="px-5 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: showSettings ? colors.gold : colors.white,
              color: showSettings ? colors.white : colors.brown,
              border: `1px solid ${colors.creamDark}`,
            }}
            data-testid="button-settings"
          >
            Settings
          </button>
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              setShowSettings(false);
            }}
            className="px-5 py-2 rounded-md text-sm font-medium transition-all"
            style={{
              backgroundColor: showHistory ? colors.gold : colors.white,
              color: showHistory ? colors.white : colors.brown,
              border: `1px solid ${colors.creamDark}`,
            }}
            data-testid="button-history"
          >
            History
          </button>
          <button
            onClick={clearOrder}
            className="ml-auto px-5 py-2 rounded-md text-sm font-medium"
            style={{
              backgroundColor: colors.white,
              color: colors.red,
              border: `1px solid ${colors.red}`,
            }}
            data-testid="button-clear"
          >
            Clear All
          </button>
        </div>

        {/* ==================== SETTINGS PANEL ==================== */}
        {showSettings && (
          <div
            className="rounded-lg p-6 mb-5"
            style={{
              backgroundColor: colors.white,
              border: `1px solid ${colors.creamDark}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <h2
              className="text-lg font-semibold pb-3 mb-5 border-b-2"
              style={{ color: colors.brown, borderColor: colors.gold }}
            >
              Settings
            </h2>

            {/* Vendor Management */}
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.gold }}>
              Vendors
            </h3>

            {/* Existing vendors */}
            <div className="space-y-3 mb-4">
              {vendors.map((v) => (
                <div
                  key={v.id}
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: v.id === selectedVendorId ? '#FFF8E1' : colors.inputBg,
                    border: `1px solid ${v.id === selectedVendorId ? colors.gold : colors.creamDark}`,
                  }}
                >
                  {editingVendorId === v.id ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="block text-xs mb-1 font-medium" style={{ color: colors.brownLight }}>
                            Vendor Name
                          </label>
                          <Input
                            type="text"
                            placeholder="e.g., Five Star Coffee"
                            value={vendorForm.display_name}
                            onChange={(e) => setVendorForm((prev) => ({ ...prev, display_name: e.target.value }))}
                            style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1 font-medium" style={{ color: colors.brownLight }}>
                            Vendor Email
                          </label>
                          <Input
                            type="email"
                            placeholder="orders@vendor.com"
                            value={vendorForm.contact_email}
                            onChange={(e) => setVendorForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                            style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs mb-1 font-medium" style={{ color: colors.brownLight }}>
                            CC Email (optional)
                          </label>
                          <Input
                            type="email"
                            placeholder="your@email.com"
                            value={vendorForm.cc_email}
                            onChange={(e) => setVendorForm((prev) => ({ ...prev, cc_email: e.target.value }))}
                            style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                          />
                        </div>
                        <div className="flex items-center gap-3 pt-5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={vendorForm.supports_retail_labels}
                              onChange={(e) =>
                                setVendorForm((prev) => ({ ...prev, supports_retail_labels: e.target.checked }))
                              }
                              className="w-4 h-4 rounded"
                              style={{ accentColor: colors.gold }}
                            />
                            <span className="text-sm" style={{ color: colors.brown }}>
                              Retail Labels (CoB)
                            </span>
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveVendor(v.id)}
                          disabled={saving}
                          className="px-4 py-2 rounded-md text-sm font-semibold"
                          style={{ backgroundColor: colors.gold, color: colors.white }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingVendorId(null)}
                          className="px-4 py-2 rounded-md text-sm font-medium"
                          style={{ color: colors.brownLight }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold" style={{ color: colors.brown }}>
                          {v.display_name}
                        </span>
                        {v.contact_email && (
                          <span className="ml-2 text-sm" style={{ color: colors.brownLight }}>
                            {v.contact_email}
                          </span>
                        )}
                        {v.supports_retail_labels && (
                          <span
                            className="ml-2 text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: localColors.teal, color: 'white' }}
                          >
                            CoB Labels
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEditVendor(v)} style={{ color: localColors.teal }}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteVendor(v.id)} style={{ color: colors.red }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add new vendor */}
            {addingVendor ? (
              <div
                className="rounded-lg p-4 mb-6"
                style={{ backgroundColor: colors.inputBg, border: `1px dashed ${colors.gold}` }}
              >
                <h4 className="text-sm font-medium mb-3" style={{ color: colors.brown }}>
                  Add New Vendor
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs mb-1 font-medium" style={{ color: colors.brownLight }}>
                      Vendor Name
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g., Maola Milk"
                      value={newVendorForm.display_name}
                      onChange={(e) => setNewVendorForm((prev) => ({ ...prev, display_name: e.target.value }))}
                      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 font-medium" style={{ color: colors.brownLight }}>
                      Vendor Email
                    </label>
                    <Input
                      type="email"
                      placeholder="orders@vendor.com"
                      value={newVendorForm.contact_email}
                      onChange={(e) => setNewVendorForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 font-medium" style={{ color: colors.brownLight }}>
                      CC Email (optional)
                    </label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={newVendorForm.cc_email}
                      onChange={(e) => setNewVendorForm((prev) => ({ ...prev, cc_email: e.target.value }))}
                      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newVendorForm.supports_retail_labels}
                        onChange={(e) =>
                          setNewVendorForm((prev) => ({ ...prev, supports_retail_labels: e.target.checked }))
                        }
                        className="w-4 h-4 rounded"
                        style={{ accentColor: colors.gold }}
                      />
                      <span className="text-sm" style={{ color: colors.brown }}>
                        Retail Labels (CoB)
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={addVendor}
                    disabled={!newVendorForm.display_name.trim() || saving}
                    className="px-4 py-2 rounded-md text-sm font-semibold"
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                  >
                    Add Vendor
                  </button>
                  <button
                    onClick={() => {
                      setAddingVendor(false);
                      setNewVendorForm({
                        display_name: '',
                        contact_email: '',
                        cc_email: '',
                        supports_retail_labels: true,
                      });
                    }}
                    className="px-4 py-2 rounded-md text-sm font-medium"
                    style={{ color: colors.brownLight }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingVendor(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold mb-6"
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                <Plus className="w-4 h-4" /> Add Vendor
              </button>
            )}

            {/* Product Catalog — scoped to selected vendor */}
            {selectedVendor && (
              <>
                <h3 className="text-sm font-semibold uppercase tracking-wide mt-6 mb-3" style={{ color: colors.gold }}>
                  {selectedVendor.display_name} — Product Catalog
                </h3>
                <p className="text-sm mb-4" style={{ color: colors.brownLight }}>
                  Add and manage products for {selectedVendor.display_name}. Set prices for each item.
                </p>

                <div
                  className="rounded-lg p-4 mb-4"
                  style={{ backgroundColor: colors.inputBg, border: `1px solid ${colors.creamDark}` }}
                >
                  <h4 className="text-sm font-medium mb-3" style={{ color: colors.brown }}>
                    Add New Product
                  </h4>
                  <div className="grid gap-3 md:grid-cols-5">
                    <Input
                      type="text"
                      placeholder="Product Name"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                      data-testid="input-new-product-name"
                    />
                    <Input
                      type="text"
                      placeholder="Size (e.g., 5lb)"
                      value={newProduct.size}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, size: e.target.value }))}
                      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                      data-testid="input-new-product-size"
                    />
                    <Input
                      type="text"
                      placeholder="Category"
                      value={newProduct.category}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, category: e.target.value }))}
                      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                      data-testid="input-new-product-category"
                    />
                    <Input
                      type="text"
                      placeholder="Price"
                      inputMode="decimal"
                      value={newProduct.default_price}
                      onChange={(e) => setNewProduct((prev) => ({ ...prev, default_price: e.target.value }))}
                      style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                      data-testid="input-new-product-price"
                    />
                    <button
                      onClick={addProduct}
                      disabled={!newProduct.name || saving}
                      className="px-4 py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2"
                      style={{ backgroundColor: colors.gold, color: colors.white }}
                      data-testid="button-add-product"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>

                {products.length > 0 && (
                  <div className="space-y-2">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between px-4 py-3 rounded-md"
                        style={{ backgroundColor: colors.inputBg, border: `1px solid ${colors.creamDark}` }}
                      >
                        {editingProductId === product.id ? (
                          <>
                            <div className="flex gap-2 flex-1 mr-2 flex-wrap">
                              <Input
                                type="text"
                                placeholder="Name"
                                value={editProductForm.name}
                                onChange={(e) => setEditProductForm((prev) => ({ ...prev, name: e.target.value }))}
                                className="flex-1 min-w-[100px]"
                                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                              />
                              <Input
                                type="text"
                                placeholder="Size"
                                value={editProductForm.size}
                                onChange={(e) => setEditProductForm((prev) => ({ ...prev, size: e.target.value }))}
                                className="w-16"
                                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                              />
                              <Input
                                type="text"
                                placeholder="Category"
                                value={editProductForm.category}
                                onChange={(e) => setEditProductForm((prev) => ({ ...prev, category: e.target.value }))}
                                className="w-16"
                                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                              />
                              <Input
                                type="text"
                                placeholder="Price"
                                inputMode="decimal"
                                value={editProductForm.default_price}
                                onChange={(e) =>
                                  setEditProductForm((prev) => ({ ...prev, default_price: e.target.value }))
                                }
                                className="w-16"
                                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => updateProduct(product.id)} style={{ color: localColors.teal }}>
                                <Save className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingProductId(null)} style={{ color: colors.brownLight }}>
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="font-medium" style={{ color: colors.brown }}>
                              {product.name}{' '}
                              <span className="font-normal" style={{ color: colors.brownLight }}>
                                {product.size}
                              </span>
                              <span className="ml-2 text-sm" style={{ color: colors.gold }}>
                                {formatCurrency(product.default_price)}
                              </span>
                            </span>
                            <div className="flex gap-2">
                              <button onClick={() => startEditProduct(product)} style={{ color: localColors.teal }}>
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteProduct(product.id)} style={{ color: colors.red }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ==================== HISTORY PANEL ==================== */}
        {showHistory && (
          <div
            className="rounded-lg p-6 mb-5"
            style={{
              backgroundColor: colors.white,
              border: `1px solid ${colors.creamDark}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <h2
              className="text-lg font-semibold pb-3 mb-5 border-b-2"
              style={{ color: colors.brown, borderColor: colors.gold }}
            >
              Order History {selectedVendor ? `— ${selectedVendor.display_name}` : ''}
            </h2>
            <div className="flex gap-3 mb-4">
              <button
                onClick={exportCSV}
                className="px-5 py-2 rounded-md text-sm font-medium"
                style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                data-testid="button-export-csv"
              >
                <Download className="w-4 h-4 inline mr-2" />
                Export CSV
              </button>
              <button
                onClick={exportPDF}
                className="px-5 py-2 rounded-md text-sm font-medium"
                style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                data-testid="button-export-pdf"
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Export PDF
              </button>
            </div>

            {vendorHistory.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <ShoppingCart className="w-8 h-8 mx-auto" style={{ color: colors.brownLight }} />
                <p className="text-sm" style={{ color: colors.brownLight }}>
                  No orders yet{selectedVendor ? ` for ${selectedVendor.display_name}` : ''}. Place your first order
                  below!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {vendorHistory.slice(0, 10).map((order) => (
                  <div
                    key={order.id}
                    className="flex justify-between items-center px-4 py-3 rounded-md"
                    style={{ backgroundColor: '#F5E6C8', border: `1px solid ${colors.creamDark}` }}
                  >
                    <div>
                      <div className="font-medium" style={{ color: colors.brown }}>
                        {new Date(order.order_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-sm" style={{ color: colors.brownLight }}>
                        {order.units} units{order.total_cost ? ` - ${formatCurrency(order.total_cost)}` : ''}
                        {showRetailLabels && order.retail_labels && Object.keys(order.retail_labels).length > 0 && (
                          <span className="ml-1" style={{ color: localColors.teal }}>
                            {' '}
                            (retail labels)
                          </span>
                        )}
                      </div>
                      {order.sent_to_vendor && !order.received_at && (
                        <span
                          className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                          data-testid={`badge-outstanding-${order.id}`}
                        >
                          Outstanding
                        </span>
                      )}
                      {order.received_at && (
                        <span
                          className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded"
                          style={{ backgroundColor: '#dcfce7', color: '#166534' }}
                        >
                          Received{' '}
                          {new Date(order.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {order.sent_to_vendor && !order.received_at && (
                        <button
                          onClick={() => markReceived(order)}
                          className="px-3 py-2 rounded-md text-sm font-semibold"
                          style={{ backgroundColor: '#16a34a', color: colors.white }}
                          data-testid={`button-mark-received-${order.id}`}
                        >
                          Mark received
                        </button>
                      )}
                      <button
                        onClick={() => loadOrder(order)}
                        className="px-4 py-2 rounded-md text-sm font-semibold"
                        style={{ backgroundColor: colors.gold, color: colors.white }}
                        data-testid={`button-load-order-${order.id}`}
                      >
                        Load
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== ORDER BUILDER ==================== */}
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: colors.white,
            border: `1px solid ${colors.creamDark}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <h2
            className="text-lg font-semibold pb-3 mb-5 border-b-2"
            style={{ color: colors.brown, borderColor: colors.gold }}
          >
            {selectedVendor ? `${selectedVendor.display_name} — Weekly Order` : 'Weekly Order'}
          </h2>

          {!hasVendors ? (
            <div className="text-center py-10 space-y-3">
              <Store className="w-10 h-10 mx-auto" style={{ color: colors.brownLight }} />
              <h3 className="text-lg font-semibold" style={{ color: colors.brown }}>
                No vendors configured yet
              </h3>
              <p className="text-sm max-w-sm mx-auto" style={{ color: colors.brownLight }}>
                Add a vendor in Settings to start placing orders.
              </p>
              <button
                onClick={() => {
                  setShowSettings(true);
                  setAddingVendor(true);
                }}
                className="px-6 py-3 rounded-lg font-semibold"
                style={{ backgroundColor: colors.gold, color: colors.white }}
              >
                Add Your First Vendor
              </button>
            </div>
          ) : !hasProducts ? (
            <div className="text-center py-10 space-y-3">
              <Coffee className="w-10 h-10 mx-auto" style={{ color: colors.brownLight }} />
              <h3 className="text-lg font-semibold" style={{ color: colors.brown }}>
                No products configured yet
              </h3>
              <p className="text-sm max-w-sm mx-auto" style={{ color: colors.brownLight }}>
                Add products for {vendorName} in Settings to start placing orders.
              </p>
              <button
                onClick={() => setShowSettings(true)}
                className="px-6 py-3 rounded-lg font-semibold"
                style={{ backgroundColor: colors.gold, color: colors.white }}
                data-testid="button-goto-settings"
              >
                Configure Products
              </button>
            </div>
          ) : (
            <>
              {categories.map((category) => (
                <div key={category} className="mb-8">
                  <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: colors.gold }}>
                    {category}
                  </h3>
                  <div className="space-y-3">
                    {productsByCategory[category].map((product: CoffeeProduct) => {
                      const qty = orderItems[product.id] || 0;
                      const is5lb = showRetailLabels && normalizeCategory(product.category) === '5lb';
                      const retailCount = retailLabels[product.id] || 0;
                      return (
                        <div key={product.id}>
                          <div
                            className="flex justify-between items-center px-4 py-3 transition-all"
                            style={{
                              backgroundColor: qty > 0 ? '#F5E6C8' : colors.inputBg,
                              border: qty > 0 ? `2px solid ${colors.gold}` : `1px solid ${colors.creamDark}`,
                              borderRadius: is5lb && qty > 0 ? '8px 8px 0 0' : '8px',
                            }}
                          >
                            <span className="font-medium" style={{ color: colors.brown }}>
                              {product.name}{' '}
                              <span className="font-normal" style={{ color: colors.brownLight }}>
                                {product.size}
                              </span>
                              <span className="ml-2 text-xs" style={{ color: colors.gold }}>
                                {formatCurrency(product.default_price)}
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQty(product.id, -1)}
                                className="w-8 h-8 rounded-md flex items-center justify-center text-lg font-semibold"
                                style={{ backgroundColor: colors.creamDark, color: colors.brownLight }}
                                data-testid={`button-minus-${product.sku}`}
                              >
                                -
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={qty || ''}
                                placeholder="0"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === '' || /^\d+$/.test(v)) setQty(product.id, v);
                                }}
                                onFocus={(e) => e.target.select()}
                                className="w-12 h-8 text-center text-sm font-medium rounded-md"
                                style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                                data-testid={`input-qty-${product.sku}`}
                              />
                              <button
                                onClick={() => updateQty(product.id, 1)}
                                className="w-8 h-8 rounded-md flex items-center justify-center text-lg font-semibold"
                                style={{ backgroundColor: colors.gold, color: colors.white }}
                                data-testid={`button-plus-${product.sku}`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          {is5lb && qty > 0 && (
                            <div
                              className="flex justify-between items-center px-4 py-2"
                              style={{
                                backgroundColor: '#F5E6C8',
                                borderLeft: `2px solid ${colors.gold}`,
                                borderRight: `2px solid ${colors.gold}`,
                                borderBottom: `2px solid ${colors.gold}`,
                                borderRadius: '0 0 8px 8px',
                              }}
                            >
                              <span className="text-xs font-medium" style={{ color: colors.brownLight }}>
                                Retail Labels
                                <span className="ml-1 font-normal">({qty - retailCount} generic)</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setRetailLabelCount(product.id, String(Math.max(0, retailCount - 1)))}
                                  className="w-6 h-6 rounded flex items-center justify-center text-sm font-semibold"
                                  style={{ backgroundColor: colors.creamDark, color: colors.brownLight }}
                                >
                                  -
                                </button>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={retailCount || ''}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '' || /^\d+$/.test(v)) setRetailLabelCount(product.id, v);
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="w-10 h-6 text-center text-xs font-medium rounded"
                                  style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                                />
                                <button
                                  onClick={() =>
                                    setRetailLabelCount(product.id, String(Math.min(qty, retailCount + 1)))
                                  }
                                  className="w-6 h-6 rounded flex items-center justify-center text-sm font-semibold"
                                  style={{ backgroundColor: localColors.teal, color: colors.white }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.gold }}>
                Notes
              </h3>
              <textarea
                placeholder="Add any special instructions or notes for this order..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full min-h-[80px] px-4 py-3 rounded-md text-sm resize-y mb-5"
                style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                data-testid="input-order-notes"
              />

              <div className="rounded-lg p-5 mb-5" style={{ backgroundColor: '#F5E6C8' }}>
                <div className="flex justify-between mb-2">
                  <span style={{ color: colors.brownLight }}>Items Selected:</span>
                  <span className="font-semibold" style={{ color: colors.brown }}>
                    {totalItems}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span style={{ color: colors.brownLight }}>Total Units:</span>
                  <span className="font-semibold" style={{ color: colors.brown }}>
                    {totalUnits}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: colors.brownLight }}>Total Cost:</span>
                  <span className="font-semibold text-lg" style={{ color: colors.brown }}>
                    {formatCurrency(totalCost)}
                  </span>
                </div>
                {showRetailLabels && totalRetailLabelsAll > 0 && (
                  <div
                    className="flex justify-between mt-2 pt-2"
                    style={{ borderTop: `1px solid ${colors.creamDark}` }}
                  >
                    <span style={{ color: colors.brownLight }}>Retail Labels:</span>
                    <span className="font-semibold" style={{ color: colors.brown }}>
                      {totalRetailLabelsAll}
                      {totalRetailLabels5lb > 0 && total12ozUnits > 0 && (
                        <span className="text-xs font-normal ml-1" style={{ color: colors.brownLight }}>
                          ({totalRetailLabels5lb} from 5lb + {total12ozUnits} from 12oz)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={sendOrder}
                disabled={totalItems === 0 || saving}
                className="w-full py-3 rounded-lg text-base font-semibold mb-3 transition-all"
                style={{
                  background:
                    totalItems === 0
                      ? colors.creamDark
                      : `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
                  color: totalItems === 0 ? '#999' : colors.brown,
                  boxShadow: totalItems === 0 ? 'none' : `0 4px 12px rgba(212, 168, 75, 0.4)`,
                  cursor: totalItems === 0 ? 'not-allowed' : 'pointer',
                }}
                data-testid="button-send-order"
              >
                Send Order to {vendorName}
              </button>
              <button
                onClick={() => saveToHistory(false)}
                disabled={totalItems === 0 || saving}
                className="w-full py-3 rounded-lg text-base font-semibold transition-all"
                style={{
                  backgroundColor: totalItems === 0 ? colors.creamDark : '#666',
                  color: totalItems === 0 ? '#999' : colors.white,
                  cursor: totalItems === 0 ? 'not-allowed' : 'pointer',
                }}
                data-testid="button-save-history"
              >
                Save to History Only
              </button>
            </>
          )}
        </div>
      </main>
      {ConfirmDialog}
    </div>
  );
}
