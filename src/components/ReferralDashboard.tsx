import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link2, Copy, Share2, Users, MousePointerClick, CreditCard, TrendingUp, Wallet, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Citibank Nigeria', code: '023' },
  { name: 'Ecobank Nigeria', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'First City Monument Bank', code: '214' },
  { name: 'Globus Bank', code: '103' },
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Jaiz Bank', code: '301' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Kuda Bank', code: '090267' },
  { name: 'OPay', code: '999992' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Standard Chartered', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'SunTrust Bank', code: '100' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'United Bank for Africa', code: '033' },
  { name: 'Unity Bank', code: '215' },
  { name: 'VFD Microfinance Bank', code: '566' },
  { name: 'Wema Bank', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];

interface Referral {
  id: string;
  referred_id: string;
  status: string;
  months_commissioned: number;
  total_commission_earned: number;
  signed_up_at: string;
  referred_name?: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
  admin_note: string | null;
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
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none' as any,
  cursor: 'pointer',
};

export function ReferralDashboard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [clicks, setClicks] = useState(0);
  const [signups, setSignups] = useState(0);
  const [paid, setPaid] = useState(0);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [bankForm, setBankForm] = useState({ name: '', number: '', bank: '' });

  const referralCode = profile?.referral_code || '';
  const appUrl = import.meta.env.VITE_APP_URL || 'https://chat.juristmind.com';
  const referralLink = referralCode ? `${appUrl}/join?ref=${referralCode}` : '';

  const earningsPending = profile?.referral_earnings_pending || 0;
  const earningsCleared = profile?.referral_earnings_cleared || 0;
  const earningsTotal = profile?.referral_earnings_total || 0;

  const lastWithdrawal = profile?.last_withdrawal_at ? new Date(profile.last_withdrawal_at) : null;
  const canWithdraw = earningsCleared >= 3000 && (!lastWithdrawal || (Date.now() - lastWithdrawal.getTime()) > 30 * 24 * 60 * 60 * 1000);
  const nextWithdrawalDate = lastWithdrawal ? new Date(lastWithdrawal.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const progressTo3k = Math.min(100, (earningsCleared / 3000) * 100);

  useEffect(() => {
    if (user) fetchStats();
  }, [user]);

  async function fetchStats() {
    setLoading(true);
    try {
      // Clicks
      const { count: clickCount } = await supabase
        .from('referral_clicks')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', user!.id);
      setClicks(clickCount || 0);

      // Referrals with referred user names
      const { data: refs } = await supabase
        .from('referrals')
        .select('id, referred_id, status, months_commissioned, total_commission_earned, signed_up_at')
        .eq('referrer_id', user!.id)
        .order('signed_up_at', { ascending: false });

      if (refs && refs.length > 0) {
        const referredIds = refs.map(r => r.referred_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', referredIds);

        const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        const enriched = refs.map(r => ({
          ...r,
          referred_name: nameMap.get(r.referred_id) || 'Unknown',
        }));
        setReferrals(enriched);
        setSignups(refs.length);
        setPaid(refs.filter(r => r.months_commissioned > 0).length);
      }

      // Withdrawals — select only safe columns
      const { data: wds } = await supabase
        .from('withdrawal_requests')
        .select('id, amount, status, created_at, reviewed_at, paid_at, admin_note')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      setWithdrawals(wds || []);
    } catch (e) {
      console.error('Fetch referral stats error:', e);
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(referralLink);
    toast({ title: 'Link copied!', description: 'Share it to start earning.' });
  }

  function shareWhatsApp() {
    const text = `Join me on Jurist Mind — AI-powered legal research. Use my link: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function handleWithdraw() {
    if (!bankForm.name || !bankForm.number || !bankForm.bank) {
      toast({ title: 'Fill all fields', variant: 'destructive' });
      return;
    }
    setWithdrawing(true);
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .insert({
          user_id: user!.id,
          amount: earningsCleared,
          bank_account_name: bankForm.name,
          bank_account_number: bankForm.number,
          bank_name: bankForm.bank,
        });
      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ last_withdrawal_at: new Date().toISOString() })
        .eq('user_id', user!.id);

      toast({ title: 'Withdrawal request submitted', description: 'Admin will review within 1-3 business days.' });
      setShowWithdrawModal(false);
      setBankForm({ name: '', number: '', bank: '' });
      fetchStats();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setWithdrawing(false);
    }
  }

  const conversionRate = clicks > 0 ? ((paid / clicks) * 100).toFixed(1) : '0';
  const conversionNum = parseFloat(conversionRate);
  const conversionMsg =
    conversionNum >= 10 ? 'Top referrer level 🏆' :
    conversionNum >= 5 ? 'Strong performance 🔥' :
    conversionNum >= 2 ? 'Good progress — room to improve' :
    'Getting started — keep sharing!';

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: '#c9a84c' }} />
        <p style={{ color: '#6b6b80', fontSize: '0.8rem', marginTop: '0.5rem' }}>Loading referral data…</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Referral Link ── */}
      <div style={{ backgroundColor: '#111113', borderRadius: '16px', padding: '1.25rem', border: '1px solid #1e1e28' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c9a84c', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Link2 size={15} /> Your Referral Link
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            readOnly
            value={referralLink || 'Generating...'}
            style={{ ...inputStyle, flex: 1, fontSize: '0.8rem', color: '#9a9ab0' }}
          />
          <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.6rem 1rem', backgroundColor: '#c9a84c', color: '#0a0a0c', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
            <Copy size={14} /> Copy
          </button>
          <button onClick={shareWhatsApp} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.6rem 1rem', backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
            <Share2 size={14} /> WhatsApp
          </button>
        </div>
      </div>

      {/* ── Performance Stats ── */}
      <div style={{ backgroundColor: '#111113', borderRadius: '16px', padding: '1.25rem', border: '1px solid #1e1e28' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f0f0f5', marginBottom: '1rem' }}>Your Referral Performance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <MousePointerClick size={20} style={{ color: '#c9a84c', margin: '0 auto 0.3rem' }} />
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0f5' }}>{clicks}</p>
            <p style={{ fontSize: '0.7rem', color: '#6b6b80' }}>Clicks</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Users size={20} style={{ color: '#c9a84c', margin: '0 auto 0.3rem' }} />
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0f5' }}>{signups}</p>
            <p style={{ fontSize: '0.7rem', color: '#6b6b80' }}>Signups</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <CreditCard size={20} style={{ color: '#c9a84c', margin: '0 auto 0.3rem' }} />
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f0f0f5' }}>{paid}</p>
            <p style={{ fontSize: '0.7rem', color: '#6b6b80' }}>Paid</p>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
            <span style={{ color: '#6b6b80' }}>Conversion Rate</span>
            <span style={{ color: '#c9a84c', fontWeight: 600 }}>{conversionRate}%</span>
          </div>
          <div style={{ height: '6px', backgroundColor: '#1e1e28', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, conversionNum * 5)}%`, backgroundColor: '#c9a84c', borderRadius: '4px', transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontSize: '0.7rem', color: '#6b6b80', marginTop: '0.3rem' }}>{conversionMsg}</p>
        </div>
      </div>

      {/* ── Earnings ── */}
      <div style={{ backgroundColor: '#111113', borderRadius: '16px', padding: '1.25rem', border: '1px solid #1e1e28' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f0f0f5', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Wallet size={15} /> Your Earnings
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: '#6b6b80' }}>Pending (48hr hold)</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>₦{earningsPending.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: '#6b6b80' }}>Cleared balance</span>
            <span style={{ color: '#22c55e', fontWeight: 600 }}>₦{earningsCleared.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: '#6b6b80' }}>Total earned all time</span>
            <span style={{ color: '#c9a84c', fontWeight: 700 }}>₦{earningsTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Progress to 3000 */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '0.3rem' }}>
            <span style={{ color: '#6b6b80' }}>Progress to ₦3,000 withdrawal</span>
            <span style={{ color: '#c9a84c' }}>{progressTo3k.toFixed(0)}%</span>
          </div>
          <div style={{ height: '6px', backgroundColor: '#1e1e28', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressTo3k}%`, backgroundColor: earningsCleared >= 3000 ? '#22c55e' : '#c9a84c', borderRadius: '4px', transition: 'width 0.5s' }} />
          </div>
          {earningsCleared < 3000 && (
            <p style={{ fontSize: '0.7rem', color: '#6b6b80', marginTop: '0.2rem' }}>
              Need ₦{(3000 - earningsCleared).toLocaleString()} more
            </p>
          )}
        </div>

        <button
          onClick={() => setShowWithdrawModal(true)}
          disabled={!canWithdraw}
          style={{
            width: '100%',
            padding: '0.7rem',
            backgroundColor: canWithdraw ? '#c9a84c' : '#1e1e28',
            color: canWithdraw ? '#0a0a0c' : '#4a4a5a',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: canWithdraw ? 'pointer' : 'not-allowed',
          }}
        >
          {earningsCleared < 3000
            ? `Need ₦${(3000 - earningsCleared).toLocaleString()} more to withdraw`
            : nextWithdrawalDate && nextWithdrawalDate > new Date()
            ? `Next withdrawal: ${format(nextWithdrawalDate, 'MMM d, yyyy')}`
            : 'Request Withdrawal'}
        </button>
      </div>

      {/* ── Referral List ── */}
      {referrals.length > 0 && (
        <div style={{ backgroundColor: '#111113', borderRadius: '16px', padding: '1.25rem', border: '1px solid #1e1e28' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f0f0f5', marginBottom: '0.75rem' }}>My Referrals</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {referrals.map((r) => (
              <div key={r.id} style={{ padding: '0.75rem', backgroundColor: '#0d0d10', borderRadius: '10px', border: '1px solid #1a1a24' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <Users size={14} style={{ color: '#c9a84c' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f0f5' }}>{r.referred_name}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.7rem', color: '#6b6b80' }}>
                  <span>Signed up: {format(new Date(r.signed_up_at), 'MMM d, yyyy')}</span>
                  <span>
                    Status: {r.months_commissioned > 0
                      ? <span style={{ color: '#22c55e' }}>✅ PAID</span>
                      : <span style={{ color: '#f59e0b' }}>⏳ Not yet subscribed</span>
                    }
                  </span>
                  {r.total_commission_earned > 0 && (
                    <span>Commission: ₦{r.total_commission_earned.toLocaleString()} | Month {r.months_commissioned} of 3</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Withdrawal History ── */}
      {withdrawals.length > 0 && (
        <div style={{ backgroundColor: '#111113', borderRadius: '16px', padding: '1.25rem', border: '1px solid #1e1e28' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f0f0f5', marginBottom: '0.75rem' }}>Withdrawal History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {withdrawals.map((w) => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', backgroundColor: '#0d0d10', borderRadius: '8px', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: '#f0f0f5', fontWeight: 600 }}>₦{w.amount.toLocaleString()}</span>
                  <span style={{ color: '#6b6b80', marginLeft: '0.5rem' }}>{format(new Date(w.created_at), 'MMM d, yyyy')}</span>
                </div>
                <span style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor:
                    w.status === 'paid' ? 'rgba(34,197,94,0.15)' :
                    w.status === 'approved' ? 'rgba(34,197,94,0.1)' :
                    w.status === 'rejected' ? 'rgba(239,68,68,0.15)' :
                    'rgba(245,158,11,0.15)',
                  color:
                    w.status === 'paid' ? '#22c55e' :
                    w.status === 'approved' ? '#22c55e' :
                    w.status === 'rejected' ? '#ef4444' :
                    '#f59e0b',
                }}>
                  {w.status === 'pending_review' ? 'Pending' : w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Withdrawal Modal ── */}
      {showWithdrawModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem',
        }}>
          <div style={{
            backgroundColor: '#111113', borderRadius: '16px', padding: '1.5rem',
            maxWidth: '420px', width: '100%', border: '1px solid #2a2a35',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f0f0f5', marginBottom: '0.3rem' }}>Withdrawal Request</h3>
            <p style={{ fontSize: '0.8rem', color: '#6b6b80', marginBottom: '1.25rem' }}>
              Amount: <strong style={{ color: '#22c55e' }}>₦{earningsCleared.toLocaleString()}</strong> (full cleared balance)
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b6b80', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank Account Name</label>
                <input
                  value={bankForm.name}
                  onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
                  placeholder="Full account name"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b6b80', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank Account Number</label>
                <input
                  value={bankForm.number}
                  onChange={(e) => setBankForm({ ...bankForm, number: e.target.value })}
                  placeholder="0123456789"
                  maxLength={10}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6b6b80', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank Name</label>
                <select
                  value={bankForm.bank}
                  onChange={(e) => setBankForm({ ...bankForm, bank: e.target.value })}
                  style={selectStyle}
                >
                  <option value="">Select bank...</option>
                  {NIGERIAN_BANKS.map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <p style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertCircle size={12} /> Your bank details will be hidden after submission for security.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={() => setShowWithdrawModal(false)}
                style={{ flex: 1, padding: '0.6rem', backgroundColor: '#1e1e28', color: '#9a9ab0', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                style={{ flex: 1, padding: '0.6rem', backgroundColor: '#c9a84c', color: '#0a0a0c', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', opacity: withdrawing ? 0.7 : 1 }}
              >
                {withdrawing ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
