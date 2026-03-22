import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Country {
  name: { common: string };
  flags: { emoji: string };
  cca2: string;
}

interface University {
  name: string;
}

// ─── Animation Variants ─────────────────────────────────────────────────────
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

const transition = { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] };

// ─── Shared Input Style ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '52px',
  padding: '0 1rem',
  backgroundColor: '#18181b',
  border: '1px solid #2a2a35',
  borderRadius: '12px',
  color: '#f0f0f5',
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.2s ease',
  cursor: 'text',
  appearance: 'none' as any,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  paddingRight: '2.5rem',
};

// ─── Gold Spinner ────────────────────────────────────────────────────────────
function GoldSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
      <div
        style={{
          width: 28,
          height: 28,
          border: '3px solid #2a2a35',
          borderTop: '3px solid #c9a84c',
          borderRadius: '50%',
          animation: 'jurist-spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes jurist-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Question Wrapper ────────────────────────────────────────────────────────
function Question({
  heading,
  subtext,
  children,
}: {
  heading: string;
  subtext?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ width: '100%' }}>
      <h2
        style={{
          fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
          fontWeight: 700,
          color: '#f0f0f5',
          marginBottom: '0.5rem',
          lineHeight: 1.2,
        }}
      >
        {heading}
      </h2>
      {subtext && (
        <p style={{ color: '#6b6b80', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          {subtext}
        </p>
      )}
      <div style={{ marginTop: subtext ? 0 : '1.5rem' }}>{children}</div>
    </div>
  );
}

// ─── Main Onboarding Component ───────────────────────────────────────────────
export function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step state
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Form state
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [schoolCountry, setSchoolCountry] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [manualSchool, setManualSchool] = useState('');
  const [isManualSchool, setIsManualSchool] = useState(false);
  const [lawFirm, setLawFirm] = useState('');
  const [locationInCountry, setLocationInCountry] = useState('');
  const [occupation, setOccupation] = useState('');

  // API data
  const [countries, setCountries] = useState<Country[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingUniversities, setLoadingUniversities] = useState(false);
  const [saving, setSaving] = useState(false);

  // Determine user type from profile or auth metadata
  const userType = profile?.user_type || user?.user_metadata?.user_type || '';

  // ─── Build steps based on role ─────────────────────────────────────────────
  const getSteps = () => {
    const base = ['name', 'country'];
    if (userType === 'student') return [...base, 'schoolCountry', 'schoolName', 'welcome'];
    if (userType === 'lawyer') return [...base, 'lawFirm', 'location', 'welcome'];
    return [...base, 'occupation', 'welcome'];
  };

  const steps = getSteps();
  const totalSteps = steps.length;
  const currentQuestion = steps[currentStep];

  // ─── Pre-fill name ─────────────────────────────────────────────────────────
  useEffect(() => {
    const name =
      profile?.full_name ||
      profile?.display_name ||
      user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      '';
    if (name) setFullName(name);
  }, [profile, user]);

  // ─── Fetch countries ───────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCountries = async () => {
      setLoadingCountries(true);
      try {
        const res = await fetch('https://restcountries.com/v3.1/all?fields=name,flags,cca2');
        const data = await res.json();
        const sorted = [...data].sort((a: Country, b: Country) =>
          a.name.common.localeCompare(b.name.common)
        );
        setCountries(sorted);
      } catch {
        toast({ title: 'Could not load countries', variant: 'destructive' });
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  // ─── Fetch universities when school country changes ────────────────────────
  useEffect(() => {
    if (!schoolCountry) return;
    const fetchUniversities = async () => {
      setLoadingUniversities(true);
      try {
        const res = await fetch(
          `https://universities.hipolabs.com/search?country=${encodeURIComponent(schoolCountry)}`
        );
        const data = await res.json();
        setUniversities(data);
        setSchoolName('');
        setIsManualSchool(false);
      } catch {
        toast({ title: 'Could not load universities', variant: 'destructive' });
      } finally {
        setLoadingUniversities(false);
      }
    };
    fetchUniversities();
  }, [schoolCountry]);

  // ─── Validation ────────────────────────────────────────────────────────────
  const isStepValid = useCallback(() => {
    switch (currentQuestion) {
      case 'name': return fullName.trim().length > 0;
      case 'country': return country.length > 0;
      case 'schoolCountry': return schoolCountry.length > 0;
      case 'schoolName': return isManualSchool ? manualSchool.trim().length > 0 : schoolName.length > 0;
      case 'lawFirm': return lawFirm.trim().length > 0;
      case 'location': return locationInCountry.trim().length > 0;
      case 'occupation': return occupation.trim().length > 0;
      case 'welcome': return true;
      default: return true;
    }
  }, [currentQuestion, fullName, country, schoolCountry, schoolName, manualSchool,
      isManualSchool, lawFirm, locationInCountry, occupation]);

  // ─── Keyboard Enter ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && currentQuestion !== 'welcome') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isStepValid]);

  // ─── Navigation ───────────────────────────────────────────────────────────
  const handleNext = () => {
    if (!isStepValid()) return;
    if (currentQuestion === 'welcome') {
      handleComplete();
      return;
    }
    setDirection(1);
    setCurrentStep((p) => p + 1);
  };

  const handleBack = () => {
    if (currentStep === 0) return;
    setDirection(-1);
    setCurrentStep((p) => p - 1);
  };

  // ─── Save to Supabase ─────────────────────────────────────────────────────
  const handleComplete = async () => {
    if (!user) return;
    setSaving(true);

    const updateData: any = {
      full_name: fullName,
      display_name: fullName,
      country,
      onboarding_completed: true,
    };

    if (userType === 'student') {
      updateData.school_country = schoolCountry || null;
      updateData.school_name = isManualSchool ? manualSchool : schoolName || null;
    } else if (userType === 'lawyer') {
      updateData.law_firm = lawFirm || null;
      updateData.location_in_country = locationInCountry || null;
    } else {
      updateData.occupation = occupation || null;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', user.id);

    setSaving(false);

    if (error) {
      toast({ title: 'Something went wrong', description: error.message, variant: 'destructive' });
    } else {
      await refreshProfile();
      navigate('/');
    }
  };

  // ─── Render question content ──────────────────────────────────────────────
  const renderQuestion = () => {
    switch (currentQuestion) {
      case 'name':
        return (
          <Question heading="What's your full name?" subtext="We'll use this to personalise your experience.">
            <input
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Adebayo Okafor"
              style={inputStyle}
            />
          </Question>
        );

      case 'country':
        return (
          <Question heading="Where are you based?" subtext="Select your country of practice or residence.">
            {loadingCountries ? (
              <GoldSpinner />
            ) : (
              <select value={country} onChange={(e) => setCountry(e.target.value)} style={selectStyle}>
                <option value="">Select your country...</option>
                {countries.map((c) => (
                  <option key={c.cca2} value={c.name.common}>
                    {c.flags.emoji} {c.name.common}
                  </option>
                ))}
              </select>
            )}
          </Question>
        );

      case 'schoolCountry':
        return (
          <Question heading="Which country is your school in?" subtext="We'll load your university options from there.">
            {loadingCountries ? (
              <GoldSpinner />
            ) : (
              <select value={schoolCountry} onChange={(e) => setSchoolCountry(e.target.value)} style={selectStyle}>
                <option value="">Select country...</option>
                {countries.map((c) => (
                  <option key={c.cca2} value={c.name.common}>
                    {c.flags.emoji} {c.name.common}
                  </option>
                ))}
              </select>
            )}
          </Question>
        );

      case 'schoolName':
        return (
          <Question heading="Which university do you attend?">
            {loadingUniversities ? (
              <GoldSpinner />
            ) : isManualSchool ? (
              <>
                <input
                  autoFocus
                  value={manualSchool}
                  onChange={(e) => setManualSchool(e.target.value)}
                  placeholder="Type your university name..."
                  style={inputStyle}
                />
                <button
                  onClick={() => { setIsManualSchool(false); setManualSchool(''); }}
                  style={{ marginTop: '0.6rem', color: '#c9a84c', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                >
                  ← Back to list
                </button>
              </>
            ) : (
              <select
                value={schoolName}
                onChange={(e) => {
                  if (e.target.value === '__manual__') setIsManualSchool(true);
                  else setSchoolName(e.target.value);
                }}
                style={selectStyle}
              >
                <option value="">Select your university...</option>
                {universities.map((u, i) => (
                  <option key={i} value={u.name}>{u.name}</option>
                ))}
                <option value="__manual__">✏️ My university isn't listed</option>
              </select>
            )}
          </Question>
        );

      case 'lawFirm':
        return (
          <Question heading="Which firm or chambers do you work at?" subtext="Or enter 'Independent' if you're a sole practitioner.">
            <input
              autoFocus
              value={lawFirm}
              onChange={(e) => setLawFirm(e.target.value)}
              placeholder="e.g. Aelex, Aluko & Oyebode, Independent..."
              style={inputStyle}
            />
          </Question>
        );

      case 'location':
        return (
          <Question heading="Where are you practising?" subtext="City or state within your country.">
            <input
              autoFocus
              value={locationInCountry}
              onChange={(e) => setLocationInCountry(e.target.value)}
              placeholder="e.g. Lagos, Abuja, London..."
              style={inputStyle}
            />
          </Question>
        );

      case 'occupation':
        return (
          <Question heading="What do you do?" subtext="Briefly describe your role or area of work.">
            <input
              autoFocus
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder="e.g. Legal Researcher, Academic, Journalist..."
              style={inputStyle}
            />
          </Question>
        );

      case 'welcome':
        return (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚖️</div>
            <h2
              style={{
                fontSize: 'clamp(1.8rem, 5vw, 2.6rem)',
                fontWeight: 800,
                color: '#f0f0f5',
                marginBottom: '1rem',
                lineHeight: 1.2,
              }}
            >
              You're all set,{' '}
              <span style={{ color: '#c9a84c' }}>
                {fullName.split(' ')[0]}
              </span>
              . 🎉
            </h2>
            <p style={{ color: '#6b6b80', fontSize: '1rem', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
              Your AI-powered legal companion is ready.
              <br />
              Welcome to <strong style={{ color: '#c9a84c' }}>Jurist Mind</strong>.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0c',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        fontFamily: "'DM Sans', sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.9rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: '#c9a84c',
          textTransform: 'uppercase',
        }}
      >
        JURIST MIND
      </div>

      {/* Back Arrow */}
      {currentStep > 0 && currentQuestion !== 'welcome' && (
        <button
          onClick={handleBack}
          style={{
            position: 'absolute',
            top: '1.4rem',
            left: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            color: '#6b6b80',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#c9a84c')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6b6b80')}
        >
          <ChevronLeft size={16} />
          Back
        </button>
      )}

      {/* Step Counter */}
      {currentQuestion !== 'welcome' && (
        <div
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#c9a84c',
            backgroundColor: 'rgba(201,168,76,0.1)',
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            border: '1px solid rgba(201,168,76,0.25)',
          }}
        >
          {currentStep + 1} of {totalSteps - 1}
        </div>
      )}

      {/* Sliding Content */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '320px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
            style={{ width: '100%' }}
          >
            {renderQuestion()}

            {/* Continue Button (non-welcome steps) */}
            {currentQuestion !== 'welcome' && (
              <div style={{ marginTop: '2rem' }}>
                <button
                  onClick={handleNext}
                  disabled={!isStepValid()}
                  style={{
                    width: '100%',
                    height: '52px',
                    backgroundColor: isStepValid() ? '#c9a84c' : '#2a2a35',
                    color: isStepValid() ? '#0a0a0c' : '#4a4a5a',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: isStepValid() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    letterSpacing: '0.02em',
                  }}
                >
                  Continue →
                </button>
                <p
                  style={{
                    textAlign: 'center',
                    color: '#3a3a4a',
                    fontSize: '0.75rem',
                    marginTop: '0.75rem',
                  }}
                >
                  Press <kbd style={{ color: '#6b6b80' }}>Enter ↵</kbd> to continue
                </p>
              </div>
            )}

            {/* Enter Jurist Mind (welcome step) */}
            {currentQuestion === 'welcome' && (
              <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  style={{
                    padding: '0.9rem 2.5rem',
                    backgroundColor: '#c9a84c',
                    color: '#0a0a0c',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Setting up your workspace...' : 'Enter Jurist Mind ⚖️'}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
