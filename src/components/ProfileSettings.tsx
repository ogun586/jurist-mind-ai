import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GoldSpinner } from '@/components/ui/GoldSpinner';
import { ReferralDashboard } from '@/components/ReferralDashboard';

interface Country {
  name: { common: string };
  flags: { emoji: string };
  cca2: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '48px',
  padding: '0 1rem',
  backgroundColor: '#18181b',
  border: '1px solid #2a2a35',
  borderRadius: '12px',
  color: '#f0f0f5',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s ease',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b6b80', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);

  const userType = profile?.user_type || '';

  // Editable fields — seeded from profile
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [lawFirm, setLawFirm] = useState('');
  const [locationInCountry, setLocationInCountry] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [occupation, setOccupation] = useState('');

  // Seed form from profile
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || profile.display_name || '');
    setCountry(profile.country || '');
    setPhone(profile.phone || '');
    setLawFirm(profile.law_firm || '');
    setLocationInCountry(profile.location_in_country || '');
    setSchoolName(profile.school_name || '');
    setOccupation(profile.occupation || '');
  }, [profile]);

  // Fetch countries
  useEffect(() => {
    setLoadingCountries(true);
    fetch('https://restcountries.com/v3.1/all?fields=name,flags,cca2')
      .then((r) => r.json())
      .then((data: Country[]) => {
        const sorted = [...data].sort((a, b) => a.name.common.localeCompare(b.name.common));
        setCountries(sorted);
      })
      .catch(() => {})
      .finally(() => setLoadingCountries(false));
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        display_name: fullName,
        country: country || null,
        phone: phone || null,
        law_firm: lawFirm || null,
        location_in_country: locationInCountry || null,
        school_name: schoolName || null,
        occupation: occupation || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Could not save changes', description: error.message, variant: 'destructive' });
    } else {
      await refreshProfile(user.id);
      toast({ title: '✓ Profile updated', description: 'Your changes have been saved.' });
    }
    setSaving(false);
  };

  return (
    <div
      style={{
        minHeight: '100%',
        backgroundColor: '#0a0a0c',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#111115',
          border: '1px solid #1e1e2a',
          borderRadius: '20px',
          padding: '2rem',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0f5', marginBottom: '0.3rem' }}>
            Profile & Settings
          </h1>
          <p style={{ color: '#6b6b80', fontSize: '0.875rem' }}>
            Manage your personal information and preferences
          </p>

          {/* Role badge */}
          {userType && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '0.75rem',
                backgroundColor: 'rgba(201,168,76,0.1)',
                border: '1px solid rgba(201,168,76,0.25)',
                borderRadius: '999px',
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#c9a84c',
                textTransform: 'capitalize',
              }}
            >
              ⚖️ {userType}
            </div>
          )}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Field label="Full Name">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              style={inputStyle}
            />
          </Field>

          <Field label="Country">
            {loadingCountries ? (
              <div style={{ padding: '0.75rem 0' }}><GoldSpinner /></div>
            ) : (
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer', paddingRight: '2rem', appearance: 'none' as any }}
              >
                <option value="">Select country...</option>
                {countries.map((c) => (
                  <option key={c.cca2} value={c.name.common}>
                    {c.flags.emoji} {c.name.common}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Phone Number">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
              style={inputStyle}
            />
          </Field>

          {/* Lawyer-specific */}
          {userType === 'lawyer' && (
            <>
              <Field label="Law Firm / Chambers">
                <input
                  value={lawFirm}
                  onChange={(e) => setLawFirm(e.target.value)}
                  placeholder="e.g. Aelex, Independent..."
                  style={inputStyle}
                />
              </Field>
              <Field label="City / State">
                <input
                  value={locationInCountry}
                  onChange={(e) => setLocationInCountry(e.target.value)}
                  placeholder="e.g. Lagos, Abuja..."
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          {/* Student-specific */}
          {userType === 'student' && (
            <Field label="University / School">
              <input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Your university name"
                style={inputStyle}
              />
            </Field>
          )}

          {/* Other / Researcher */}
          {(userType === 'other' || userType === 'researcher') && (
            <Field label="Occupation">
              <input
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. Legal Researcher, Journalist..."
                style={inputStyle}
              />
            </Field>
          )}
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: '2rem',
            width: '100%',
            height: '50px',
            backgroundColor: saving ? '#2a2a35' : '#c9a84c',
            color: saving ? '#6b6b80' : '#0a0a0c',
            border: 'none',
            borderRadius: '12px',
            fontSize: '0.95rem',
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* Email read-only */}
        <p
          style={{
            marginTop: '1.25rem',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#3a3a4a',
          }}
        >
          Signed in as <span style={{ color: '#6b6b80' }}>{user?.email}</span>
        </p>

        {/* ── Divider ── */}
        <div style={{ margin: '2rem 0', height: '1px', backgroundColor: '#1e1e28' }} />

        {/* ── Referral Dashboard ── */}
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f0f0f5', marginBottom: '1rem' }}>
          Referral Commission
        </h2>
        <ReferralDashboard />
      </div>
    </div>
  );
}
