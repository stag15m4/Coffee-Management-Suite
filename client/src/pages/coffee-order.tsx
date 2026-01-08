import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { Link } from 'wouter';
import fiveStarLogoUrl from '@assets/IMG_0471_1767886800383.jpeg';

const colors = {
  gold: '#D4A84B',
  goldDark: '#B8923F',
  brown: '#2C2416',
  brownLight: '#666',
  cream: '#FBF7F0',
  creamDark: '#E8DFD0',
  white: '#FFFFFF',
  inputBg: '#F8F6F2',
  red: '#C74B4B',
  teal: '#4A7C8C',
};

const PRODUCTS = [
  { id: 1, name: 'Espresso', size: '5lb', category: '5lb' },
  { id: 2, name: 'Double Stack', size: '5lb', category: '5lb' },
  { id: 3, name: 'Triple Stack', size: '5lb', category: '5lb' },
  { id: 4, name: 'Decaf', size: '5lb', category: '5lb' },
  { id: 5, name: 'Cold Brew', size: '5lb', category: '5lb' },
  { id: 6, name: 'Double Stack', size: '12oz', category: '12oz' },
  { id: 7, name: 'Triple Stack', size: '12oz', category: '12oz' },
  { id: 8, name: 'Decaf', size: '12oz', category: '12oz' },
  { id: 9, name: 'Espresso', size: '12oz', category: '12oz' },
];

interface OrderHistoryItem {
  id: string;
  order_date: string;
  items: Record<number, number>;
  units: number;
  total_cost: number | null;
  notes?: string;
  sent_to_vendor: boolean;
}

