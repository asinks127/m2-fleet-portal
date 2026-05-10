import React, { useState, useEffect } from 'react';

/**
 * Hook to detect media query matches
 */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = () => setMatches(media.matches);
    
    // Modern browsers
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      // Fallback for older browsers
      media.addListener(listener);
      return () => media.removeListener(listener);
    }
  }, [matches, query]);

  return matches;
}

/**
 * Mobile-optimized wrapper component
 * Automatically switches between desktop and mobile layouts
 */
export function MobileOptimized({ desktop, mobile, children }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  if (mobile && isMobile) {
    return mobile;
  }
  
  if (desktop && !isMobile) {
    return desktop;
  }
  
  return children;
}

/**
 * Touch-optimized button for mobile
 */
export function TouchButton({ children, onClick, variant = 'default', className = '', ...props }) {
  const baseClasses = 'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg font-medium transition-all active:scale-95';
  
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  };
  
  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Swipeable card for mobile actions
 */
export function SwipeableCard({ children, onSwipeLeft, onSwipeRight, leftAction, rightAction }) {
  const [touchStart, setTouchStart] = React.useState(null);
  const [touchEnd, setTouchEnd] = React.useState(null);
  const [offset, setOffset] = React.useState(0);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    const currentTouch = e.targetTouches[0].clientX;
    setOffset(currentTouch - touchStart);
    setTouchEnd(currentTouch);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }
    
    setOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Background Actions */}
      {leftAction && (
        <div className="absolute left-0 top-0 bottom-0 bg-green-500 flex items-center justify-center px-4">
          {leftAction}
        </div>
      )}
      {rightAction && (
        <div className="absolute right-0 top-0 bottom-0 bg-red-500 flex items-center justify-center px-4">
          {rightAction}
        </div>
      )}
      
      {/* Card Content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.3s' : 'none' }}
        className="bg-white"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Mobile-optimized bottom navigation
 */
export function MobileBottomNav({ items, currentPath }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
      <div className="flex justify-around items-center h-16">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          
          return (
            <a
              key={index}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs">{item.label}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Mobile-optimized table/list view
 */
export function MobileList({ items, renderItem }) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="bg-white rounded-lg shadow p-4">
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}