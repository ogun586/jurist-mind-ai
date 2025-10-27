import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Zap, Users, Shield, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  plan_key: string;
  name: string;
  description: string;
  price_ngn: number;
  duration_days: number;
  features: string[];
  daily_request_limit: number | null;
  monthly_points: number | null;
}

interface UserPlan {
  plan_key: string;
  name: string;
  is_active: boolean;
  days_remaining: number;
}

export default function Upgrade() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
    if (user) loadUserPlan();
  }, [user]);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('price_ngn', { ascending: true });

      if (error) throw error;
      
      // Transform data to match our Plan interface
      const transformedPlans = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features as string[] : []
      }));
      
      setPlans(transformedPlans);
    } catch (error) {
      console.error('Error loading plans:', error);
      toast({
        title: "Error",
        description: "Failed to load subscription plans",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserPlan = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.rpc('get_user_plan');
      if (error) throw error;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setUserPlan(data as unknown as UserPlan);
      }
    } catch (error) {
      console.error('Error loading user plan:', error);
    }
  };

  const handleUpgrade = async (planKey: string, priceNgn: number) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upgrade your plan",
        variant: "destructive",
      });
      window.location.href = '/auth';
      return;
    }

    if (planKey === 'free') {
      toast({
        title: "Already on Free Plan",
        description: "You're already using the free plan!",
      });
      return;
    }

    try {
      // Initialize Paystack payment
      const { data, error } = await supabase.functions.invoke('paystack-payment', {
        body: {
          action: 'initialize',
          amount: priceNgn,
          payment_type: planKey,
          callback_url: `${window.location.origin}/upgrade?success=true&plan=${planKey}`
        }
      });

      if (error) throw error;

      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initialize payment",
        variant: "destructive",
      });
    }
  };

  const getPlanIcon = (planKey: string) => {
    switch (planKey) {
      case 'free': return Zap;
      case 'student_monthly': return Users;
      case 'monthly': return Shield;
      case 'yearly': return Shield;
      case 'enterprise': return Crown;
      default: return Zap;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Upgrade Your Plan</h1>
          <p className="text-xl text-muted-foreground">Choose the perfect plan for your legal practice</p>
        </div>

        {userPlan && userPlan.is_active && (
          <div className="mb-8 p-4 bg-primary/10 rounded-lg">
            <p className="text-center">
              <span className="font-semibold">Current Plan: </span>
              {userPlan.name} 
              {userPlan.days_remaining > 0 && (
                <span className="text-muted-foreground ml-2">
                  ({Math.floor(userPlan.days_remaining)} days remaining)
                </span>
              )}
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => {
            const Icon = getPlanIcon(plan.plan_key);
            const isPopular = plan.plan_key === 'monthly';
            const isCurrent = userPlan?.plan_key === plan.plan_key;
            
            return (
              <Card
                key={plan.id}
                className={`p-8 relative ${
                  isPopular
                    ? "border-primary shadow-lg scale-105"
                    : "border-border"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                )}
                
                {isCurrent && (
                  <div className="absolute -top-4 right-4 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Current Plan
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1 mb-2">
                    <span className="text-4xl font-bold">
                      ₦{plan.price_ngn.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      /{plan.duration_days < 100 ? `${plan.duration_days} days` : 'year'}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => handleUpgrade(plan.plan_key, plan.price_ngn)}
                  disabled={isCurrent}
                >
                  {isCurrent ? 'Current Plan' : plan.price_ngn === 0 ? 'Start Free' : 'Upgrade Now'}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Why Choose JURIST MIND?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure & Compliant</h3>
              <p className="text-muted-foreground">Bank-level security with full compliance to legal industry standards</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI-Powered</h3>
              <p className="text-muted-foreground">Advanced AI technology specifically trained for legal professionals</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Expert Support</h3>
              <p className="text-muted-foreground">Dedicated support from legal technology experts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
