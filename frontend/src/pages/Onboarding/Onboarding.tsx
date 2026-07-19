import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OptionCard } from "../../components/OptionCards";

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
  const totalSteps = 5;

  // --- Step Content Configuration ---
  const steps: Record<number, StepConfig> = {
    1: {
      stepIndex: 1,
      heading: "What is your investing experience?",
      subtitle: "Tell us about your investing experience so we can personalize your learning journey.",
      options: [
        { id: "beginner", icon: "🌱", title: "Beginner", description: "New to investing." },
        { id: "intermediate", icon: "📊", title: "Intermediate", description: "Have basic investment knowledge." },
        { id: "advanced", icon: "🏆", title: "Advanced", description: "Experienced investor." }
      ]
    },
    2: {
      stepIndex: 2,
      heading: "What is your primary investment goal?",
      subtitle: "This helps our engine highlight market opportunities relevant to your milestones.",
      isFiveGrid: true,
      options: [
        { id: "wealth-growth", icon: "🎯", title: "Wealth Growth", description: "Long-term wealth creation through compounding." },
        { id: "passive-income", icon: "💰", title: "Passive Income", description: "Dividend-focused investing." },
        { id: "learn-investing", icon: "📚", title: "Learn Investing", description: "Understand the market with paper trading." },
        { id: "major-purchase", icon: "🏠", title: "Major Purchase", description: "Saving for a house, vehicle or education." },
        { id: "active-trading", icon: "📈", title: "Active Trading", description: "Short-term trading and market opportunities." }
      ]
    },
    3: {
      stepIndex: 3,
      heading: "How much investment risk are you comfortable taking?",
      subtitle: "This helps us recommend investments that match your comfort level.",
      options: [
        { id: "conservative", icon: "🛡", title: "Conservative", description: "Low volatility parameters, prioritizing capital preservation." },
        { id: "moderate", icon: "⚖", title: "Moderate", description: "A balanced framework blending growth index targets and safety." },
        { id: "aggressive", icon: "🚀", title: "Aggressive", description: "High volatility thresholds capturing dynamic market breakouts." }
      ]
    },
    4: {
      stepIndex: 4,
      heading: "How much do you plan to invest every month?",
      subtitle: "Choose the amount you'd typically invest each month.",
      options: [
        { id: "under-5000", icon: "📉", title: "Less than ₹5,000", description: "Ideal for steady micro-investing rules." },

        { id: "5000-20000", icon: "💵", title: "₹5,000–₹20,000", description: "A structured base for building a core portfolio." },

        { id: "20000-50000", icon: "🏛", title: "₹20,000–₹50,000", description: "Accelerated capital allocation strategy." },

        { id: "50000-plus", icon: "💎", title: "More than ₹50,000", description: "Advanced market exposure and position sizing." }
      ]
    },
    5: {
      stepIndex: 5,
      heading: "What is your investment horizon?",
      subtitle: "This helps us recommend investments suited to your time horizon.",
      options: [
        { id: "lt-1y", icon: "⏳", title: "Less than 1 year", description: "Short-term technical setups and liquidity drills." },
        { id:  "1-3y", icon: "🗓", title: "1–3 years", description: "Medium-term tactical trend and cyclical plays." },
        { id: "3-5y", icon: "📆", title: "3–5 years", description: "Core thematic investment blueprints." },
        { id: "5y-plus", icon: "♾", title: "More than 5 years", description: "Long-term macroeconomic position holding." }
      ]
    }
  };

  const currentStepData = steps[currentStep];
  const selectedOptionId = selections[currentStep] || "";
  const progressPercentage = (currentStep / totalSteps) * 100;

  // --- Navigation Handlers ---
  const handleOptionSelect = (id: string) => {
    setSelections((prev) => ({ ...prev, [currentStep]: id }));
  };

  const handleNext = () => {
    if (!selectedOptionId) return;
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // TODO: Save onboarding data to Supabase
      // TODO: Navigate to Dashboard
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between select-none">
      {/* --- Top Navbar --- */}
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

        {/* Thin Premium Progress Bar */}
        <div className="w-full h-[3px] bg-[#E5E7EB] relative">
          <motion.div
            className="h-full bg-[#0F4C3A]"
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.4, ease: "circOut" }}
          />
        </div>
      </header>

      {/* --- Main Interactivity Layer --- */}
      <main className="flex-grow flex items-center justify-center py-16 px-6">
        <div className="w-full max-w-[900px] mx-auto text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="w-full"
            >
              {/* Question Typography Block */}
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#0B3528] tracking-tight">
                {currentStepData.heading}
              </h1>
              <p className="font-sans text-sm md:text-base text-gray-400 mt-3 max-w-xl mx-auto leading-relaxed">
                {currentStepData.subtitle}
              </p>

              {/* Dynamic Answer Selection Matrices */}
              <div className="mt-12 max-w-3xl mx-auto space-y-4">
                {currentStepData.isFiveGrid ? (
                  <>
                    {/* Rows grouping for Step 2 Asymmetric 3+2 Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {currentStepData.options.slice(0, 3).map((opt) => (
                        <OptionCard
                          key={opt.id}
                          id={opt.id}
                          icon={opt.icon}
                          title={opt.title}
                          description={opt.description}
                          isSelected={selectedOptionId === opt.id}
                          onSelect={handleOptionSelect}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                      {currentStepData.options.slice(3, 5).map((opt) => (
                        <OptionCard
                          key={opt.id}
                          id={opt.id}
                          icon={opt.icon}
                          title={opt.title}
                          description={opt.description}
                          isSelected={selectedOptionId === opt.id}
                          onSelect={handleOptionSelect}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  /* Standard Grid mapping for 3 and 4 option configurations */
                  <div
                    className={`grid grid-cols-1 gap-4 ${
                      currentStepData.options.length === 4 ? "md:grid-cols-2" : "md:grid-cols-3"
                    }`}
                  >
                    {currentStepData.options.map((opt) => (
                      <OptionCard
                        key={opt.id}
                        id={opt.id}
                        icon={opt.icon}
                        title={opt.title}
                        description={opt.description}
                        isSelected={selectedOptionId === opt.id}
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

      {/* --- Action Bar Controls --- */}
      <footer className="border-t border-[#E5E7EB] bg-[#FAFBFD] py-6 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
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

          <button
            type="button"
            onClick={handleNext}
            disabled={!selectedOptionId}
            className={`px-8 py-3 rounded-xl font-sans font-medium text-sm transition-all shadow-sm ${
              selectedOptionId
                ? "bg-[#0F4C3A] text-white hover:bg-[#0B3528] cursor-pointer hover:shadow"
                : "bg-[#E5E7EB] text-gray-400 cursor-not-allowed"
            }`}
          >
            {currentStep === totalSteps ? "Start Exploring →" : "Continue"}
          </button>
        </div>
      </footer>
    </div>
  );
};
