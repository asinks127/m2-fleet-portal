import React from 'react';
import { Home, ChevronRight } from 'lucide-react';

export default function Breadcrumbs({ path, onNavigateUp, onGoHome }) {
  const sanitizedPath = path.map(segment => segment.replace(/_/g, ' '));

  return (
    <nav aria-label="breadcrumb">
      <ol className="flex items-center space-x-1 sm:space-x-2 text-sm text-gray-500">
        <li>
          <button 
            onClick={onGoHome} 
            className="hover:text-blue-600 flex items-center gap-2 transition-colors"
            aria-label="Go to drive root"
          >
            <Home className="w-4 h-4" />
            <span>Drive</span>
          </button>
        </li>
        {sanitizedPath.map((segment, index) => (
          <li key={index}>
            <div className="flex items-center">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <button 
                onClick={() => onNavigateUp(index)} 
                className="ml-1 sm:ml-2 hover:text-blue-600 transition-colors"
              >
                {segment}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}