import { useState, useRef } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, Upload, X, CheckCircle2, AlertCircle, User, Building, MapPin, 
  Briefcase, FileText, Palette, Image
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { useCountryId, useAllCountries } from "@/hooks/useCountryId";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RegisterLawyerDialogProps {
  onLawyerAdded: () => void;
}

interface LawyerForm {
  name: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  street: string;
  postal_code: string;
  firm_name: string;
  description: string;
  specialization: string[];
  years_experience: number;
  bar_number: string;
  social_media: string;
  website: string;
  brand_accent_color: string;
  bio_about: string;
  bio_approach: string;
}

export function RegisterLawyerDialog({ onLawyerAdded }: RegisterLawyerDialogProps) {
  const { user, profile } = useAuth();
  const { countryId, countryName } = useCountryId();
  const { countries } = useAllCountries();
  const [selectedCountryId, setSelectedCountryId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const credentialInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<LawyerForm>({
    name: (profile as any)?.full_name || (profile as any)?.display_name || "",
    email: user?.email || "",
    phone: "",
    state: "",
    city: "",
    street: "",
    postal_code: "",
    firm_name: "",
    description: "",
    specialization: [],
    years_experience: 0,
    bar_number: "",
    social_media: "",
    website: "",
    brand_accent_color: "#d4a843",
    bio_about: "",
    bio_approach: ""
  });

  // Default to user's onboarded country once countries load
  useState; // keep React happy

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Avatar must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleCredentialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Credential file must be less than 10MB');
        return;
      }
      setCredentialFile(file);
    }
  };

  const handleSpecializationChange = (value: string) => {
    const specs = value.split(',').map(s => s.trim()).filter(s => s);
    setForm({ ...form, specialization: specs });
  };

  // Sync default country once countries are loaded
  if (!selectedCountryId && countryId && countries.find(c => c.id === countryId)) {
    // initialise after first paint; safe because state update only fires once
    queueMicrotask(() => setSelectedCountryId(countryId));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to register');
      return;
    }

    if (!selectedCountryId) {
      toast.error('Please select your country of practice');
      setStep(2);
      return;
    }
    
    setLoading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(15);
      const safeExt = (file: File) => file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const stamp = Date.now();
      const uploadJobs: Promise<{ type: 'avatar' | 'credential'; path: string; file: File }>[] = [];

      if (avatarFile) {
        const avatarPath = `${user.id}/avatar-${stamp}.${safeExt(avatarFile)}`;
        uploadJobs.push(
          supabase.storage.from('lawyer-assets').upload(avatarPath, avatarFile).then(({ error }) => {
            if (error) throw new Error(`Avatar upload failed: ${error.message}`);
            return { type: 'avatar' as const, path: avatarPath, file: avatarFile };
          })
        );
      }

      if (credentialFile) {
        const credentialPath = `${user.id}/bar-license-${stamp}.${safeExt(credentialFile)}`;
        uploadJobs.push(
          supabase.storage.from('lawyer-credentials').upload(credentialPath, credentialFile).then(({ error }) => {
            if (error) throw new Error(`Credential upload failed: ${error.message}`);
            return { type: 'credential' as const, path: credentialPath, file: credentialFile };
          })
        );
      }

      const uploadResults = await Promise.allSettled(uploadJobs);
      let avatarUrl: string | null = null;
      let credentialUpload: { path: string; file: File } | null = null;

      uploadResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.type === 'avatar') {
            const { data: { publicUrl } } = supabase.storage.from('lawyer-assets').getPublicUrl(result.value.path);
            avatarUrl = publicUrl;
          } else {
            credentialUpload = { path: result.value.path, file: result.value.file };
          }
        } else {
          console.warn('Optional upload warning:', result.reason);
        }
      });

      setUploadProgress(60);

      // Register lawyer profile
      const bioStructured = {
        about: form.bio_about || form.description,
        approach: form.bio_approach,
        case_studies: []
      };

      const { data: existing, error: existingError } = await supabase
        .from('lawyers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) throw new Error('You already have a lawyer profile registered');

      const { data, error } = await supabase
        .from('lawyers')
        .insert({
          user_id: user.id,
          name: form.name,
          email: form.email,
          phone: form.phone,
          state: form.state,
          city: form.city,
          street: form.street || null,
          postal_code: form.postal_code || null,
          country: countries.find(c => c.id === selectedCountryId)?.name || null,
          country_id_ref: selectedCountryId,
          firm_name: form.firm_name || null,
          description: form.description,
          specialization: form.specialization,
          years_experience: Number(form.years_experience) || 0,
          bar_number: form.bar_number,
          social_media: form.social_media || null,
          website: form.website || null,
          brand_accent_color: form.brand_accent_color || '#d4a843',
          bio_structured: bioStructured,
          avatar_url: avatarUrl,
          verified: false,
          verification_status: 'pending',
          availability_status: 'offline'
        })
        .select()
        .single();

      if (error) throw error;
      setUploadProgress(90);

      // Create credential record if file was uploaded
      if (credentialUpload && data?.id) {
        supabase.from('lawyer_credentials').insert({
          lawyer_id: data.id,
          credential_type: 'bar_license',
          file_name: credentialUpload.file.name,
          file_path: credentialUpload.path,
          file_size: credentialUpload.file.size,
          mime_type: credentialUpload.file.type,
          status: 'pending'
        }).then(({ error: credRecordError }) => {
          if (credRecordError) console.error('Credential record error:', credRecordError);
        });
      }

      supabase.functions.invoke('notify-admin-lawyer-signup', { body: { lawyer: data } })
        .catch((notifyError) => console.error('Admin notify failed:', notifyError));

      setUploadProgress(100);
      toast.success('Profile submitted for verification! Our team will review and contact you.');
      handleClose();
      onLawyerAdded();
    } catch (error: any) {
      console.error('Error registering lawyer:', error);
      toast.error(error.message || 'Failed to register profile');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep(1);
    setAvatarFile(null);
    setAvatarPreview(null);
    setCredentialFile(null);
    setUploadProgress(0);
    setForm({
      name: (profile as any)?.full_name || (profile as any)?.display_name || "",
      email: user?.email || "",
      phone: "",
      state: "",
      city: "",
      street: "",
      postal_code: "",
      firm_name: "",
      description: "",
      specialization: [],
      years_experience: 0,
      bar_number: "",
      social_media: "",
      website: "",
      brand_accent_color: "#1e40af",
      bio_about: "",
      bio_approach: ""
    });
  };

  const steps = [
    { number: 1, title: "Personal Info", icon: User },
    { number: 2, title: "Practice Details", icon: Briefcase },
    { number: 3, title: "Branding", icon: Palette },
    { number: 4, title: "Verification", icon: FileText }
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="gap-2 shadow-lg" 
          disabled={!user}
        >
          <Plus className="w-4 h-4" />
          {user ? 'Register as Lawyer' : 'Login to Register'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create Your Legal Identity</DialogTitle>
          <DialogDescription>
            Build your professional profile on JuristMind — practising in any supported jurisdiction
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((s, idx) => (
            <div key={s.number} className="flex items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  step >= s.number 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <s.icon className="w-5 h-5" />
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 ${step > s.number ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="font-semibold text-lg mb-1">Personal Information</h3>
                <p className="text-sm text-muted-foreground">Tell us about yourself</p>
              </div>

              {/* Avatar Upload */}
              <div className="flex justify-center mb-6">
                <div 
                  className="relative w-24 h-24 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <Image className="w-8 h-8 text-muted-foreground" />
                  )}
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <Upload className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your full legal name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Include country code"
                  />
                </div>
                <div>
                  <Label htmlFor="years_experience">Years of Experience</Label>
                  <Input
                    id="years_experience"
                    type="number"
                    min="0"
                    value={form.years_experience}
                    onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Short Bio *</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="A brief introduction shown on your JuristMind public profile..."
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Practice Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="font-semibold text-lg mb-1">Practice Details</h3>
                <p className="text-sm text-muted-foreground">Your firm and location</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firm_name">Firm Name</Label>
                  <Input
                    id="firm_name"
                    value={form.firm_name}
                    onChange={(e) => setForm({ ...form, firm_name: e.target.value })}
                    placeholder="Your law firm or chambers"
                  />
                </div>
                <div>
                  <Label htmlFor="bar_number">Bar Number *</Label>
                  <Input
                    id="bar_number"
                    value={form.bar_number}
                    onChange={(e) => setForm({ ...form, bar_number: e.target.value })}
                    placeholder="Official bar enrolment number"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="specialization">Areas of Practice * (comma-separated)</Label>
                <Input
                  id="specialization"
                  value={form.specialization.join(', ')}
                  onChange={(e) => handleSpecializationChange(e.target.value)}
                  placeholder="e.g. Corporate, Litigation, Human Rights"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="State / Province"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="City"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="country">Country of Practice *</Label>
                <Select value={selectedCountryId} onValueChange={setSelectedCountryId}>
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Your profile will be filed under this jurisdiction on JuristMind.
                </p>
              </div>

              <div>
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  placeholder="Office address (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://your-firm.com"
                  />
                </div>
                <div>
                  <Label htmlFor="social_media">LinkedIn / Social</Label>
                  <Input
                    id="social_media"
                    value={form.social_media}
                    onChange={(e) => setForm({ ...form, social_media: e.target.value })}
                    placeholder="linkedin.com/in/your-handle"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Branding */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="font-semibold text-lg mb-1">Personal Branding</h3>
                <p className="text-sm text-muted-foreground">Customize your profile appearance</p>
              </div>

              <div>
                <Label htmlFor="brand_color">Brand Accent Color</Label>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    type="color"
                    id="brand_color"
                    value={form.brand_accent_color}
                    onChange={(e) => setForm({ ...form, brand_accent_color: e.target.value })}
                    className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                  />
                  <Input
                    value={form.brand_accent_color}
                    onChange={(e) => setForm({ ...form, brand_accent_color: e.target.value })}
                    placeholder="#1e40af"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This color will accent your profile elements
                </p>
              </div>

              <div>
                <Label htmlFor="bio_about">Detailed About Section</Label>
                <Textarea
                  id="bio_about"
                  rows={4}
                  value={form.bio_about}
                  onChange={(e) => setForm({ ...form, bio_about: e.target.value })}
                  placeholder="Describe your background, education, notable achievements, and why clients should work with you..."
                />
              </div>

              <div>
                <Label htmlFor="bio_approach">Your Approach</Label>
                <Textarea
                  id="bio_approach"
                  rows={4}
                  value={form.bio_approach}
                  onChange={(e) => setForm({ ...form, bio_approach: e.target.value })}
                  placeholder="Describe how you work with clients, your philosophy, and what makes your practice unique..."
                />
              </div>
            </div>
          )}

          {/* Step 4: Verification */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="font-semibold text-lg mb-1">Verification Documents</h3>
                <p className="text-sm text-muted-foreground">Upload your credentials for admin review</p>
              </div>

              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  credentialFile 
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' 
                    : 'border-muted-foreground/30 hover:border-primary'
                }`}
                onClick={() => credentialInputRef.current?.click()}
              >
                {credentialFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <div className="text-left">
                      <p className="font-medium">{credentialFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(credentialFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCredentialFile(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium mb-1">Upload Bar License or Certificate</p>
                    <p className="text-sm text-muted-foreground">PDF or Image, max 10MB</p>
                  </>
                )}
              </div>
              <input
                ref={credentialInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleCredentialChange}
                className="hidden"
              />

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-400">Admin Verification Required</p>
                    <p className="text-sm text-amber-700 dark:text-amber-500">
                      Your profile will be reviewed by our team. You'll receive a notification once verified. 
                      Verified profiles get a trust badge and higher visibility.
                    </p>
                  </div>
                </div>
              </div>

              {loading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-sm text-center text-muted-foreground">
                    {uploadProgress < 30 && 'Uploading avatar...'}
                    {uploadProgress >= 30 && uploadProgress < 70 && 'Uploading credentials...'}
                    {uploadProgress >= 70 && uploadProgress < 100 && 'Creating profile...'}
                    {uploadProgress === 100 && 'Complete!'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3 pt-6 border-t mt-6">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button 
                type="button" 
                onClick={() => setStep(step + 1)} 
                className="flex-1"
                disabled={step === 1 && (!form.name || !form.email || !form.description)}
              >
                Continue
              </Button>
            ) : (
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Submitting...' : 'Submit for Verification'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