export default function CoffeeOrder() {
  const { tenant } = useAuth();
  const { toast } = useToast();
  
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [orderItems, setOrderItems] = useState<Record<number, number>>({});
  const [productPrices, setProductPrices] = useState<Record<number, number>>({});
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [vendorEmail, setVendorEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant?.id) {
      loadData();
    }
    const savedVendor = localStorage.getItem('coffee_vendor_email') || '';
    const savedCC = localStorage.getItem('coffee_cc_email') || '';
    setVendorEmail(savedVendor);
    setCcEmail(savedCC);
  }, [tenant?.id]);

  const loadData = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const [pricesRes, historyRes] = await Promise.all([
        supabase
          .from('coffee_product_prices')
          .select('product_id, price')
          .eq('tenant_id', tenant.id),
        supabase
          .from('coffee_order_history')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('order_date', { ascending: false })
          .limit(50)
      ]);

      if (pricesRes.data) {
        const prices: Record<number, number> = {};
        pricesRes.data.forEach((row: { product_id: number; price: string }) => {
          prices[row.product_id] = parseFloat(row.price);
        });
        setProductPrices(prices);
      }

      if (historyRes.data) {
        setOrderHistory(historyRes.data);
      }
    } catch (error: any) {
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const savePrice = async (productId: number, value: string) => {
    if (!tenant?.id) return;
    const price = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
    
    setProductPrices(prev => {
      if (price === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: price };
    });

    try {
      const { error } = await supabase
        .from('coffee_product_prices')
        .upsert({
          tenant_id: tenant.id,
          product_id: productId,
          price: price,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,product_id' });
      
      if (error) throw error;
    } catch (error: any) {
      toast({ title: 'Error saving price', description: error.message, variant: 'destructive' });
    }
  };

  const updateQty = (productId: number, delta: number) => {
    setOrderItems(prev => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQty };
    });
  };

  const setQty = (productId: number, value: string) => {
    const qty = Math.max(0, parseInt(value) || 0);
    setOrderItems(prev => {
      if (qty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: qty };
    });
  };

  const calculateTotalCost = () => {
    let total = 0;
    for (const [id, qty] of Object.entries(orderItems)) {
      const price = productPrices[parseInt(id)] || 0;
      total += price * qty;
    }
    return total;
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const totalUnits = Object.values(orderItems).reduce((a, b) => a + b, 0);
  const totalItems = Object.keys(orderItems).length;
  const totalCost = calculateTotalCost();

  const clearOrder = () => {
    setOrderItems({});
    setOrderNotes('');
    toast({ title: 'Order cleared' });
  };

  const saveToHistory = async (sentToVendor = false) => {
    if (!tenant?.id || totalItems === 0) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('coffee_order_history')
        .insert({
          tenant_id: tenant.id,
          items: orderItems,
          units: totalUnits,
          total_cost: totalCost,
          notes: orderNotes || null,
          sent_to_vendor: sentToVendor,
          vendor_email: sentToVendor ? vendorEmail : null
        });

      if (error) throw error;
      
      toast({ title: sentToVendor ? 'Order sent and saved!' : 'Order saved to history' });
      clearOrder();
      loadData();
    } catch (error: any) {
      toast({ title: 'Error saving order', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const sendOrder = async () => {
    if (!vendorEmail) {
      toast({ title: 'Please set vendor email in Settings', variant: 'destructive' });
      setShowSettings(true);
      return;
    }

    toast({ 
      title: 'Email sending not configured', 
      description: 'Order saved to history. Email functionality requires server-side setup.',
    });
    await saveToHistory(false);
  };

  const loadOrder = (items: Record<number, number>) => {
    setOrderItems(items);
    setShowHistory(false);
    toast({ title: 'Previous order loaded' });
  };

  const exportCSV = () => {
    if (orderHistory.length === 0) {
      toast({ title: 'No order history to export', variant: 'destructive' });
      return;
    }

    let csv = 'Date,Units,Total Cost,Items\n';
    orderHistory.forEach(order => {
      const date = new Date(order.order_date).toLocaleDateString('en-US');
      const cost = order.total_cost ? order.total_cost.toFixed(2) : '0.00';
      const items = Object.entries(order.items).map(([id, qty]) => {
        const product = PRODUCTS.find(p => p.id === parseInt(id));
        return product ? `${product.name} ${product.size} x${qty}` : '';
      }).filter(Boolean).join('; ');
      csv += `"${date}",${order.units},$${cost},"${items}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coffee-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exported' });
  };

  const exportPDF = () => {
    if (orderHistory.length === 0) {
      toast({ title: 'No order history to export', variant: 'destructive' });
      return;
    }

    let grandTotalUnits = 0;
    let grandTotalCost = 0;
    orderHistory.forEach(order => {
      grandTotalUnits += order.units || 0;
      grandTotalCost += order.total_cost || 0;
    });

    const dates = orderHistory.map(o => new Date(o.order_date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0].toLocaleDateString('en-US');
    const endDate = dates[dates.length - 1].toLocaleDateString('en-US');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Coffee Order History</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #2C2416; max-width: 700px; margin: 0 auto; }
          .container { border: 1px solid #D4A84B; border-radius: 8px; padding: 25px; background: #FFFFFF; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header h2 { margin: 5px 0; font-size: 16px; font-weight: normal; color: #666; }
          .summary { display: flex; flex-wrap: wrap; gap: 10px 40px; margin: 20px 0; padding: 15px 0; border-bottom: 1px solid #E8DFD0; }
          .summary-item { font-size: 13px; }
          .summary-item.highlight { background-color: #D4A84B; padding: 3px 8px; border-radius: 3px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background-color: #D4A84B; color: #2C2416; padding: 10px; text-align: left; font-weight: bold; }
          td { padding: 8px; border-bottom: 1px solid #E8DFD0; }
          .total-row { background-color: #D4A84B; font-weight: bold; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Erwin Mills Coffee Co.</h1>
            <h2>Coffee Order History</h2>
            <p>${startDate} - ${endDate}</p>
          </div>
          <div class="summary">
            <div class="summary-item">Total Orders: ${orderHistory.length}</div>
            <div class="summary-item">Total Units: ${grandTotalUnits}</div>
            <div class="summary-item highlight">Total Cost: ${formatCurrency(grandTotalCost)}</div>
            <div class="summary-item">Vendor: Five Star Coffee Roasters</div>
          </div>
          ${orderHistory.map(order => `
            <h3 style="margin-top: 20px; font-size: 14px;">Order: ${new Date(order.order_date).toLocaleDateString('en-US')}</h3>
            <table>
              <thead>
                <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
              </thead>
              <tbody>
                ${Object.entries(order.items).map(([id, qty]) => {
                  const product = PRODUCTS.find(p => p.id === parseInt(id));
                  const unitPrice = productPrices[parseInt(id)] || 0;
                  const lineTotal = unitPrice * (qty as number);
                  return product ? `
                    <tr>
                      <td>${product.name} (${product.size})</td>
                      <td>${qty}</td>
                      <td>${unitPrice > 0 ? formatCurrency(unitPrice) : '-'}</td>
                      <td>${lineTotal > 0 ? formatCurrency(lineTotal) : '-'}</td>
                    </tr>
                  ` : '';
                }).join('')}
                <tr class="total-row">
                  <td>TOTAL</td>
                  <td>${order.units}</td>
                  <td></td>
                  <td>${order.total_cost ? formatCurrency(order.total_cost) : '-'}</td>
                </tr>
              </tbody>
            </table>
          `).join('')}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const fiveLbProducts = PRODUCTS.filter(p => p.category === '5lb');
  const twelveOzProducts = PRODUCTS.filter(p => p.category === '12oz');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <p style={{ color: colors.brown }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-10">
        <Link href="/" data-testid="link-back-dashboard">
          <Button variant="ghost" size="icon" style={{ color: colors.brown }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      {/* Header matching original */}
      <header className="text-center py-8 border-b-4" style={{ backgroundColor: colors.cream, borderColor: colors.gold }}>
        <div 
          className="inline-block p-3 rounded-lg mb-3"
          style={{ border: `3px solid ${colors.gold}`, backgroundColor: colors.white }}
        >
          <img 
            src={fiveStarLogoUrl} 
            alt="Five Star Coffee Roasters" 
            className="h-16 w-auto"
          />
        </div>
        <p 
          className="text-sm tracking-widest uppercase font-semibold mb-2"
          style={{ color: colors.brown }}
        >
          Erwin Mills Coffee Company
        </p>
        <h1 className="text-2xl font-semibold" style={{ color: colors.brown }}>
          Bulk Coffee Order App
        </h1>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {/* Action Buttons */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <button
            onClick={() => { setShowSettings(!showSettings); setShowHistory(false); }}
            className="px-5 py-2 rounded-md text-sm font-medium transition-all"
            style={{ 
              backgroundColor: showSettings ? colors.gold : colors.white,
              color: showSettings ? colors.brown : colors.brown,
              border: `1px solid ${colors.creamDark}`
            }}
            data-testid="button-settings"
          >
            Settings
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); setShowSettings(false); }}
            className="px-5 py-2 rounded-md text-sm font-medium transition-all"
            style={{ 
              backgroundColor: showHistory ? colors.gold : colors.white,
              color: showHistory ? colors.brown : colors.brown,
              border: `1px solid ${colors.creamDark}`
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
              border: `1px solid ${colors.red}`
            }}
            data-testid="button-clear"
          >
            Clear All
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="rounded-lg p-6 mb-5" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h2 className="text-lg font-semibold pb-3 mb-5 border-b-2" style={{ color: colors.brown, borderColor: colors.gold }}>
              Settings
            </h2>
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <div>
                <label className="block text-sm mb-2 font-medium" style={{ color: colors.brownLight }}>Vendor Email (Five Star)</label>
                <input
                  type="email"
                  placeholder="sales@fivestarcoffeeroasters.com"
                  value={vendorEmail}
                  onChange={(e) => {
                    setVendorEmail(e.target.value);
                    localStorage.setItem('coffee_vendor_email', e.target.value);
                  }}
                  className="w-full px-4 py-2 rounded-md text-sm"
                  style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                  data-testid="input-vendor-email"
                />
              </div>
              <div>
                <label className="block text-sm mb-2 font-medium" style={{ color: colors.brownLight }}>CC Email (optional - send yourself a copy)</label>
                <input
                  type="email"
                  placeholder="seth@erwinmills.com"
                  value={ccEmail}
                  onChange={(e) => {
                    setCcEmail(e.target.value);
                    localStorage.setItem('coffee_cc_email', e.target.value);
                  }}
                  className="w-full px-4 py-2 rounded-md text-sm"
                  style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                  data-testid="input-cc-email"
                />
              </div>
            </div>

            <h3 className="text-sm font-semibold uppercase tracking-wide mt-6 mb-2" style={{ color: colors.gold }}>Product Pricing</h3>
            <p className="text-sm mb-4" style={{ color: colors.brownLight }}>Set prices for each product to track order costs. Prices are saved until you change them.</p>
            
            <h4 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.gold }}>5lb Bags</h4>
            <div className="space-y-2 mb-6">
              {fiveLbProducts.map(product => (
                <div key={product.id} className="flex justify-between items-center px-4 py-3 rounded-md" style={{ backgroundColor: colors.inputBg, border: `1px solid ${colors.creamDark}` }}>
                  <span className="font-medium" style={{ color: colors.brown }}>{product.name} <span className="font-normal" style={{ color: colors.brownLight }}>{product.size}</span></span>
                  <input
                    type="text"
                    placeholder="$0.00"
                    value={productPrices[product.id] ? productPrices[product.id].toFixed(2) : ''}
                    onChange={(e) => savePrice(product.id, e.target.value)}
                    className="w-20 px-3 py-1 text-right text-sm rounded-md"
                    style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                    data-testid={`input-price-${product.id}`}
                  />
                </div>
              ))}
            </div>

            <h4 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.gold }}>12oz Bags</h4>
            <div className="space-y-2">
              {twelveOzProducts.map(product => (
                <div key={product.id} className="flex justify-between items-center px-4 py-3 rounded-md" style={{ backgroundColor: colors.inputBg, border: `1px solid ${colors.creamDark}` }}>
                  <span className="font-medium" style={{ color: colors.brown }}>{product.name} <span className="font-normal" style={{ color: colors.brownLight }}>{product.size}</span></span>
                  <input
                    type="text"
                    placeholder="$0.00"
                    value={productPrices[product.id] ? productPrices[product.id].toFixed(2) : ''}
                    onChange={(e) => savePrice(product.id, e.target.value)}
                    className="w-20 px-3 py-1 text-right text-sm rounded-md"
                    style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                    data-testid={`input-price-${product.id}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Panel */}
        {showHistory && (
          <div className="rounded-lg p-6 mb-5" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h2 className="text-lg font-semibold pb-3 mb-5 border-b-2" style={{ color: colors.brown, borderColor: colors.gold }}>
              Order History
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

            {orderHistory.length === 0 ? (
              <p className="text-center py-5" style={{ color: colors.brownLight }}>No previous orders yet</p>
            ) : (
              <div className="space-y-3">
                {orderHistory.slice(0, 10).map(order => (
                  <div 
                    key={order.id} 
                    className="flex justify-between items-center px-4 py-3 rounded-md"
                    style={{ backgroundColor: '#F5E6C8', border: `1px solid ${colors.creamDark}` }}
                  >
                    <div>
                      <div className="font-medium" style={{ color: colors.brown }}>
                        {new Date(order.order_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-sm" style={{ color: colors.brownLight }}>
                        {order.units} units{order.total_cost ? ` - ${formatCurrency(order.total_cost)}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => loadOrder(order.items)}
                      className="px-4 py-2 rounded-md text-sm font-semibold"
                      style={{ backgroundColor: colors.gold, color: colors.brown }}
                      data-testid={`button-load-order-${order.id}`}
                    >
                      Load
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Weekly Order Card */}
        <div className="rounded-lg p-6" style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 className="text-lg font-semibold pb-3 mb-5 border-b-2" style={{ color: colors.brown, borderColor: colors.gold }}>
            Weekly Order
          </h2>

          {/* 5lb Bags */}
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: colors.gold }}>5lb Bags</h3>
          <div className="space-y-3 mb-8">
            {fiveLbProducts.map(product => {
              const qty = orderItems[product.id] || 0;
              return (
                <div 
                  key={product.id} 
                  className="flex justify-between items-center px-4 py-3 rounded-lg transition-all"
                  style={{ 
                    backgroundColor: qty > 0 ? '#F5E6C8' : colors.inputBg,
                    border: qty > 0 ? `2px solid ${colors.gold}` : `1px solid ${colors.creamDark}`
                  }}
                >
                  <span className="font-medium" style={{ color: colors.brown }}>
                    {product.name} <span className="font-normal" style={{ color: colors.brownLight }}>{product.size}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(product.id, -1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-lg font-semibold"
                      style={{ backgroundColor: colors.creamDark, color: colors.brownLight }}
                      data-testid={`button-minus-${product.id}`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={qty || ''}
                      placeholder="0"
                      onChange={(e) => setQty(product.id, e.target.value)}
                      className="w-12 h-8 text-center text-sm font-medium rounded-md"
                      style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                      data-testid={`input-qty-${product.id}`}
                    />
                    <button
                      onClick={() => updateQty(product.id, 1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-lg font-semibold"
                      style={{ backgroundColor: colors.gold, color: colors.brown }}
                      data-testid={`button-plus-${product.id}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 12oz Bags */}
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: colors.gold }}>12oz Bags</h3>
          <div className="space-y-3 mb-8">
            {twelveOzProducts.map(product => {
              const qty = orderItems[product.id] || 0;
              return (
                <div 
                  key={product.id} 
                  className="flex justify-between items-center px-4 py-3 rounded-lg transition-all"
                  style={{ 
                    backgroundColor: qty > 0 ? '#F5E6C8' : colors.inputBg,
                    border: qty > 0 ? `2px solid ${colors.gold}` : `1px solid ${colors.creamDark}`
                  }}
                >
                  <span className="font-medium" style={{ color: colors.brown }}>
                    {product.name} <span className="font-normal" style={{ color: colors.brownLight }}>{product.size}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(product.id, -1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-lg font-semibold"
                      style={{ backgroundColor: colors.creamDark, color: colors.brownLight }}
                      data-testid={`button-minus-${product.id}`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={qty || ''}
                      placeholder="0"
                      onChange={(e) => setQty(product.id, e.target.value)}
                      className="w-12 h-8 text-center text-sm font-medium rounded-md"
                      style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
                      data-testid={`input-qty-${product.id}`}
                    />
                    <button
                      onClick={() => updateQty(product.id, 1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-lg font-semibold"
                      style={{ backgroundColor: colors.gold, color: colors.brown }}
                      data-testid={`button-plus-${product.id}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: colors.gold }}>Notes</h3>
          <textarea
            placeholder="Add any special instructions or notes for this order..."
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            className="w-full min-h-[80px] px-4 py-3 rounded-md text-sm resize-y mb-5"
            style={{ backgroundColor: colors.white, border: `1px solid ${colors.creamDark}` }}
            data-testid="input-order-notes"
          />

          {/* Summary */}
          <div className="rounded-lg p-5 mb-5" style={{ backgroundColor: '#F5E6C8' }}>
            <div className="flex justify-between mb-2">
              <span style={{ color: colors.brownLight }}>Items Selected:</span>
              <span className="font-semibold" style={{ color: colors.brown }}>{totalItems}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span style={{ color: colors.brownLight }}>Total Units:</span>
              <span className="font-semibold" style={{ color: colors.brown }}>{totalUnits}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: colors.brownLight }}>Total Cost:</span>
              <span className="font-semibold text-lg" style={{ color: colors.brown }}>{formatCurrency(totalCost)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <button
            onClick={sendOrder}
            disabled={totalItems === 0 || saving}
            className="w-full py-3 rounded-lg text-base font-semibold mb-3 transition-all"
            style={{ 
              background: totalItems === 0 ? colors.creamDark : `linear-gradient(135deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
              color: totalItems === 0 ? '#999' : colors.brown,
              boxShadow: totalItems === 0 ? 'none' : `0 4px 12px rgba(212, 168, 75, 0.4)`,
              cursor: totalItems === 0 ? 'not-allowed' : 'pointer'
            }}
            data-testid="button-send-order"
          >
            Send Order to Five Star
          </button>
          <button
            onClick={() => saveToHistory(false)}
            disabled={totalItems === 0 || saving}
            className="w-full py-3 rounded-lg text-base font-semibold transition-all"
            style={{ 
              backgroundColor: totalItems === 0 ? colors.creamDark : '#666',
              color: totalItems === 0 ? '#999' : colors.white,
              cursor: totalItems === 0 ? 'not-allowed' : 'pointer'
            }}
            data-testid="button-save-history"
          >
            Save to History Only
          </button>
        </div>
      </main>
    </div>
  );
}
