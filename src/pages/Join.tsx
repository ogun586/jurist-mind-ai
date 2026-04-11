import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

function detectPlatform(): string {
  const ref = document.referrer.toLowerCase();
  if (ref.includes('whatsapp.com')) return 'whatsapp';
  if (ref.includes('twitter.com') || ref.includes('x.com')) return 'twitter';
  if (ref.includes('linkedin.com')) return 'linkedin';
  if (ref.includes('facebook.com')) return 'facebook';
  if (!ref) return 'direct';
  return 'other';
}

export default function Join() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      const existing = localStorage.getItem('jurist_ref');
      if (!existing) {
        localStorage.setItem('jurist_ref', ref);
      }

      // Track click — fire and forget
      supabase.functions.invoke('track-referral-click', {
        body: {
          referral_code: ref,
          platform: detectPlatform(),
          user_agent: navigator.userAgent,
        },
      }).catch(() => {});
    }

    navigate('/auth', { replace: true });
  }, []);

  return null;
}
