import { Star, MapPin, Mail, Phone, MessageSquare, CheckCircle2, Clock, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface LawyerCardProps {
  lawyer: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    state: string;
    city?: string;
    firm_name?: string;
    firm_logo_url?: string;
    avatar_url?: string;
    brand_accent_color?: string;
    description?: string;
    specialization: string[];
    years_experience: number;
    rating: number;
    total_ratings: number;
    verification_status?: string;
    availability_status?: string;
    slug?: string;
    profile_views?: number;
  };
}

export function LawyerCard({ lawyer }: LawyerCardProps) {
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${
          i < Math.floor(rating)
            ? 'fill-[#d4a843] text-[#d4a843]'
            : 'text-[#333333]'
        }`}
      />
    ));
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'bg-[#22c55e]';
      case 'busy':
        return 'bg-[#d4a843]';
      default:
        return 'bg-[#737373]';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'online':
        return 'Online Now';
      case 'busy':
        return 'Busy';
      default:
        return 'Offline';
    }
  };

  const accentColor = lawyer.brand_accent_color || '#d4a843';

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-[#262626] bg-[#111111] hover:bg-[#1a1a1a] hover:border-[#333333] hover:-translate-y-1 transition-all duration-300 cursor-pointer"
      onClick={() => navigate(`/lawyers/${lawyer.slug || lawyer.id}`)}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ backgroundColor: accentColor }}
      />

      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative">
            {lawyer.avatar_url ? (
              <img
                src={lawyer.avatar_url}
                alt={lawyer.name}
                className="w-16 h-16 rounded-2xl object-cover border border-[#262626] bg-[#1a1a1a]"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-black text-lg font-semibold border border-[#262626]"
                style={{ backgroundColor: accentColor }}
              >
                {getInitials(lawyer.name)}
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#111111] ${getStatusColor(lawyer.availability_status)} ${lawyer.availability_status === 'online' ? 'animate-pulse-subtle' : ''}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white truncate tracking-tight">{lawyer.name}</h3>
              {lawyer.verification_status === 'verified' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20">
                  <CheckCircle2 className="w-3 h-3 text-[#22c55e]" />
                  <span className="text-[10px] font-semibold text-[#22c55e] uppercase tracking-wider">Verified</span>
                </div>
              )}
            </div>

            {lawyer.firm_name && (
              <p className="text-sm text-[#a3a3a3] truncate mb-1">{lawyer.firm_name}</p>
            )}

            <div className="flex items-center gap-1.5 text-xs text-[#737373]">
              <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor(lawyer.availability_status)}`} />
              <span>{getStatusText(lawyer.availability_status)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-0.5">{renderStars(lawyer.rating)}</div>
          <span className="text-sm font-semibold text-white">{lawyer.rating.toFixed(1)}</span>
          <span className="text-xs text-[#737373]">({lawyer.total_ratings} reviews)</span>
        </div>

        {lawyer.description && (
          <p className="text-sm text-[#a3a3a3] line-clamp-2 mb-3 leading-relaxed">
            {lawyer.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-[#a3a3a3] mb-4">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#737373]" />
            <span>{lawyer.city ? `${lawyer.city}, ${lawyer.state}` : lawyer.state}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#737373]" />
            <span>{lawyer.years_experience} years</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {lawyer.specialization.slice(0, 3).map((spec, index) => (
            <span
              key={index}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-[#1a1a1a] text-[#a3a3a3] border border-[#262626]"
            >
              {spec}
            </span>
          ))}
          {lawyer.specialization.length > 3 && (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-[#1a1a1a] text-[#737373] border border-[#262626]">
              +{lawyer.specialization.length - 3}
            </span>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t border-[#262626]">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-10 rounded-xl bg-transparent border-[#262626] text-white hover:bg-[#1a1a1a] hover:border-[#d4a843] hover:text-[#d4a843] text-xs active:scale-[0.97]"
            onClick={(e) => {
              e.stopPropagation();
              if (lawyer.email) {
                window.location.href = `mailto:${lawyer.email}`;
              }
            }}
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            Message
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-10 rounded-xl bg-transparent border-[#262626] text-white hover:bg-[#1a1a1a] hover:border-[#d4a843] hover:text-[#d4a843] text-xs active:scale-[0.97]"
            onClick={(e) => {
              e.stopPropagation();
              if (lawyer.phone) {
                window.location.href = `tel:${lawyer.phone}`;
              } else {
                toast.error('No phone number available');
              }
            }}
          >
            <Phone className="w-3.5 h-3.5 mr-1.5" />
            Call
          </Button>
        </div>
      </div>
    </div>
  );
}
