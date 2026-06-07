import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCountries } from '@/hooks/useCountryId';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Check, ChevronLeft, ChevronRight, Upload, X, Loader2, User, Building2,
  Scale, FileCheck2, Image as ImageIcon, Shield,
} from 'lucide-react';
import { toast } from 'sonner';

function detectPlatform(): string {
  const ref = document.referrer.toLowerCase();
  if (ref.includes('whatsapp.com')) return 'whatsapp';
  if (ref.includes('twitter.com') || ref.includes('x.com')) return 'twitter';
  if (ref.includes('linkedin.com')) return 'linkedin';
  if (ref.includes('facebook.com')) return 'facebook';
  if (!ref) return 'direct';
  return 'other';
}

const TOTAL_STEPS = 8;

interface JoinForm {
  account_type: 'individual' | 'firm';
  name: string;
  email: string;
  phone: string;
  bar_number: string;
  years_experience: number;
  specialization: string[];
  description: string;
  country_id: string;
  state: string;
  city: string;
  street: string;
  postal_code: string;
  firm_name: string;
  brand_accent_color: string;
  website: string;
  social_linkedin: string;
  social_twitter: string;
  confirm: boolean;
}

const DEFAULT_FORM: JoinForm = {
  account_type: 'individual',
  name: '',
  email: '',
  phone: '',
  bar_number: '',
  years_experience: 0,
  specialization: [],
  description: '',
  country_id: '',
  state: '',
  city: '',
  street: '',
  postal_code: '',
  firm_name: '',
  brand_accent_color: '#d4a843',
  website: '',
  social_linkedin: '',
  social_twitter: '',
  confirm: false,
};

const inputClass =
  'bg-[#1a1a1a] border-[#262626] text-white placeholder:text-[#737373] rounded-xl h-12 focus-visible:border-[#d4a843] focus-visible:ring-1 focus-visible:ring-[#d4a843]/30';

