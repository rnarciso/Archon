import React, { useState, useEffect } from 'react';

export interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  sidebar?: React.ReactNode;
  sidebarPosition?: 'left' | 'right';
  sidebarWidth?: 'sm' | 'md' | 'lg';
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  breakpoints?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  className = '',
  sidebar,
  sidebarPosition = 'left',
  sidebarWidth = 'md',
  collapsible = true,
  collapsed = false,
  onCollapseChange,
  header,
  footer,
  breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 },
}) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Determine screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < (breakpoints.md || 768));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoints.md]);

  // Update collapsed state when prop changes
  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  const toggleSidebar = () => {
    if (!collapsible) return;
    
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };

  const openSidebar = () => {
    if (isMobile && sidebar) {
      setSidebarOpen(true);
    }
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const sidebarWidthClasses = {
    sm: 'w-64',
    md: 'w-80',
    lg: 'w-96',
  };

  const sidebarContent = sidebar && (
    <div
      className={`
        ${sidebarPosition === 'left' ? 'order-1' : 'order-3'}
        ${isMobile && sidebarOpen ? 'fixed inset-0 z-40' : 'hidden'}
        lg:block
        ${sidebarWidthClasses[sidebarWidth]}
        ${isCollapsed && !isMobile ? 'w-16' : ''}
        bg-white dark:bg-gray-800 border-r dark:border-gray-700
        transition-all duration-300 ease-in-out
      `}
    >
      <div className="h-full overflow-y-auto">
        {/* Collapsible button for desktop */}
        {!isMobile && collapsible && (
          <div className="p-4 border-b dark:border-gray-700">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg
                className={`w-5 h-5 transform transition-transform ${
                  isCollapsed ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={sidebarPosition === 'left' 
                    ? "M11 19l-7-7 7-7m8 14l-7-7 7-7" 
                    : "M13 5l7 7-7 7M5 5l7 7-7 7"
                  }
                />
              </svg>
            </button>
          </div>
        )}
        
        <div className={isCollapsed ? 'p-4' : 'p-4'}>
          {React.cloneElement(sidebar as React.ReactElement, { 
            isCollapsed,
            expandedWidth: sidebarWidthClasses[sidebarWidth],
          })}
        </div>
      </div>
    </div>
  );

  const overlay = sidebarOpen && (
    <div
      className="fixed inset-0 bg-black/50 z-30 lg:hidden"
      onClick={closeSidebar}
    />
  );

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      {header && (
        <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 z-10">
          <div className="px-4 py-3">
            {header}
          </div>
        </header>
      )}

      {/* Sidebar toggle button for mobile */}
      {sidebar && isMobile && (
        <div className="lg:hidden bg-white dark:bg-gray-800 border-b dark:border-gray-700 z-10">
          <div className="px-4 py-3">
            <button
              onClick={sidebarOpen ? closeSidebar : openSidebar}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={sidebarPosition === 'left' 
                    ? "M4 6h16M4 12h16M4 18h16" 
                    : "M6 4h4v16H6M14 4h4v16h-4"
                  }
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex">
        {/* Sidebar */}
        {sidebarContent}

        {/* Overlay for mobile */}
        {overlay}

        {/* Main content area */}
        <main
          className={`
            ${sidebarPosition === 'left' ? 'order-2' : 'order-1'}
            flex-1
            ${isMobile ? 'pt-0' : ''}
            min-h-[calc(100vh-${header ? '64px' : '0px'})]
          `}
        >
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      {footer && (
        <footer className="bg-white dark:bg-gray-800 border-t dark:border-gray-700">
          <div className="px-4 py-3">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
};

export interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  autoFit?: boolean;
  minItemWidth?: number;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className = '',
  cols = { default: 1, sm: 2, md: 3, lg: 4, xl: 5 },
  gap = 'md',
  autoFit = false,
  minItemWidth = 280,
}) => {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  };

  const gridColsClass = autoFit 
    ? `grid-cols-[repeat(auto-fit,minmax(${minItemWidth}px,1fr))]`
    : `grid-cols-${cols.default} sm:grid-cols-${cols.sm} md:grid-cols-${cols.md} lg:grid-cols-${cols.lg} xl:grid-cols-${cols.xl}`;

  return (
    <div className={`grid ${gridColsClass} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
};

export interface ResponsiveSplitViewProps {
  children: React.ReactNode[];
  direction?: 'row' | 'column';
  split?: number; // 0-100 percentage for first panel
  resizable?: boolean;
  minSizes?: {
    first?: number;
    second?: number;
  };
  className?: string;
}

export const ResponsiveSplitView: React.FC<ResponsiveSplitViewProps> = ({
  children,
  direction = 'row',
  split = 50,
  resizable = true,
  minSizes = { first: 200, second: 200 },
  className = '',
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [localSplit, setLocalSplit] = useState(split);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!resizable) return;
    
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startSplit = localSplit;
    const container = e.currentTarget.parentElement;
    
    if (!container) return;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const containerRect = container.getBoundingClientRect();
      const containerSize = direction === 'row' 
        ? containerRect.width 
        : containerRect.height;
      
      const offset = direction === 'row' 
        ? moveEvent.clientX - startX
        : moveEvent.clientY - startY;
      
      const newSplit = Math.max(
        minSizes.first || 200,
        Math.min(
          100 - (minSizes.second || 200),
          startSplit + (offset / containerSize) * 100
        )
      );
      
      setLocalSplit(newSplit);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    const startY = e.clientY;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const directionClasses = direction === 'row' 
    ? 'flex-row' 
    : 'flex-col h-full';

  const firstPanelStyle = direction === 'row'
    ? { width: `${localSplit}%` }
    : { height: `${localSplit}%` };

  const secondPanelStyle = direction === 'row'
    ? { width: `${100 - localSplit}%` }
    : { height: `${100 - localSplit}%` };

  return (
    <div className={`flex ${directionClasses} ${className}`}>
      <div 
        className="flex-shrink-0 overflow-auto"
        style={firstPanelStyle}
      >
        {children[0]}
      </div>
      
      {resizable && children.length > 1 && (
        <div
          className="flex-shrink-0 bg-gray-200 dark:bg-gray-700 cursor-col-resize hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          style={{
            width: direction === 'row' ? '4px' : '100%',
            height: direction === 'row' ? '100%' : '4px',
          }}
          onMouseDown={handleMouseDown}
        />
      )}
      
      {children.length > 1 && (
        <div 
          className="flex-shrink-0 overflow-auto"
          style={secondPanelStyle}
        >
          {children[1]}
        </div>
      )}
    </div>
  );
};

export default ResponsiveLayout;