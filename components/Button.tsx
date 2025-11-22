import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "font-display font-bold uppercase tracking-widest py-3 px-6 transition-all duration-300 clip-path-polygon disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-game-gold text-game-dark hover:bg-yellow-600 border-2 border-game-gold",
    secondary: "bg-stone-800 text-game-paper border-2 border-stone-600 hover:border-game-gold hover:text-game-gold",
    danger: "bg-game-crimson text-white border-2 border-red-900 hover:bg-red-800",
    outline: "bg-transparent text-game-gold border-2 border-game-gold hover:bg-game-gold/10"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};