export default function Join() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { countries } = useAllCountries();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<JoinForm>(DEFAULT_FORM);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const avatarRef = useRef<HTMLInputElement>(null);
  const credRef = useRef<HTMLInputElement>(null);

  // Referral tracking from old behavior
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      if (!localStorage.getItem('jurist_ref')) {
        localStorage.setItem('jurist_ref', ref);
      }
      supabase.functions
        .invoke('track-referral-click', {
          body: {
            referral_code: ref,
            platform: detectPlatform(),
            user_agent: navigator.userAgent,
          },
        })
        .catch(() => {});
    }
  }, []);

  // Prefill from session/profile
  useEffect(() => {
    if (user || profile) {
      setForm((f) => ({
        ...f,
        name: f.name || (profile as any)?.full_name || (profile as any)?.display_name || '',
        email: f.email || user?.email || '',
        phone: f.phone || (profile as any)?.phone || '',
      }));
    }
  }, [user, profile]);

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const canContinue = (): boolean => {
    switch (step) {
      case 1: return !!form.account_type;
      case 2:
        if (user) return !!(form.name && form.email && form.phone);
        return !!(form.name && form.email && form.phone);
      case 3: return !!(form.bar_number && form.specialization.length > 0 && form.description);
      case 4: return !!(form.country_id && form.state && form.city);
      case 5: return true;
      case 6: return true;
      case 7: return true;
      case 8: return form.confirm;
      default: return true;
    }
  };

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCred = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('File must be under 10MB');
    setCredentialFile(file);
  };

  const handleSubmit = async () => {
    if (!user) {
      // Save form to localStorage so we can resume after auth
      localStorage.setItem('jurist_join_draft', JSON.stringify(form));
      toast.message('Please sign in to complete your registration.');
      navigate('/auth?return=/join');
      return;
    }
    if (!form.confirm) {
      toast.error('Please confirm the information is accurate');
      return;
    }

    setSubmitting(true);
    try {
      let avatarUrl: string | null = null;
      let credentialPath: string | null = null;

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const path = `${user.id}/avatar.${ext}`;
        const { error } = await supabase.storage
          .from('lawyer-assets')
          .upload(path, avatarFile, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('lawyer-assets').getPublicUrl(path);
        avatarUrl = data.publicUrl;
      }

      if (credentialFile) {
        const ext = credentialFile.name.split('.').pop();
        credentialPath = `${user.id}/bar-license.${ext}`;
        const { error } = await supabase.storage
          .from('lawyer-credentials')
          .upload(credentialPath, credentialFile, { upsert: true });
        if (error) throw error;
      }

      const countryName = countries.find((c) => c.id === form.country_id)?.name || null;

      const socialMedia = [form.social_linkedin, form.social_twitter]
        .filter(Boolean)
        .join(' | ');

      const { data, error } = await supabase.functions.invoke('search-lawyers', {
        body: {
          action: 'register',
          lawyerData: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            state: form.state,
            city: form.city,
            street: form.street,
            postal_code: form.postal_code,
            country: countryName,
            country_id_ref: form.country_id,
            firm_name: form.account_type === 'firm' ? form.firm_name : '',
            description: form.description,
            specialization: form.specialization,
            years_experience: Number(form.years_experience) || 0,
            bar_number: form.bar_number,
            social_media: socialMedia,
            website: form.website,
            brand_accent_color: form.brand_accent_color,
            avatar_url: avatarUrl,
            verification_status: 'pending',
            availability_status: 'offline',
          },
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      if (credentialPath && (data as any)?.data?.id) {
        await supabase.from('lawyer_credentials').insert({
          lawyer_id: (data as any).data.id,
          credential_type: 'bar_license',
          file_name: credentialFile!.name,
          file_path: credentialPath,
          file_size: credentialFile!.size,
          mime_type: credentialFile!.type,
          status: 'pending',
        });
      }

      localStorage.removeItem('jurist_join_draft');
      toast.success('Application submitted!');
      navigate('/pending-approval');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to submit registration');
    } finally {
      setSubmitting(false);
    }
  };

  // Resume draft after auth
  useEffect(() => {
    if (user) {
      const draft = localStorage.getItem('jurist_join_draft');
      if (draft) {
        try { setForm({ ...DEFAULT_FORM, ...JSON.parse(draft) }); } catch {}
      }
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#262626]">
        <div className="max-w-3xl mx-auto h-16 flex items-center justify-between px-4">
          <button
            onClick={() => navigate('/lawyers')}
            className="flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-[#d4a843] flex items-center justify-center">
              <span className="text-black font-bold text-sm">J</span>
            </div>
            <div className="text-left">
              <div className="text-white font-semibold tracking-tight text-sm">JURISTMIND</div>
              <div className="text-[10px] text-[#737373] uppercase tracking-widest">
                Lawyer Onboarding
              </div>
            </div>
          </button>
          <span className="text-xs text-[#737373]">Step {step} of {TOTAL_STEPS}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 pb-32">
        {/* Stepper */}
        <div className="flex items-center justify-between gap-2 mb-10">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={n} className="flex-1 flex items-center gap-2">
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all shrink-0',
                    active && 'bg-[#d4a843] text-black ring-2 ring-[#d4a843]/30',
                    done && 'bg-[#d4a843]/20 text-[#d4a843]',
                    !active && !done && 'bg-[#1a1a1a] text-[#737373] border border-[#262626]',
                  ].filter(Boolean).join(' ')}
                >
                  {done ? <Check className="w-4 h-4" /> : n}
                </div>
                {n < TOTAL_STEPS && (
                  <div className={`hidden sm:block h-px flex-1 ${n < step ? 'bg-[#d4a843]/40' : 'bg-[#262626]'}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[#262626] bg-[#111111] p-6 md:p-8">
          {/* Step 1 — Account Type */}
          {step === 1 && (
            <Section title="Account Type" subtitle="Choose how you want to be listed on JURISTMIND.">
              <div className="grid sm:grid-cols-2 gap-4 mt-2">
                {([
                  { v: 'individual', icon: User, label: 'Individual Lawyer', desc: 'I practice on my own or as a member of a firm.' },
                  { v: 'firm', icon: Building2, label: 'Law Firm', desc: 'I am registering a firm with multiple lawyers.' },
                ] as const).map((opt) => {
                  const Active = form.account_type === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setForm({ ...form, account_type: opt.v })}
                      className={[
                        'text-left rounded-2xl border p-5 transition-all',
                        Active
                          ? 'border-[#d4a843] bg-[#d4a843]/5'
                          : 'border-[#262626] bg-[#161616] hover:border-[#333333]',
                      ].join(' ')}
                    >
                      <opt.icon className={`w-6 h-6 mb-3 ${Active ? 'text-[#d4a843]' : 'text-[#737373]'}`} />
                      <div className="text-white font-semibold mb-1">{opt.label}</div>
                      <div className="text-sm text-[#a3a3a3] leading-relaxed">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Step 2 — Basic Info */}
          {step === 2 && (
            <Section title="Basic Info" subtitle="How clients reach you.">
              {!user && (
                <div className="mb-4 rounded-xl bg-[#d4a843]/10 border border-[#d4a843]/30 px-4 py-3 text-sm text-[#e8c566]">
                  You'll be prompted to sign in before submission so we can verify your identity.
                </div>
              )}
              <Field label="Full Name">
                <Input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full legal name" />
              </Field>
              <Field label="Email">
                <Input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </Field>
              <Field label="Phone Number">
                <Input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234 ..." />
              </Field>
            </Section>
          )}

          {/* Step 3 — Professional */}
          {step === 3 && (
            <Section title="Professional Details" subtitle="Your credentials and practice areas.">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Bar License Number">
                  <Input className={inputClass} value={form.bar_number} onChange={(e) => setForm({ ...form, bar_number: e.target.value })} placeholder="Official bar enrolment number" />
                </Field>
                <Field label="Years of Experience">
                  <Input className={inputClass} type="number" min={0} value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Practice Areas (comma-separated)">
                <Input className={inputClass} value={form.specialization.join(', ')} onChange={(e) => setForm({ ...form, specialization: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Corporate, Litigation, Human Rights" />
              </Field>
              <Field label="Short Bio">
                <Textarea rows={4} className={`${inputClass} h-auto min-h-[120px] py-3`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A brief introduction shown on your public profile..." />
              </Field>
            </Section>
          )}

          {/* Step 4 — Location */}
          {step === 4 && (
            <Section title="Location" subtitle="Where you practice.">
              <Field label="Country of Practice">
                <Select value={form.country_id} onValueChange={(v) => setForm({ ...form, country_id: v })}>
                  <SelectTrigger className={inputClass}><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent className="bg-[#161616] border-[#262626] text-white max-h-72">
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="focus:bg-[#1a1a1a] focus:text-white">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="State / Province"><Input className={inputClass} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
                <Field label="City"><Input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Street (optional)"><Input className={inputClass} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></Field>
                <Field label="Postal Code (optional)"><Input className={inputClass} value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} /></Field>
              </div>
            </Section>
          )}

          {/* Step 5 — Branding */}
          {step === 5 && (
            <Section title="Branding" subtitle="Make your profile yours.">
              {form.account_type === 'firm' && (
                <Field label="Firm Name"><Input className={inputClass} value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value })} placeholder="Your firm's name" /></Field>
              )}
              <Field label="Profile Image">
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => avatarRef.current?.click()}
                    className="w-20 h-20 rounded-2xl bg-[#1a1a1a] border border-dashed border-[#333333] flex items-center justify-center cursor-pointer hover:border-[#d4a843] overflow-hidden"
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-[#737373]" />
                    )}
                  </div>
                  <div>
                    <Button type="button" variant="outline" className="rounded-xl border-[#333333] bg-transparent text-white hover:border-[#d4a843] hover:text-[#d4a843] hover:bg-[#d4a843]/5" onClick={() => avatarRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Upload Image
                    </Button>
                    <p className="text-xs text-[#737373] mt-2">PNG or JPG, max 5MB.</p>
                  </div>
                  <input ref={avatarRef} type="file" accept="image/*" hidden onChange={handleAvatar} />
                </div>
              </Field>
              <Field label="Brand Accent Color">
                <div className="flex items-center gap-3">
                  <input type="color" value={form.brand_accent_color} onChange={(e) => setForm({ ...form, brand_accent_color: e.target.value })} className="w-12 h-12 rounded-xl border border-[#262626] bg-[#1a1a1a] cursor-pointer" />
                  <Input className={inputClass} value={form.brand_accent_color} onChange={(e) => setForm({ ...form, brand_accent_color: e.target.value })} />
                </div>
              </Field>
            </Section>
          )}

          {/* Step 6 — Social */}
          {step === 6 && (
            <Section title="Social & Contact" subtitle="Optional links shown on your profile.">
              <Field label="Website"><Input className={inputClass} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourfirm.com" /></Field>
              <Field label="LinkedIn"><Input className={inputClass} value={form.social_linkedin} onChange={(e) => setForm({ ...form, social_linkedin: e.target.value })} placeholder="linkedin.com/in/your-handle" /></Field>
              <Field label="Twitter / X"><Input className={inputClass} value={form.social_twitter} onChange={(e) => setForm({ ...form, social_twitter: e.target.value })} placeholder="@yourhandle" /></Field>
            </Section>
          )}

          {/* Step 7 — Documents */}
          {step === 7 && (
            <Section title="Verification Documents" subtitle="Upload your bar license or other credentials.">
              <div
                onClick={() => credRef.current?.click()}
                className={[
                  'rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all',
                  credentialFile ? 'border-[#22c55e] bg-[#22c55e]/5' : 'border-[#333333] hover:border-[#d4a843] bg-[#161616]',
                ].join(' ')}
              >
                {credentialFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileCheck2 className="w-7 h-7 text-[#22c55e]" />
                    <div className="text-left">
                      <div className="text-white font-medium">{credentialFile.name}</div>
                      <div className="text-xs text-[#737373]">{(credentialFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setCredentialFile(null); }} className="ml-2 text-[#737373] hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-[#737373] mx-auto mb-3" />
                    <div className="text-white font-medium mb-1">Upload Bar License / Credential</div>
                    <div className="text-xs text-[#737373]">PDF or image, max 10MB</div>
                  </>
                )}
                <input ref={credRef} type="file" accept=".pdf,image/*" hidden onChange={handleCred} />
              </div>
            </Section>
          )}

          {/* Step 8 — Review */}
          {step === 8 && (
            <Section title="Review & Submit" subtitle="Confirm your information.">
              <div className="space-y-3 text-sm">
                <ReviewRow label="Type" value={form.account_type === 'firm' ? 'Law Firm' : 'Individual Lawyer'} />
                <ReviewRow label="Name" value={form.name} />
                <ReviewRow label="Email" value={form.email} />
                <ReviewRow label="Phone" value={form.phone} />
                <ReviewRow label="Bar Number" value={form.bar_number} />
                <ReviewRow label="Experience" value={`${form.years_experience} years`} />
                <ReviewRow label="Practice Areas" value={form.specialization.join(', ')} />
                <ReviewRow label="Country" value={countries.find((c) => c.id === form.country_id)?.name || '—'} />
                <ReviewRow label="Location" value={[form.city, form.state].filter(Boolean).join(', ')} />
                {form.account_type === 'firm' && <ReviewRow label="Firm" value={form.firm_name} />}
              </div>
              <label className="flex items-start gap-3 mt-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.checked })}
                  className="mt-1 w-4 h-4 accent-[#d4a843]"
                />
                <span className="text-sm text-[#a3a3a3]">
                  I confirm the information above is accurate, and I agree to JURISTMIND's verification review process.
                </span>
              </label>
            </Section>
          )}
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 inset-x-0 md:static md:mt-6 bg-[#0a0a0a]/95 md:bg-transparent backdrop-blur border-t border-[#262626] md:border-0 px-4 py-3 md:p-0 z-40 flex gap-3">
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={back}
              className="rounded-xl h-12 px-5 text-[#a3a3a3] hover:text-white hover:bg-[#1a1a1a]"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          <div className="flex-1" />
          {step < TOTAL_STEPS ? (
            <Button
              onClick={next}
              disabled={!canContinue()}
              className="rounded-xl h-12 px-6 bg-[#d4a843] text-black hover:bg-[#e8c566] active:scale-[0.97] font-semibold"
            >
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !form.confirm}
              className="rounded-xl h-12 px-6 bg-[#d4a843] text-black hover:bg-[#e8c566] active:scale-[0.97] font-semibold"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              {submitting ? 'Submitting…' : 'Submit Application'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-[#737373] mb-2">Step</p>
        <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[#a3a3a3] mt-1.5">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-widest text-[#737373] font-medium mb-2 block">{label}</Label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#262626] last:border-0">
      <span className="text-[#737373] uppercase tracking-widest text-[10px]">{label}</span>
      <span className="text-white text-right">{value || '—'}</span>
    </div>
  );
}