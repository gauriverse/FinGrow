import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const finishAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        setError(error?.message || "Could not verify email. Please try the link again.");
        return;
      }

      navigate("/onboarding");
    };

    finishAuth();
  }, [navigate]);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-red-500 px-6 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center text-sm text-slate-500">
      Verifying your email...
    </div>
  );
}