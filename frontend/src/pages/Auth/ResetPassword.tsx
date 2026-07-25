import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Confirm we actually have a recovery session before showing the form
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setError("This reset link is invalid or has expired.");
      } else {
        setReady(true);
      }
    });
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    }
  };

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-red-500 px-6 text-center">
        {error}
      </div>
    );
  }

  if (done) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-emerald-700">
        Password updated. Redirecting to login...
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center px-6">
      <form onSubmit={handleUpdatePassword} className="w-full max-w-sm space-y-4">
        <h1 className="text-lg font-serif font-semibold text-[#0F4C3A]">
          Set a new password
        </h1>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          required
          className="w-full px-4 py-2.5 rounded-lg bg-[#FAFBFD] border border-slate-200 text-sm focus:outline-none"
        />
        <button
          type="submit"
          className="w-full py-3 bg-[#0F4C3A] text-white text-xs font-bold rounded-lg"
        >
          Update password
        </button>
      </form>
    </div>
  );
}