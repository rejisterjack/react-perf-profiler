import React, { useState, createContext, useContext, ReactNode } from 'react';
import styles from './Tabs.module.css';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

const useTabs = (): TabsContextType => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
};

// Tabs Container
interface TabsProps {
  children: ReactNode;
  defaultTab: string;
  className?: string;
  onChange?: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ 
  children, 
  defaultTab, 
  className,
  onChange 
}) => {
  const [activeTab, setActiveTabState] = useState(defaultTab);
  
  const setActiveTab = (id: string) => {
    setActiveTabState(id);
    onChange?.(id);
  };
  
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={`${styles.tabs} ${className || ''}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

// Tab List
interface TabListProps {
  children: ReactNode;
  className?: string;
}

export const TabList: React.FC<TabListProps> = ({ children, className }) => {
  return (
    <div 
      className={`${styles.tabList} ${className || ''}`}
      role="tablist"
    >
      {children}
    </div>
  );
};

// Individual Tab
interface TabProps {
  id: string;
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export const Tab: React.FC<TabProps> = ({ id, children, icon, disabled = false }) => {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === id;
  
  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${id}`}
      id={`tab-${id}`}
      disabled={disabled}
      className={`${styles.tab} ${isActive ? styles.active : ''} ${disabled ? styles.disabled : ''}`}
      onClick={() => setActiveTab(id)}
      tabIndex={isActive ? 0 : -1}
    >
      {icon && <span className={styles.tabIcon}>{icon}</span>}
      <span className={styles.tabLabel}>{children}</span>
    </button>
  );
};

// Tab Panel
interface TabPanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ id, children, className }) => {
  const { activeTab } = useTabs();
  const isActive = activeTab === id;
  
  if (!isActive) return null;
  
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={`${styles.tabPanel} ${className || ''}`}
    >
      {children}
    </div>
  );
};
