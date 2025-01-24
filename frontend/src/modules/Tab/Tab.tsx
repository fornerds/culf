import React, { useState } from 'react';
import styles from './Tab.module.css';

interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabProps {
  tabs: TabItem[];
  defaultActiveTab?: string;
  activeTab?: string;
  onClickTab?: (tabId: string) => void;
}

export function Tab({ tabs, defaultActiveTab, activeTab, onClickTab }: TabProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultActiveTab || tabs[0].id);
  
  const currentTab = activeTab || internalActiveTab;

  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabHeader}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`font-tag-1 ${styles.tabButton} ${currentTab === tab.id ? styles.active : ''}`}
            onClick={() => {
              setInternalActiveTab(tab.id);
              onClickTab?.(tab.id);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}