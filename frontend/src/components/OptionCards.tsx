import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OptionCardProps {
  id: string;
  icon: string;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const OptionCard: React.FC<OptionCardProps> = ({
  id,
  icon,
  title,
  description,
  isSelected,
  onSelect,
}) => {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(id)}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      animate={{
        borderColor: isSelected ? '#0F4C3A' : '#E5E7EB',
        backgroundColor: isSelected ? '#F4F9F6' : '#FAFBFD',
      }}
      className={`relative w-full text-left p-6 rounded-xl border bg-[#FAFBFD] shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between min-h-[140px] focus:outline-none`}
    >
      {/* Top row with Icon and Checkmark */}
      <div className="flex justify-between items-start w-full mb-3">
        <span className="text-2xl" role="img" aria-label={title}>
          {icon}
        </span>
        
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0F4C3A]"
            >
              <svg
                className="w-3 h-3 text-[#A3E635]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div>
        <h3 className="font-sans font-semibold text-[#0B3528] text-base leading-tight">
          {title}
        </h3>
        <p className="font-sans text-sm text-gray-500 mt-1 leading-snug">
          {description}
        </p>
      </div>
    </motion.button>
  );
};