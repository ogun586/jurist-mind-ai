import { Clock, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function PendingApproval() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#111111] p-10 md:p-12 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#d4a843]/10 border border-[#d4a843]/30 flex items-center justify-center mb-6">
          <Clock className="w-7 h-7 text-[#d4a843]" />
        </div>
        <p className="text-[11px] uppercase tracking-widest text-[#737373] mb-2">JURISTMIND</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight mb-3">
          Application Submitted
        </h1>
        <p className="text-[#a3a3a3] text-sm leading-relaxed mb-8">
          Your profile is under review by our verification team. You will receive
          an email once your credentials have been approved.
        </p>
        <div className="rounded-xl border border-[#262626] bg-[#161616] p-4 mb-8 flex items-start gap-3 text-left">
          <Mail className="w-4 h-4 text-[#d4a843] mt-0.5 shrink-0" />
          <p className="text-xs text-[#a3a3a3] leading-relaxed">
            Reviews typically take 24–48 hours. Keep an eye on your inbox for
            updates from our team.
          </p>
        </div>
        <Button
          onClick={() => navigate('/')}
          className="w-full rounded-xl h-12 bg-[#d4a843] text-black hover:bg-[#e8c566] font-semibold active:scale-[0.97]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Return to Home
        </Button>
      </div>
    </div>
  );
}