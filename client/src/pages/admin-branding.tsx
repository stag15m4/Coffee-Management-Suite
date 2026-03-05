import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import { Save, RotateCcw, Check, Upload, Loader2, Trash2 } from 'lucide-react';
import { colors } from '@/lib/colors';

const defaultBranding = {
  primary_color: '#334155',
  secondary_color: '#0F172A',
  accent_color: '#F1F5F9',
  background_color: '#FFFFFF',
};

interface ColorPreset {
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
}

const PRESETS: ColorPreset[] = [
  {
    name: 'Clean Slate',
    primary_color: '#334155',
    secondary_color: '#0F172A',
    accent_color: '#F1F5F9',
    background_color: '#FFFFFF',
  },
  {
    name: 'Espresso',
    primary_color: '#78350F',
    secondary_color: '#1C1917',
    accent_color: '#FEF3C7',
    background_color: '#FFFBEB',
  },
  {
    name: 'Ocean',
    primary_color: '#1E40AF',
    secondary_color: '#1E293B',
    accent_color: '#DBEAFE',
    background_color: '#FFFFFF',
  },
  {
    name: 'Forest',
    primary_color: '#166534',
    secondary_color: '#052E16',
    accent_color: '#DCFCE7',
    background_color: '#FFFFFF',
  },
  {
    name: 'Classic Gold',
    primary_color: '#92400E',
    secondary_color: '#292524',
    accent_color: '#FEF3C7',
    background_color: '#FFFFFF',
  },
];

export default function AdminBranding() {
  const { profile, tenant, branding, primaryTenant } = useAuth();

  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState(defaultBranding.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(defaultBranding.secondary_color);
  const [accentColor, setAccentColor] = useState(defaultBranding.accent_color);
  const [backgroundColor, setBackgroundColor] = useState(defaultBranding.background_color);
  const [saving, setSaving] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading: uploadingLogo } = useUpload({
    onSuccess: (response) => {
      // Use the permanent serve path
      const serveUrl = `${window.location.origin}${response.objectPath}`;
      setLogoUrl(serveUrl);
      toast({ title: 'Logo uploaded! Click "Save Changes" to apply.' });
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image must be under 5MB', variant: 'destructive' });
      return;
    }
    await uploadFile(file);
    e.target.value = '';
  };

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
    if (!tenant?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenant_branding')
        .upsert({
          tenant_id: tenant.id,
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

  const applyPreset = (preset: ColorPreset) => {
    setPrimaryColor(preset.primary_color);
    setSecondaryColor(preset.secondary_color);
    setAccentColor(preset.accent_color);
    setBackgroundColor(preset.background_color);
    toast({ title: `Applied "${preset.name}" palette` });
  };

  const isPresetActive = (preset: ColorPreset) =>
    preset.primary_color === primaryColor &&
    preset.secondary_color === secondaryColor &&
    preset.accent_color === accentColor &&
    preset.background_color === backgroundColor;

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
      <header className="px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold" style={{ color: colors.brown }}>
              Branding Settings
            </h2>
            {isChildLocation && orgName && (
              <p className="text-sm" style={{ color: colors.brownLight }}>
                {displayName} • {orgName}
              </p>
            )}
          </div>
          <Button
            onClick={saveBranding}
            disabled={saving}
            style={{ backgroundColor: colors.gold, color: '#FFFFFF' }}
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
                Logo
              </label>

              {/* Current logo preview */}
              {logoUrl && (
                <div className="mb-3 p-4 rounded-lg flex items-center gap-4" style={{ backgroundColor: colors.cream }}>
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-14 w-auto max-w-[200px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogoUrl('')}
                    style={{ borderColor: colors.creamDark, color: '#ef4444' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Upload button */}
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileSelect}
                className="hidden"
              />
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  onClick={() => logoFileRef.current?.click()}
                  disabled={uploadingLogo}
                  style={{ borderColor: colors.gold, color: colors.gold }}
                >
                  {uploadingLogo ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> Upload Logo</>
                  )}
                </Button>
                <button
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="text-xs underline"
                  style={{ color: colors.brownLight }}
                >
                  {showUrlInput ? 'Hide URL input' : 'Or enter a URL'}
                </button>
              </div>

              {/* Optional URL input */}
              {showUrlInput && (
                <div className="mt-2">
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
                    data-testid="input-logo-url"
                  />
                </div>
              )}

              <p className="text-xs mt-2" style={{ color: colors.brownLight }}>
                Upload an image or paste a URL. Recommended: PNG or SVG, max 5MB.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Preset Palettes */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle style={{ color: colors.brown }}>Color Palettes</CardTitle>
            <CardDescription style={{ color: colors.brownLight }}>
              Choose a preset or customize individual colors below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {PRESETS.map((preset) => {
                const active = isPresetActive(preset);
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="rounded-lg border-2 p-3 text-left transition-all"
                    style={{
                      borderColor: active ? preset.primary_color : '#E2E8F0',
                      backgroundColor: active ? '#F8FAFC' : '#FFFFFF',
                    }}
                  >
                    {/* Color swatches */}
                    <div className="flex gap-1 mb-2">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: preset.primary_color }}
                      />
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: preset.secondary_color }}
                      />
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: preset.accent_color, borderColor: '#E2E8F0' }}
                      />
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: preset.background_color, borderColor: '#E2E8F0' }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      {active && <Check className="w-3 h-3" style={{ color: preset.primary_color }} />}
                      <span
                        className="text-xs font-medium"
                        style={{ color: active ? preset.primary_color : '#64748B' }}
                      >
                        {preset.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Custom Colors */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle style={{ color: colors.brown }}>Custom Colors</CardTitle>
              <CardDescription style={{ color: colors.brownLight }}>
                Fine-tune individual colors for your brand
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
              Reset
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.brown }}>
                  Primary Color (Buttons & Accents)
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
                  Secondary Color (Text)
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
                  Accent Color (Surfaces)
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

            {/* Live Preview */}
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
                    <span style={{ color: '#FFFFFF' }} className="font-bold text-sm">
                      {(companyName || 'CO').substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p style={{ color: secondaryColor }} className="font-bold">{companyName || 'Company Name'}</p>
                    <p style={{ color: secondaryColor, opacity: 0.6 }} className="text-sm">{tagline || 'Tagline'}</p>
                  </div>
                </div>
                {/* Sample card */}
                <div
                  className="p-3 rounded-md mb-3"
                  style={{ backgroundColor: accentColor }}
                >
                  <p style={{ color: secondaryColor }} className="text-sm font-medium">Sample card on accent surface</p>
                  <p style={{ color: secondaryColor, opacity: 0.6 }} className="text-xs mt-1">Secondary text on accent background</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 rounded text-sm font-medium"
                    style={{ backgroundColor: primaryColor, color: '#FFFFFF' }}
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
    </div>
  );
}
