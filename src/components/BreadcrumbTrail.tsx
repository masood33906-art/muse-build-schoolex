import React from 'react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbTrailProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const BreadcrumbTrail: React.FC<BreadcrumbTrailProps> = ({ items, className = '' }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center flex-wrap gap-1.5 text-xs text-slate-400 mt-1 ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 && <span className="text-slate-600 font-mono select-none mx-0.5">•</span>}
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-white transition-colors cursor-pointer font-medium hover:underline underline-offset-2"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'text-slate-200 font-semibold' : 'text-slate-400'}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
