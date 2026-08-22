import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { OptionCard } from "../../components/OptionCards";
import { supabase } from "../../lib/supabase";

// --- TypeScript Interfaces ---
interface OnboardingOption {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface StepConfig {
  stepIndex: number;
  heading: string;
  subtitle: string;
  options: OnboardingOption[];
  isFiveGrid?: boolean;
}

export const Onboarding: React.FC = () => {
  // --- State Management ---
  const [currentStep, setCurrentStep] = useState<number>(1);

  const [selections, setSelections] = useState<Record<number, string>>({});

  const [age, setAge] = useState<string>("");
  const [monthlyIncome, setMonthlyIncome] = useState<string>("");
  const [startingCapital, setStartingCapital] = useState<string>("");

  const totalSteps = 8;

  const navigate = useNavigate();

  // --- Step Content Configuration ---
  const steps: Record<number, StepConfig> = {
    // --------------------------------------------------
    // STEP 1 - AGE
    // --------------------------------------------------
    1: {
      stepIndex: 1,
      heading: "What is your age?",
      subtitle: "",
      
      options: [],
    },

    // --------------------------------------------------
    // STEP 2 - OCCUPATION
    // --------------------------------------------------
    2: {
      stepIndex: 2,
      heading: "What is your occupation?",
      subtitle:"",
      options: [
        {
          id: "student",
          icon: "🎓",
          title: "Student",
          description: "Currently studying.",
        },
        {
          id: "salaried",
          icon: "💼",
          title: "Salaried Employee",
          description: "Work for an organization or company.",
        },
        {
          id: "self-employed",
          icon: "🧑‍💻",
          title: "Self Employed",
          description: "Work independently or provide professional services.",
        },
        {
          id: "business-owner",
          icon: "🏢",
          title: "Business Owner",
          description: "Own or operate a business.",
        },
        {
          id: "freelancer",
          icon: "🌐",
          title: "Freelancer",
          description: "Work independently on projects or contracts.",
        },
        {
          id: "homemaker",
          icon: "🏠",
          title: "Homemaker",
          description: "Manage household responsibilities.",
        },
        {
          id: "retired",
          icon: "🌿",
          title: "Retired",
          description: "No longer working full-time.",
        },
        {
          id: "other",
          icon: "👤",
          title: "Other",
          description: "Another occupation.",
        },
      ],
    },

    // --------------------------------------------------
    // STEP 3 - MONTHLY INCOME
    // --------------------------------------------------
    3: {
      stepIndex: 3,
      heading: "What is your monthly income?",
      subtitle:"",
      options: [],
    },

    // --------------------------------------------------
    // STEP 4 - INVESTMENT EXPERIENCE
    // --------------------------------------------------
    4: {
      stepIndex: 4,
      heading: "What is your investing experience?",
      subtitle:
        "Tell us about your investing experience so we can personalize your journey.",
      options: [
        {
          id: "beginner",
          icon: "🌱",
          title: "Beginner",
          description: "New to investing.",
        },
        {
          id: "some-experience",
          icon: "📊",
          title: "Some Experience",
          description: "Have invested a little before.",
        },
        {
          id: "experienced",
          icon: "📈",
          title: "Experienced",
          description: "Regularly invest in financial markets.",
        },
        {
          id: "advanced",
          icon: "🏆",
          title: "Advanced",
          description: "Have significant investing experience.",
        },
      ],
    },

    // --------------------------------------------------
    // STEP 5 - INVESTMENT GOAL
    // --------------------------------------------------
    5: {
      stepIndex: 5,
      heading: "What is your primary investment goal?",
      subtitle:
        "This helps our engine recommend opportunities relevant to your financial goals.",
      isFiveGrid: true,
      options: [
        {
          id: "wealth-growth",
          icon: "🎯",
          title: "Wealth Growth",
          description: "Long-term wealth creation through compounding.",
        },
        {
          id: "retirement",
          icon: "🌅",
          title: "Retirement",
          description: "Build wealth for your future retirement.",
        },
        {
          id: "short-term",
          icon: "⏱️",
          title: "Short-Term Goal",
          description: "Save for an upcoming financial goal.",
        },
        {
          id: "wealth-preservation",
          icon: "🛡️",
          title: "Wealth Preservation",
          description: "Protect your existing wealth and capital.",
        },
        {
          id: "regular-income",
          icon: "💰",
          title: "Regular Income",
          description: "Generate a consistent income from investments.",
        },
      ],
    },

    // --------------------------------------------------
    // STEP 6 - RISK TOLERANCE
    // --------------------------------------------------
    6: {
      stepIndex: 6,
      heading: "How comfortable are you with investment risk?",
      subtitle:
        "Choose the level of investment risk you are comfortable taking.",
      options: [
        {
          id: "conservative",
          icon: "🛡️",
          title: "Conservative",
          description: "Prefer stability and lower risk.",
        },
        {
          id: "moderate",
          icon: "⚖️",
          title: "Moderate",
          description: "Comfortable with some market ups and downs.",
        },
        {
          id: "aggressive",
          icon: "🚀",
          title: "Aggressive",
          description:
            "Willing to accept higher risk for higher potential returns.",
        },
        {
          id: "very-aggressive",
          icon: "🔥",
          title: "Very Aggressive",
          description: "Comfortable with significant market fluctuations.",
        },
      ],
    },

    // --------------------------------------------------
    // STEP 7 - INVESTMENT HORIZON
    // --------------------------------------------------
    7: {
      stepIndex: 7,
      heading: "What is your investment horizon?",
      subtitle: "How long do you plan to keep your investments?",
      options: [
        {
          id: "lt-1y",
          icon: "⏳",
          title: "Less than 1 year",
          description: "Very short-term investment horizon.",
        },
        {
          id: "1-3y",
          icon: "🗓️",
          title: "1–3 years",
          description: "Short to medium-term investing.",
        },
        {
          id: "3-5y",
          icon: "📆",
          title: "3–5 years",
          description: "Medium-term investment horizon.",
        },
        {
          id: "5-10y",
          icon: "📈",
          title: "5–10 years",
          description: "Long-term investment horizon.",
        },
        {
          id: "10y-plus",
          icon: "♾️",
          title: "10+ years",
          description: "Very long-term investing.",
        },
      ],
    },

    // --------------------------------------------------
    // STEP 8 - STARTING PAPER CAPITAL
    // --------------------------------------------------
    8: {
      stepIndex: 8,
      heading: "How much paper capital would you like to start with?",
      subtitle:
        "Enter the virtual amount you want to use for your paper trading portfolio. Minimum ₹500.",
      options: [],
    },
  };

  const currentStepData = steps[currentStep];

  const selectedOptionId = selections[currentStep] || "";

  // --- Validation ---
  const isCurrentStepCompleted =
    currentStep === 1
      ? age.trim() !== "" &&
        Number(age) >= 18 &&
        Number(age) <= 100
      : currentStep === 3
      ? monthlyIncome.trim() !== "" &&
        Number(monthlyIncome) >= 0
      : currentStep === 8
      ? startingCapital.trim() !== "" &&
        Number(startingCapital) >= 500
      : selectedOptionId !== "";

  const progressPercentage = (currentStep / totalSteps) * 100;

  // --- Navigation Handlers ---
  const handleOptionSelect = (id: string) => {
    setSelections((prev) => ({
      ...prev,
      [currentStep]: id,
    }));
  };

  const handleNext = async () => {
    if (!isCurrentStepCompleted) return;

    // Move to next step
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    // Get authenticated user
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      console.error("User not authenticated:", userError);
      return;
    }

    const userId = userData.user.id;

    // Save onboarding data
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,

          // Step 1
          age: Number(age),

          // Step 2
          occupation: selections[2],

          // Step 3
          monthly_income: Number(monthlyIncome),

          // Step 4
          investment_experience: selections[4],

          // Step 5
          investment_goal: selections[5],

          // Step 6
          risk_level: selections[6],

          // Step 7
          investment_horizon: selections[7],

          // Step 8
          starting_paper_capital: Number(startingCapital),

          onboarding_completed: true,
        },
        {
          onConflict: "user_id",
        }
      );

    if (profileError) {
      console.error(
        "Error saving onboarding data:",
        profileError
      );
      return;
    }

    navigate("/personalized");
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between select-none">

      {/* =====================================================
          TOP NAVBAR
      ===================================================== */}
      <header className="w-full bg-white border-b border-[#E5E7EB]">

        <div className="max-w-5xl mx-auto h-20 px-6 flex items-center justify-between">

          <div className="flex items-center gap-2">

            <div className="w-8 h-8 rounded bg-[#0F4C3A] flex items-center justify-center text-white font-bold text-lg font-serif">
              F
            </div>

            <span className="font-bold text-xl tracking-tight font-serif text-[#0F4C3A]">
              FinGrow
            </span>

          </div>

          <div className="font-sans text-xs font-semibold tracking-wider text-gray-400 uppercase">
            Step {currentStep} of {totalSteps}
          </div>

        </div>

        {/* Progress Bar */}
        <div className="w-full h-0.75 bg-[#E5E7EB] relative">

          <motion.div
            className="h-full bg-[#0F4C3A]"
            initial={{ width: "0%" }}
            animate={{
              width: `${progressPercentage}%`,
            }}
            transition={{
              duration: 0.4,
              ease: "circOut",
            }}
          />

        </div>

      </header>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}
      <main className="grow flex items-center justify-center py-16 px-6">

        <div className="w-full max-w-225 mx-auto text-center">

          <AnimatePresence mode="wait">

            <motion.div
              key={currentStep}
              initial={{
                opacity: 0,
                y: 15,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: -15,
              }}
              transition={{
                duration: 0.35,
                ease: "easeOut",
              }}
              className="w-full"
            >

              {/* =====================================================
                  QUESTION HEADING
              ===================================================== */}

              <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#0B3528] tracking-tight">
                {currentStepData.heading}
              </h1>

              <p className="font-sans text-sm md:text-base text-gray-400 mt-3 max-w-xl mx-auto leading-relaxed">
                {currentStepData.subtitle}
              </p>

              {/* =====================================================
                  ANSWER AREA
              ===================================================== */}

              <div className="mt-12 max-w-3xl mx-auto space-y-4">

                {/* =================================================
                    STEP 1 - AGE INPUT
                ================================================= */}

                {currentStep === 1 ? (

                  <div className="max-w-md mx-auto">

                    <input
                      type="number"
                      min="18"
                      max="100"
                      value={age}
                      onChange={(e) => {

                        const value = e.target.value;

                        if (value === "") {
                          setAge("");
                          return;
                        }

                        // Allow maximum 3 digits
                        if (value.length <= 3) {
                          setAge(value);
                        }

                      }}
                      placeholder="Enter your age"
                      className="w-full px-5 py-4 rounded-xl border border-[#E5E7EB] bg-white text-gray-700 text-center text-lg outline-none focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10"
                    />

                    {age !== "" &&
                      (Number(age) < 18 ||
                        Number(age) > 100) && (

                        <p className="text-red-500 text-sm mt-2">
                          Age must be between 18 and 100.
                        </p>

                      )}

                  </div>

                ) : currentStep === 2 ? (

                  /* =================================================
                     STEP 2 - OCCUPATION DROPDOWN
                  ================================================= */

                  <div className="max-w-md mx-auto">

                    <select
                      value={selectedOptionId}
                      onChange={(e) =>
                        handleOptionSelect(e.target.value)
                      }
                      className="w-full px-5 py-4 rounded-xl border border-[#E5E7EB] bg-white text-gray-700 text-center text-lg outline-none focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10"
                    >

                      <option value="">
                        Select your occupation
                      </option>

                      {currentStepData.options.map((opt) => (

                        <option
                          key={opt.id}
                          value={opt.id}
                        >
                          {opt.title}
                        </option>

                      ))}

                    </select>

                  </div>

                ) : currentStep === 3 ? (

                  /* =================================================
                     STEP 3 - MONTHLY INCOME
                  ================================================= */

                  <div className="max-w-md mx-auto">

                    <input
                      type="number"
                      min="0"
                      value={monthlyIncome}
                      onChange={(e) => {

                        const value = e.target.value;

                        if (value === "") {
                          setMonthlyIncome("");
                          return;
                        }

                        if (Number(value) >= 0) {
                          setMonthlyIncome(value);
                        }

                      }}
                      placeholder="Enter your monthly income"
                      className="w-full px-5 py-4 rounded-xl border border-[#E5E7EB] bg-white text-gray-700 text-center text-lg outline-none focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10"
                    />

                  </div>

                ) : currentStep === 8 ? (

                  /* =================================================
                     STEP 8 - STARTING PAPER CAPITAL
                  ================================================= */

                  <div className="max-w-md mx-auto">

                    <input
                      type="number"
                      min="500"
                      value={startingCapital}
                      onChange={(e) => {

                        const value = e.target.value;

                        if (value === "") {
                          setStartingCapital("");
                          return;
                        }

                        if (Number(value) >= 0) {
                          setStartingCapital(value);
                        }

                      }}
                      placeholder="Enter starting paper capital"
                      className="w-full px-5 py-4 rounded-xl border border-[#E5E7EB] bg-white text-gray-700 text-center text-lg outline-none focus:border-[#0F4C3A] focus:ring-2 focus:ring-[#0F4C3A]/10"
                    />

                    {startingCapital !== "" &&
                      Number(startingCapital) < 500 && (

                        <p className="text-red-500 text-sm mt-2">
                          Minimum starting paper capital is ₹500.
                        </p>

                      )}

                  </div>

                ) : currentStepData.isFiveGrid ? (

                  /* =================================================
                     FIVE GRID - INVESTMENT GOAL
                  ================================================= */

                  <>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                      {currentStepData.options
                        .slice(0, 3)
                        .map((opt) => (

                          <OptionCard
                            key={opt.id}
                            id={opt.id}
                            icon={opt.icon}
                            title={opt.title}
                            description={opt.description}
                            isSelected={
                              selectedOptionId === opt.id
                            }
                            onSelect={handleOptionSelect}
                          />

                        ))}

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">

                      {currentStepData.options
                        .slice(3, 5)
                        .map((opt) => (

                          <OptionCard
                            key={opt.id}
                            id={opt.id}
                            icon={opt.icon}
                            title={opt.title}
                            description={opt.description}
                            isSelected={
                              selectedOptionId === opt.id
                            }
                            onSelect={handleOptionSelect}
                          />

                        ))}

                    </div>

                  </>

                ) : (

                  /* =================================================
                     STANDARD OPTION CARDS
                  ================================================= */

                  <div
                    className={`grid grid-cols-1 gap-4 ${
                      currentStepData.options.length === 4
                        ? "md:grid-cols-2"
                        : "md:grid-cols-3"
                    }`}
                  >

                    {currentStepData.options.map((opt) => (

                      <OptionCard
                        key={opt.id}
                        id={opt.id}
                        icon={opt.icon}
                        title={opt.title}
                        description={opt.description}
                        isSelected={
                          selectedOptionId === opt.id
                        }
                        onSelect={handleOptionSelect}
                      />

                    ))}

                  </div>

                )}

              </div>

            </motion.div>

          </AnimatePresence>

        </div>

      </main>

      {/* =====================================================
          FOOTER / NAVIGATION
      ===================================================== */}

      <footer className="border-t border-[#E5E7EB] bg-[#FAFBFD] py-6 px-6">

        <div className="max-w-3xl mx-auto flex items-center justify-between">

          {/* Previous */}
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`px-6 py-3 rounded-xl border font-sans font-medium text-sm transition-all ${
              currentStep === 1
                ? "border-transparent bg-transparent text-gray-300 cursor-not-allowed"
                : "border-[#E5E7EB] bg-white text-gray-600 hover:bg-gray-50 hover:text-[#0B3528] cursor-pointer shadow-sm hover:shadow"
            }`}
          >
            Previous
          </button>

          {/* Continue */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!isCurrentStepCompleted}
            className={`px-8 py-3 rounded-xl font-sans font-medium text-sm transition-all shadow-sm ${
              isCurrentStepCompleted
                ? "bg-[#0F4C3A] text-white hover:bg-[#0B3528] cursor-pointer hover:shadow"
                : "bg-[#E5E7EB] text-gray-400 cursor-not-allowed"
            }`}
          >
            {currentStep === totalSteps
              ? "Start Exploring →"
              : "Continue"}
          </button>

        </div>

      </footer>

    </div>
  );
};