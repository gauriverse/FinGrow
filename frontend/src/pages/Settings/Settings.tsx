import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUser,
  FiShield,
  FiTarget,
  FiBell,
  FiMoon,
  FiLogOut,
  FiTrash2,
  FiSave,
  FiCheck,
  FiAlertCircle,
  FiChevronRight,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import { supabase } from "../../lib/supabase";

type SettingsSection =
  | "profile"
  | "investment"
  | "security"
  | "notifications"
  | "appearance";

interface ProfileData {
  full_name: string;
  age: string;
  occupation: string;
  monthly_income: string;
  investment_goal: string;
  risk_level: string;
  investment_experience: string;
  investment_horizon: string;
}

const initialProfile: ProfileData = {
  full_name: "",
  age: "",
  occupation: "",
  monthly_income: "",
  investment_goal: "",
  risk_level: "",
  investment_experience: "",
  investment_horizon: "",
};

const occupationOptions = [
  { value: "student", label: "Student" },
  { value: "salaried", label: "Salaried Employee" },
  { value: "self-employed", label: "Self Employed" },
  { value: "business-owner", label: "Business Owner" },
  { value: "freelancer", label: "Freelancer" },
  { value: "homemaker", label: "Homemaker" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

const experienceOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "some-experience", label: "Some Experience" },
  { value: "experienced", label: "Experienced" },
  { value: "advanced", label: "Advanced" },
];

const goalOptions = [
  { value: "wealth-growth", label: "Wealth Growth" },
  { value: "retirement", label: "Retirement" },
  { value: "short-term", label: "Short-Term Goal" },
  { value: "wealth-preservation", label: "Wealth Preservation" },
  { value: "regular-income", label: "Regular Income" },
];

const riskOptions = [
  { value: "conservative", label: "Conservative" },
  { value: "moderate", label: "Moderate" },
  { value: "aggressive", label: "Aggressive" },
  { value: "very-aggressive", label: "Very Aggressive" },
];

const horizonOptions = [
  { value: "lt-1y", label: "Less than 1 year" },
  { value: "1-3y", label: "1–3 years" },
  { value: "3-5y", label: "3–5 years" },
  { value: "5-10y", label: "5–10 years" },
  { value: "10y-plus", label: "10+ years" },
];

// UI only: lightweight keyframes, all disabled for reduced-motion users.
const MOTION_CSS = `
@keyframes fg-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes fg-rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.fg-fade-in { animation: fg-fade-in .15s ease-out both }
.fg-rise { animation: fg-rise .2s ease-out both }
@media (prefers-reduced-motion: reduce) {
  .fg-fade-in, .fg-rise { animation: none }
}
`;

