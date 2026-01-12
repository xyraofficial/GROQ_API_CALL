import React from 'react';

// --- Card ---
export const IOSCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-ios p-4 ${className}`}>
    {children}
  </div>
);

// --- Button ---
interface IOSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const IOSButton = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}: IOSButtonProps) => {
  const baseStyles = "py-3 px-6 rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100";
  
  const variants = {
    primary: "bg-ios-blue text-white hover:bg-blue-600 shadow-md shadow-blue-200",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    danger: "bg-ios-red text-white hover:bg-red-600",
    ghost: "bg-transparent text-ios-blue hover:bg-blue-50"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

// --- Input ---
interface IOSInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const IOSInput = ({ label, className = '', ...props }: IOSInputProps) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-sm font-medium text-gray-500 ml-1">{label}</label>}
    <input 
      className={`w-full bg-gray-100 border-none rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-ios-blue/50 focus:bg-white transition-all outline-none ${className}`}
      {...props}
    />
  </div>
);

// --- Segmented Control ---
interface SegmentedControlProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export const IOSSegmentedControl = ({ options, value, onChange }: SegmentedControlProps) => {
  return (
    <div className="bg-gray-200/80 p-1 rounded-lg flex w-full relative">
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 z-10 ${
              isActive ? 'text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {option.label}
          </button>
        );
      })}
      {/* Animated Background Indicator */}
      <div 
        className="absolute top-1 bottom-1 bg-white rounded-md shadow-sm transition-all duration-200 ease-out"
        style={{
          width: `${(100 / options.length) - 2}%`,
          left: `${(options.findIndex(o => o.value === value) * (100 / options.length)) + 1}%`
        }}
      />
    </div>
  );
};