import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Mail, Lock, Loader2, Home, Camera, Upload } from 'lucide-react';
import { Link } from 'wouter';
import { Footer } from '@/components/Footer';
import defaultLogo from '@assets/Erwin-Mills-Logo_1767709452739.png';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
};

export default function UserProfile() {
  const { profile, user, tenant, branding, primaryTenant } = useAuth();
  const { toast } = useToast();

  // Location-aware branding
  const isChildLocation = !!tenant?.parent_tenant_id;
  const displayName = isChildLocation ? tenant?.name : (branding?.company_name || tenant?.name || 'Erwin Mills Coffee');
  const orgName = primaryTenant?.name || branding?.company_name || '';
  const logoUrl = branding?.logo_url || defaultLogo;

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async () => {
    if (!profile?.id) return;

    setUpdatingProfile(true);
    try {
      const TIMEOUT_MS = 10000;

      // Update full name in user_profiles
      if (fullName !== profile.full_name) {
        const profilePromise = supabase
          .from('user_profiles')
          .update({ full_name: fullName, updated_at: new Date().toISOString() })
          .eq('id', profile.id);

        const { error: profileError } = await Promise.race([
          profilePromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Profile update timeout')), TIMEOUT_MS)
          )
        ]);

        if (profileError) throw profileError;
      }

      // Update email in auth
      if (email !== user?.email) {
        const emailPromise = supabase.auth.updateUser({ email });

        const { error: emailError } = await Promise.race([
          emailPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Email update timeout')), TIMEOUT_MS)
          )
        ]);

        if (emailError) throw emailError;

        toast({
          title: 'Email update initiated',
          description: 'Please check your new email address to confirm the change.',
        });
      } else {
        toast({ title: 'Profile updated successfully' });
      }

      // Reload page to refresh profile data
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast({
        title: 'Error updating profile',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: 'Please fill in all password fields', variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'New passwords do not match', variant: 'destructive' });
      return;
    }

    if (newPassword.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    setUpdatingPassword(true);
    try {
      const TIMEOUT_MS = 10000;

      const updatePromise = supabase.auth.updateUser({
        password: newPassword,
      });

      const { error } = await Promise.race([
        updatePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Password update timeout')), TIMEOUT_MS)
        )
      ]);

      if (error) throw error;

      toast({ title: 'Password updated successfully' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Error updating password',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!profile?.id || !user?.id) return;

    setUploadingAvatar(true);
    try {
      const TIMEOUT_MS = 15000;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size must be less than 5MB');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Upload new avatar
      const uploadPromise = supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      const { data: uploadData, error: uploadError } = await Promise.race([
        uploadPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Upload timeout')), TIMEOUT_MS)
        )
      ]);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const updatePromise = supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      const { error: updateError } = await Promise.race([
        updatePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Profile update timeout')), TIMEOUT_MS)
        )
      ]);

      if (updateError) throw updateError;

      toast({ title: 'Profile photo updated successfully' });

      // Reload page to refresh avatar
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast({
        title: 'Error uploading photo',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleAvatarUpload(file);
    }
  };

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

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <header className="px-6 py-6 relative">
        <Link
          href="/"
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm"
          style={{ backgroundColor: colors.gold, color: colors.white }}
          data-testid="link-dashboard"
        >
          <Home className="w-4 h-4" />
          Main Dashboard
        </Link>
        <div className="max-w-7xl mx-auto text-center pt-10">
          <img
            src={logoUrl}
            alt={displayName}
            className="h-20 mx-auto mb-3"
            data-testid="img-logo"
          />
          <h2 className="text-xl font-semibold" style={{ color: colors.brown }}>
            My Profile
          </h2>
          {isChildLocation && orgName && (
            <p className="text-sm" style={{ color: colors.brownLight }}>
              {displayName} • Part of {orgName}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Profile Photo */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              {/* Avatar Display */}
              <div className="relative">
                <div
                  className="w-32 h-32 rounded-full overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: colors.cream, border: `3px solid ${colors.gold}` }}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || 'Profile'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-16 h-16" style={{ color: colors.brownLight }} />
                  )}
                </div>
                {uploadingAvatar && (
                  <div
                    className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
              </div>

              {/* Upload Buttons */}
              <div className="flex gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  variant="outline"
                  style={{ borderColor: colors.gold, color: colors.gold }}
                  data-testid="button-upload-photo"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  variant="outline"
                  style={{ borderColor: colors.brown, color: colors.brown }}
                  data-testid="button-camera-photo"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
              </div>

              <p className="text-xs text-center" style={{ color: colors.brownLight }}>
                Supported formats: JPG, PNG, GIF (max 5MB)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label style={{ color: colors.brown }}>Full Name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                style={{ backgroundColor: colors.cream, borderColor: colors.creamDark }}
                data-testid="input-full-name"
              />
            </div>

            <div>
              <Label style={{ color: colors.brown }}>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                style={{ backgroundColor: colors.cream, borderColor: colors.creamDark }}
                data-testid="input-email"
              />
              <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                Changing your email will require confirmation at the new address
              </p>
            </div>

            <div>
              <Label style={{ color: colors.brown }}>Role</Label>
              <div className="px-3 py-2 rounded capitalize" style={{ backgroundColor: colors.cream, color: colors.brown }}>
                {profile.role}
              </div>
            </div>

            <Button
              onClick={handleUpdateProfile}
              disabled={updatingProfile}
              className="w-full"
              style={{ backgroundColor: colors.gold, color: colors.brown }}
              data-testid="button-update-profile"
            >
              {updatingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Profile'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: colors.brown }}>
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label style={{ color: colors.brown }}>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                style={{ backgroundColor: colors.cream, borderColor: colors.creamDark }}
                data-testid="input-new-password"
              />
              <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                Must be at least 8 characters
              </p>
            </div>

            <div>
              <Label style={{ color: colors.brown }}>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                style={{ backgroundColor: colors.cream, borderColor: colors.creamDark }}
                data-testid="input-confirm-password"
              />
            </div>

            <Button
              onClick={handleUpdatePassword}
              disabled={updatingPassword || !newPassword || !confirmPassword}
              className="w-full"
              style={{ backgroundColor: colors.brown, color: colors.white }}
              data-testid="button-update-password"
            >
              {updatingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle style={{ color: colors.brown }}>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span style={{ color: colors.brownLight }}>Account ID:</span>
              <span className="font-mono text-xs" style={{ color: colors.brown }}>{profile.id.substring(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: colors.brownLight }}>Organization:</span>
              <span style={{ color: colors.brown }}>{tenant?.name}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: colors.brownLight }}>Status:</span>
              <span className="px-2 py-0.5 rounded text-sm" style={{ backgroundColor: colors.gold, color: colors.white }}>
                Active
              </span>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
