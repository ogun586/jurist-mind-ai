import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Country {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export function useCountryId() {
  const { profile } = useAuth();
  const [countryId, setCountryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.country) {
      setLoading(false);
      return;
    }

    (supabase.from as any)('countries')
      .select('id')
      .eq('name', profile.country)
      .single()
      .then(({ data }: { data: Country | null }) => {
        setCountryId(data?.id ?? null);
        setLoading(false);
      });
  }, [profile?.country]);

  return { countryId, loading, countryName: profile?.country || '' };
}

export function useAllCountries() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase.from as any)('countries')
      .select('id, name, code, is_active')
      .eq('is_active', true)
      .order('name')
      .then(({ data }: { data: Country[] | null }) => {
        setCountries(data || []);
        setLoading(false);
      });
  }, []);

  return { countries, loading };
}
