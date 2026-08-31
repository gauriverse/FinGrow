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
      <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#0F4C3A]/20 border-t-[#0F4C3A] rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-slate-500">
            Loading your settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] font-sans text-slate-800">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-10">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
            F
          </div>

          <span className="font-bold text-xl tracking-tight font-serif text-[#0F4C3A]">
            FinGrow
          </span>
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-slate-800">
              {profile.full_name || "User"}
            </p>
            <p className="text-xs text-slate-400">{email}</p>
          </div>

          <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#0F4C3A]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profile.full_name || "Profile"}
                className="w-full h-full object-cover"
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

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8">
        <div className="mb-8">
          <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-slate-400">
            Account
          </p>

          <h1 className="font-serif text-3xl md:text-4xl font-semibold text-[#0B3528] mt-1">
            Settings
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            Manage your FinGrow account and investment preferences.
          </p>
        </div>

        {/* =====================================================
            NOTIFICATIONS
        ===================================================== */}

        {message && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <FiCheck />
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            <FiAlertCircle className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* =====================================================
              SETTINGS NAVIGATION
          ===================================================== */}

          <aside className="bg-white border border-slate-200 rounded-2xl p-3 h-fit">
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

            <div className="my-3 border-t border-slate-100" />

            <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
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

            <div className="my-3 border-t border-slate-100" />

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
            >
              <FiLogOut size={17} />
              Sign out
            </button>
          </aside>

          {/* =====================================================
              CONTENT
          ===================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            {/* PROFILE */}
            {activeSection === "profile" && (
              <div>
                <SectionHeader
                  title="Profile"
                  description="Update your personal information."
                />

                <div className="p-6 md:p-8">
                  {/* Avatar */}
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center text-xl font-bold text-[#0F4C3A]">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={profile.full_name || "Profile"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials()
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {profile.full_name || "Your profile"}
                      </h3>

                      <p className="text-xs text-slate-400 mt-1">
                        Your FinGrow account
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <InputField
                      label="Full Name"
                      value={profile.full_name}
                      onChange={(value) => updateProfile("full_name", value)}
                      placeholder="Your full name"
                    />

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                        Email
                      </label>

                      <input
                        value={email}
                        disabled
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400 cursor-not-allowed"
                      />

                      <p className="text-[11px] text-slate-400 mt-2">
                        Email is managed by your authentication provider.
                      </p>
                    </div>

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
              <div>
                <SectionHeader
                  title="Investment Profile"
                  description="These preferences help FinGrow personalize your investment guidance."
                />

                <div className="p-6 md:p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                  <div className="rounded-xl bg-[#F7F8F5] border border-slate-100 p-4">
                    <div className="flex gap-3">
                      <FiTarget className="text-[#0F4C3A] mt-0.5 shrink-0" />

                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Your profile powers personalization
                        </p>

                        <p className="text-xs text-slate-500 leading-relaxed mt-1">
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
              <div>
                <SectionHeader
                  title="Security"
                  description="Keep your FinGrow account secure."
                />

                <div className="p-6 md:p-8">
                  <div className="max-w-xl">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Change password
                    </h3>

                    <p className="text-xs text-slate-400 mt-1 mb-5">
                      Choose a strong password that you don't use elsewhere.
                    </p>

                    <div className="space-y-4">
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
                      className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F4C3A] text-white text-sm font-semibold hover:bg-[#0B3528] disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <FiShield size={15} />
                      {passwordSaving ? "Updating..." : "Update Password"}
                    </button>
                  </div>

                  <div className="border-t border-slate-100 my-8" />

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Sign out
                    </h3>

                    <p className="text-xs text-slate-400 mt-1 mb-4">
                      Sign out of your FinGrow account on this device.
                    </p>

                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <FiLogOut size={15} />
                      Sign out
                    </button>
                  </div>

                  <div className="border-t border-red-100 my-8" />

                  <div className="rounded-xl border border-red-100 bg-red-50/50 p-5">
                    <div className="flex gap-3">
                      <FiTrash2 className="text-red-500 mt-0.5 shrink-0" />

                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-red-700">
                          Delete account
                        </h3>

                        <p className="text-xs text-red-600/70 mt-1 leading-relaxed">
                          Permanently delete your FinGrow account and associated
                          data. This action cannot be undone.
                        </p>

                        <button
                          onClick={handleDeleteAccount}
                          className="mt-4 px-4 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
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
              <div>
                <SectionHeader
                  title="Notifications"
                  description="Choose what updates you'd like to receive."
                />

                <div className="p-6 md:p-8">
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

                  <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-400">
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
              <div>
                <SectionHeader
                  title="Appearance"
                  description="Customize how FinGrow looks on your device."
                />

                <div className="p-6 md:p-8">
                  <PreferenceRow
                    title="Dark mode"
                    description="Use a darker interface that's easier on the eyes in low-light environments."
                    enabled={darkMode}
                    onToggle={() => setDarkMode((prev) => !prev)}
                  />

                  {darkMode && (
                    <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700">
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
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition ${
        active
          ? "bg-[#0F4C3A] text-white"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>

      {active && <FiChevronRight size={14} />}
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
    <div className="px-6 md:px-8 py-6 border-b border-slate-100">
      <h2 className="font-serif text-xl font-semibold text-slate-900">
        {title}
      </h2>

      <p className="text-sm text-slate-400 mt-1">{description}</p>
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
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
        {label}
      </label>

      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
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
          className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none transition focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10 ${
            prefix ? "pl-9" : ""
          }`}
        />
      </div>
    </div>
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
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none transition focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10"
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
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
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
        {label}
      </label>

      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none transition focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10"
      />
    </div>
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
    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
      <p className="text-xs text-slate-400">
        {disabled ? "All changes are saved." : "You have unsaved changes."}
      </p>

      <button
        onClick={onSave}
        disabled={disabled || loading}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F4C3A] text-white text-sm font-semibold hover:bg-[#0B3528] disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
    <div className="flex items-center justify-between gap-6 py-5 border-b border-slate-100 last:border-b-0">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>

        <p className="text-xs text-slate-400 mt-1 max-w-xl">{description}</p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={`${title}: ${enabled ? "on" : "off"}`}
        className={`relative shrink-0 w-11 h-6 rounded-full transition ${
          enabled ? "bg-[#0F4C3A]" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition ${
            enabled ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}