export default function Settings() {
  const navigate = useNavigate();

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("profile");

  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [originalProfile, setOriginalProfile] =
    useState<ProfileData>(initialProfile);

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [marketAlerts, setMarketAlerts] = useState(true);
  const [aiRecommendations, setAiRecommendations] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const hasUnsavedChanges =
    JSON.stringify(profile) !== JSON.stringify(originalProfile);

  // =========================================================
  // LOAD USER + PROFILE
  // =========================================================

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        navigate("/login", { replace: true });
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? "");

      const metadataName =
        user.user_metadata?.full_name || user.user_metadata?.name || "";

      setAvatarUrl(
        user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      );

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select(
          `
          full_name,
          age,
          occupation,
          monthly_income,
          investment_goal,
          risk_level,
          investment_experience,
          investment_horizon
        `,
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Failed to load profile:", profileError);
        setError("Unable to load your profile. Please try again.");
        setLoading(false);
        return;
      }

      if (data) {
        const loadedProfile: ProfileData = {
          full_name: data?.full_name || metadataName,
          age: data?.age?.toString() ?? "",
          occupation: data?.occupation ?? "",
          monthly_income: data?.monthly_income?.toString() ?? "",
          investment_goal: data?.investment_goal ?? "",
          risk_level: data?.risk_level ?? "",
          investment_experience: data?.investment_experience ?? "",
          investment_horizon: data?.investment_horizon ?? "",
        };

        setProfile(loadedProfile);
        setOriginalProfile(loadedProfile);
      }

      setLoading(false);
    };

    loadSettings();
  }, [navigate]);

  // =========================================================
  // HELPERS
  // =========================================================

  const updateProfile = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));

    setMessage(null);
    setError(null);
  };

  const getInitials = () => {
    const name = profile.full_name.trim();

    if (!name) return "U";

    const parts = name.split(/\s+/);

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };

  const showMessage = (text: string) => {
    setMessage(text);

    window.setTimeout(() => {
      setMessage(null);
    }, 3500);
  };

  // =========================================================
  // SAVE PROFILE
  // =========================================================

  const handleSaveProfile = async () => {
    setMessage(null);
    setError(null);

    const age = Number(profile.age);
    const monthlyIncome = Number(profile.monthly_income);

    if (!profile.full_name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!profile.age || !Number.isInteger(age) || age < 18 || age > 100) {
      setError("Age must be between 18 and 100.");
      return;
    }

    if (
      !profile.monthly_income ||
      Number.isNaN(monthlyIncome) ||
      monthlyIncome < 0
    ) {
      setError("Please enter a valid monthly income.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name.trim(),
        age,
        occupation: profile.occupation,
        monthly_income: monthlyIncome,
        investment_goal: profile.investment_goal,
        risk_level: profile.risk_level,
        investment_experience: profile.investment_experience,
        investment_horizon: profile.investment_horizon,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Profile update failed:", updateError);
      setError("We couldn't save your changes. Please try again.");
      setSaving(false);
      return;
    }

    setOriginalProfile(profile);
    setSaving(false);
    showMessage("Your profile has been updated successfully.");
  };

  // =========================================================
  // PASSWORD
  // =========================================================

  const handlePasswordUpdate = async () => {
    setMessage(null);
    setError(null);

    if (newPassword.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);

    const { error: passwordError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (passwordError) {
      console.error("Password update failed:", passwordError);
      setError(passwordError.message);
      setPasswordSaving(false);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaving(false);

    showMessage("Your password has been updated successfully.");
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      setError("Unable to sign out. Please try again.");
      return;
    }

    navigate("/login", { replace: true });
  };

  // =========================================================
  // DELETE ACCOUNT
  // =========================================================

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete your FinGrow account? This action cannot be undone.",
    );

    if (!confirmed) return;

    setError(
      "Account deletion requires server-side account management. Please contact support.",
    );
  };

  // =========================================================
  // NAVIGATION
  // =========================================================

  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section);
    setMessage(null);
    setError(null);
  };

  // =========================================================
  // LOADING STATE
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F5] font-sans">
        <style>{MOTION_CSS}</style>

        <div className="h-14 border-b border-slate-200 bg-white" />

        <main
          className="mx-auto max-w-7xl px-4 py-5 md:px-6"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading your settings...</span>

          <div className="h-3 w-16 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
          <div className="mt-2 h-7 w-32 animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />
          <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-gray-200 motion-reduce:animate-none" />

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr]">
            <div className="h-12 animate-pulse rounded-xl border border-slate-200 bg-white motion-reduce:animate-none lg:h-64" />

            <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 motion-reduce:animate-none">
              <div className="h-5 w-32 rounded bg-gray-200" />
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div key={item}>
                    <div className="h-3 w-20 rounded bg-gray-200" />
                    <div className="mt-2 h-9 rounded-lg bg-gray-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans text-slate-800">
      <style>{MOTION_CSS}</style>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2"
          aria-label="Go to dashboard"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded bg-[#0F4C3A] font-serif text-base font-bold text-white">
            F
          </div>

          <span className="font-serif text-lg font-bold tracking-tight text-[#0F4C3A]">
            FinGrow
          </span>
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-semibold text-slate-800">
              {profile.full_name || "User"}
            </p>
            <p className="text-xs text-slate-400">{email}</p>
          </div>

          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-xs font-bold text-[#0F4C3A]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile.full_name || "Profile"}
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials()
            )}
          </div>
        </div>
      </header>

      {/* =====================================================
          PAGE
      ===================================================== */}

      <main className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
            Account
          </p>

          <h1 className="mt-0.5 font-serif text-2xl font-semibold text-[#0B3528]">
            Settings
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage your FinGrow account and investment preferences.
          </p>
        </div>

        {/* =====================================================
            NOTIFICATIONS
        ===================================================== */}

        {message && (
          <div
            role="status"
            className="fg-fade-in mb-4 flex items-center gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700"
          >
            <FiCheck className="shrink-0" />
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="fg-fade-in mb-4 flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600"
          >
            <FiAlertCircle className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[210px_1fr]">
          {/* =====================================================
              SETTINGS NAVIGATION
          ===================================================== */}

          <aside
            aria-label="Settings sections"
            className="flex h-fit gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 lg:sticky lg:top-[4.5rem] lg:block lg:overflow-visible"
          >
            <SettingsNavItem
              icon={<FiUser />}
              label="Profile"
              active={activeSection === "profile"}
              onClick={() => handleSectionChange("profile")}
            />

            <SettingsNavItem
              icon={<FiTarget />}
              label="Investment Profile"
              active={activeSection === "investment"}
              onClick={() => handleSectionChange("investment")}
            />

            <SettingsNavItem
              icon={<FiShield />}
              label="Security"
              active={activeSection === "security"}
              onClick={() => handleSectionChange("security")}
            />

            <div className="my-2 hidden border-t border-slate-100 lg:block" />

            <p className="hidden px-3 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 lg:block">
              Preferences
            </p>

            <SettingsNavItem
              icon={<FiBell />}
              label="Notifications"
              active={activeSection === "notifications"}
              onClick={() => handleSectionChange("notifications")}
            />

            <SettingsNavItem
              icon={<FiMoon />}
              label="Appearance"
              active={activeSection === "appearance"}
              onClick={() => handleSectionChange("appearance")}
            />

            <div className="my-2 hidden border-t border-slate-100 lg:block" />

            <button
              onClick={handleLogout}
              className="flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 active:scale-[0.98] motion-reduce:transform-none lg:w-full"
            >
              <FiLogOut size={16} />
              Sign out
            </button>
          </aside>

          {/* =====================================================
              CONTENT
          ===================================================== */}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {/* PROFILE */}
            {activeSection === "profile" && (
              <div className="fg-fade-in">
                <SectionHeader
                  title="Profile"
                  description="Update your personal information."
                />

                <div className="p-4 md:p-6">
                  {/* Avatar */}
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-lg font-bold text-[#0F4C3A]">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={profile.full_name || "Profile"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials()
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {profile.full_name || "Your profile"}
                      </h3>

                      <p className="mt-0.5 text-xs text-slate-400">
                        Your FinGrow account
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <InputField
                      label="Full Name"
                      value={profile.full_name}
                      onChange={(value) => updateProfile("full_name", value)}
                      placeholder="Your full name"
                    />

                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Email
                      </span>

                      <input
                        value={email}
                        disabled
                        className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
                      />

                      <span className="mt-1.5 block text-[11px] text-slate-400">
                        Email is managed by your authentication provider.
                      </span>
                    </label>

                    <InputField
                      label="Age"
                      type="number"
                      min="18"
                      max="100"
                      value={profile.age}
                      onChange={(value) => updateProfile("age", value)}
                      placeholder="Enter your age"
                    />

                    <SelectField
                      label="Occupation"
                      value={profile.occupation}
                      onChange={(value) => updateProfile("occupation", value)}
                      options={occupationOptions}
                      placeholder="Select occupation"
                    />

                    <InputField
                      label="Monthly Income"
                      type="number"
                      min="0"
                      value={profile.monthly_income}
                      onChange={(value) =>
                        updateProfile("monthly_income", value)
                      }
                      placeholder="Enter monthly income"
                      prefix="₹"
                    />
                  </div>

                  <SaveBar
                    disabled={!hasUnsavedChanges}
                    loading={saving}
                    onSave={handleSaveProfile}
                  />
                </div>
              </div>
            )}

            {/* INVESTMENT */}
            {activeSection === "investment" && (
              <div className="fg-fade-in">
                <SectionHeader
                  title="Investment Profile"
                  description="These preferences help FinGrow personalize your investment guidance."
                />

                <div className="space-y-4 p-4 md:p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <SelectField
                      label="Investment Goal"
                      value={profile.investment_goal}
                      onChange={(value) =>
                        updateProfile("investment_goal", value)
                      }
                      options={goalOptions}
                      placeholder="Select your goal"
                    />

                    <SelectField
                      label="Risk Level"
                      value={profile.risk_level}
                      onChange={(value) => updateProfile("risk_level", value)}
                      options={riskOptions}
                      placeholder="Select your risk level"
                    />

                    <SelectField
                      label="Investment Experience"
                      value={profile.investment_experience}
                      onChange={(value) =>
                        updateProfile("investment_experience", value)
                      }
                      options={experienceOptions}
                      placeholder="Select your experience"
                    />

                    <SelectField
                      label="Investment Horizon"
                      value={profile.investment_horizon}
                      onChange={(value) =>
                        updateProfile("investment_horizon", value)
                      }
                      options={horizonOptions}
                      placeholder="Select your horizon"
                    />
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-[#F7F8F5] px-3.5 py-3">
                    <div className="flex gap-3">
                      <FiTarget className="mt-0.5 shrink-0 text-[#0F4C3A]" />

                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Your profile powers personalization
                        </p>

                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                          FinGrow uses your investment goal, risk level,
                          experience and horizon to make its guidance more
                          relevant to you.
                        </p>
                      </div>
                    </div>
                  </div>

                  <SaveBar
                    disabled={!hasUnsavedChanges}
                    loading={saving}
                    onSave={handleSaveProfile}
                  />
                </div>
              </div>
            )}

            {/* SECURITY */}
            {activeSection === "security" && (
              <div className="fg-fade-in">
                <SectionHeader
                  title="Security"
                  description="Keep your FinGrow account secure."
                />

                <div className="p-4 md:p-6">
                  <div className="max-w-2xl">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Change password
                    </h3>

                    <p className="mb-4 mt-0.5 text-xs text-slate-400">
                      Choose a strong password that you don't use elsewhere.
                    </p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <PasswordField
                        label="New Password"
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="Enter new password"
                      />

                      <PasswordField
                        label="Confirm Password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="Confirm new password"
                      />
                    </div>

                    <button
                      onClick={handlePasswordUpdate}
                      disabled={
                        passwordSaving || !newPassword || !confirmPassword
                      }
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0F4C3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B3528] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
                    >
                      {passwordSaving ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
                      ) : (
                        <FiShield size={15} />
                      )}
                      {passwordSaving ? "Updating..." : "Update Password"}
                    </button>
                  </div>

                  <div className="my-5 border-t border-slate-100" />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Sign out
                      </h3>

                      <p className="mt-0.5 text-xs text-slate-400">
                        Sign out of your FinGrow account on this device.
                      </p>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] motion-reduce:transform-none"
                    >
                      <FiLogOut size={15} />
                      Sign out
                    </button>
                  </div>

                  <div className="my-5 border-t border-red-100" />

                  <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
                    <div className="flex gap-3">
                      <FiTrash2 className="mt-0.5 shrink-0 text-red-500" />

                      <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 max-w-md">
                          <h3 className="text-sm font-semibold text-red-700">
                            Delete account
                          </h3>

                          <p className="mt-0.5 text-xs leading-relaxed text-red-600/70">
                            Permanently delete your FinGrow account and
                            associated data. This action cannot be undone.
                          </p>
                        </div>

                        <button
                          onClick={handleDeleteAccount}
                          className="rounded-lg border border-red-200 px-3.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 active:scale-[0.98] motion-reduce:transform-none"
                        >
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS */}
            {activeSection === "notifications" && (
              <div className="fg-fade-in">
                <SectionHeader
                  title="Notifications"
                  description="Choose what updates you'd like to receive."
                />

                <div className="p-4 md:p-6">
                  <PreferenceRow
                    title="Email notifications"
                    description="Receive important account and platform updates."
                    enabled={emailNotifications}
                    onToggle={() => setEmailNotifications((prev) => !prev)}
                  />

                  <PreferenceRow
                    title="Market alerts"
                    description="Get notified about important market movements."
                    enabled={marketAlerts}
                    onToggle={() => setMarketAlerts((prev) => !prev)}
                  />

                  <PreferenceRow
                    title="AI recommendations"
                    description="Receive updates when new AI-powered picks are available."
                    enabled={aiRecommendations}
                    onToggle={() => setAiRecommendations((prev) => !prev)}
                  />

                  <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-3 text-xs text-slate-400">
                    Notification preferences are currently stored locally in
                    this interface. Persistent notification settings can be
                    connected to Supabase when the notification system is
                    implemented.
                  </div>
                </div>
              </div>
            )}

            {/* APPEARANCE */}
            {activeSection === "appearance" && (
              <div className="fg-fade-in">
                <SectionHeader
                  title="Appearance"
                  description="Customize how FinGrow looks on your device."
                />

                <div className="p-4 md:p-6">
                  <PreferenceRow
                    title="Dark mode"
                    description="Use a darker interface that's easier on the eyes in low-light environments."
                    enabled={darkMode}
                    onToggle={() => setDarkMode((prev) => !prev)}
                  />

                  {darkMode && (
                    <div className="fg-fade-in mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
                      Dark mode preference is currently a UI preview. A full
                      application-wide theme can be connected once FinGrow has a
                      global theme provider.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// =============================================================
// REUSABLE COMPONENTS
// =============================================================

function SettingsNavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition active:scale-[0.98] motion-reduce:transform-none lg:w-full ${
        active
          ? "bg-[#0F4C3A] text-white"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>

      {active && <FiChevronRight size={14} className="hidden lg:block" />}
    </button>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-100 px-4 py-4 md:px-6">
      <h2 className="font-serif text-lg font-semibold text-slate-900">
        {title}
      </h2>

      <p className="mt-0.5 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  max?: string;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>

      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            {prefix}
          </span>
        )}

        <input
          type={type}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10 ${
            prefix ? "pl-7" : ""
          }`}
        />
      </div>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10"
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  // UI only: local show/hide toggle, does not touch the password value.
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>

      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10"
        />

        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          {visible ? <FiEyeOff size={15} /> : <FiEye size={15} />}
        </button>
      </div>
    </label>
  );
}

function SaveBar({
  disabled,
  loading,
  onSave,
}: {
  disabled: boolean;
  loading: boolean;
  onSave: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <p className="flex items-center gap-2 text-xs text-slate-400">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${
            disabled ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
        {disabled ? "All changes are saved." : "You have unsaved changes."}
      </p>

      <button
        onClick={onSave}
        disabled={disabled || loading}
        className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C3A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0B3528] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none"
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
            Saving...
          </>
        ) : (
          <>
            <FiSave size={15} />
            Save Changes
          </>
        )}
      </button>
    </div>
  );
}

function PreferenceRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-slate-100 py-3.5 last:border-b-0">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>

        <p className="mt-0.5 max-w-xl text-xs text-slate-400">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        aria-label={`${title}: ${enabled ? "on" : "off"}`}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 motion-reduce:transition-none ${
          enabled ? "bg-[#0F4C3A]" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}