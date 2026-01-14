import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { Link } from 'wouter';
import { Footer } from '@/components/Footer';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
};

const defaultBranding = {
  primary_color: '#C9A227',
  secondary_color: '#4A3728',
  accent_color: '#F5F0E1',
  background_color: '#FFFDF7',
};

export default function AdminBranding() {
  const { profile, tenant, branding } = useAuth();
  const { toast } = useToast();
  
  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState(defaultBranding.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(defaultBranding.secondary_color);
  const [accentColor, setAccentColor] = useState(defaultBranding.accent_color);
  const [backgroundColor, setBackgroundColor] = useState(defaultBranding.background_color);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (branding) {
      setCompanyName(branding.company_name || '');
      setTagline(branding.tagline || '');
      setLogoUrl(branding.logo_url || '');
      setPrimaryColor(branding.primary_color || defaultBranding.primary_color);
      setSecondaryColor(branding.secondary_color || defaultBranding.secondary_color);
      setAccentColor(branding.accent_color || defaultBranding.accent_color);
      setBackgroundColor(branding.background_color || defaultBranding.background_color);
    }
  }, [branding]);

  const saveBranding = async () => {
    if (!profile?.tenant_id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenant_branding')
        .upsert({
          tenant_id: profile.tenant_id,
          company_name: companyName || null,
          tagline: tagline || null,
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          background_color: backgroundColor,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' });

      if (error) throw error;
      
      toast({ title: 'Branding saved successfully. Refresh the page to see changes.' });
    } catch (error: any) {
      toast({ title: 'Error saving branding', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setPrimaryColor(defaultBranding.primary_color);
    setSecondaryColor(defaultBranding.secondary_color);
    setAccentColor(defaultBranding.accent_color);
    setBackgroundColor(defaultBranding.background_color);
    toast({ title: 'Colors reset to defaults' });
  };

  // Show loading while profile loads
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full animate-pulse mx-auto mb-3" style={{ backgroundColor: colors.gold }} />
          <p style={{ color: colors.brownLight }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profile.role !== 'owner') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
        <p style={{ color: colors.brown }}>Access denied. Owner role required.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header 
        className="sticky top-0 z-50 border-b px-4 py-3"
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" data-testid="link-back-dashboard">
              <Button variant="ghost" size="icon" style={{ color: colors.brown }}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg" style={{ color: colors.brown }}>Branding Settings</h1>
              <p className="text-sm" style={{ color: colors.brownLight }}>Customize your company's appearance</p>
            </div>
          </div>
          <Button
            onClick={saveBranding}
            disabled={saving}
            style={{ backgroundColor: colors.gold, color: colors.brown }}
            data-testid="button-save-branding"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle style={{ color: colors.brown }}>Company Information</CardTitle>
            <CardDescription style={{ color: colors.brownLight }}>
              This information appears in the header and throughout the app
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.brown }}>
                Company Name
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Erwin Mills Coffee Co."
                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                data-testid="input-company-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.brown }}>
                Tagline
              </label>
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Recipe Cost Manager"
                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                data-testid="input-tagline"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.brown }}>
                Logo URL
              </label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                data-testid="input-logo-url"
              />
              <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                Enter a URL to your logo image. Recommended size: 200x50px
              </p>
              {logoUrl && (
                <div className="mt-3 p-4 rounded-lg" style={{ backgroundColor: colors.cream }}>
                  <p className="text-sm mb-2" style={{ color: colors.brownLight }}>Preview:</p>
                  <img 
                    src={logoUrl} 
                    alt="Logo preview" 
                    className="h-12 w-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle style={{ color: colors.brown }}>Brand Colors</CardTitle>
              <CardDescription style={{ color: colors.brownLight }}>
                Customize the color scheme of your app
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              style={{ borderColor: colors.creamDark, color: colors.brownLight }}
              data-testid="button-reset-colors"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.brown }}>
                  Primary Color (Gold/Accent)
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1"
                    style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.brown }}>
                  Secondary Color (Text/Brown)
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                    data-testid="input-secondary-color"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1"
                    style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.brown }}>
                  Accent Color (Cream)
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                    data-testid="input-accent-color"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1"
                    style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.brown }}>
                  Background Color
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                    data-testid="input-background-color"
                  />
                  <Input
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1"
                    style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium mb-3" style={{ color: colors.brown }}>Preview:</p>
              <div 
                className="p-4 rounded-lg border"
                style={{ backgroundColor: backgroundColor, borderColor: accentColor }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span style={{ color: secondaryColor }} className="font-bold">EM</span>
                  </div>
                  <div>
                    <p style={{ color: secondaryColor }} className="font-bold">{companyName || 'Company Name'}</p>
                    <p style={{ color: secondaryColor, opacity: 0.7 }} className="text-sm">{tagline || 'Tagline'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    className="px-4 py-2 rounded text-sm font-medium"
                    style={{ backgroundColor: primaryColor, color: secondaryColor }}
                  >
                    Primary Button
                  </button>
                  <button 
                    className="px-4 py-2 rounded text-sm font-medium border"
                    style={{ backgroundColor: 'transparent', color: secondaryColor, borderColor: accentColor }}
                  >
                    Secondary Button
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
