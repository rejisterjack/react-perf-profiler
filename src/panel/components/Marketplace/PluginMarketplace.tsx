/**
 * Plugin Marketplace
 * Discover and install community plugins
 * @module panel/components/Marketplace/PluginMarketplace
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import type { PluginMetadata } from '@/panel/plugins/types';
import styles from './PluginMarketplace.module.css';

/**
 * Marketplace plugin entry
 */
interface MarketplacePlugin extends PluginMetadata {
  downloadUrl: string;
  rating: number;
  downloads: number;
  author: string;
  tags: string[];
}

/**
 * Plugin Marketplace Component
 */
export const PluginMarketplace: React.FC = () => {
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);

  // Mock marketplace data
  const mockPlugins: MarketplacePlugin[] = [
    {
      id: 'com.example.redux-devtools',
      name: 'Redux DevTools Integration',
      version: '1.2.0',
      description: 'Deep integration with Redux DevTools for time-travel debugging',
      author: 'Redux Team',
      rating: 4.8,
      downloads: 15420,
      downloadUrl: 'https://example.com/plugins/redux-devtools.js',
      tags: ['redux', 'debugging', 'state'],
      enabledByDefault: false,
    },
    {
      id: 'com.example.router-analyzer',
      name: 'React Router Analyzer',
      version: '2.0.1',
      description: 'Analyze route transitions and lazy loading performance',
      author: 'Router Team',
      rating: 4.5,
      downloads: 8930,
      downloadUrl: 'https://example.com/plugins/router-analyzer.js',
      tags: ['router', 'navigation', 'performance'],
      enabledByDefault: false,
    },
    {
      id: 'com.example.animation-profiler',
      name: 'Animation Profiler',
      version: '1.0.5',
      description: 'Profile CSS and JS animations, detect jank',
      author: 'Animation Expert',
      rating: 4.2,
      downloads: 5230,
      downloadUrl: 'https://example.com/plugins/animation-profiler.js',
      tags: ['animation', 'css', 'performance'],
      enabledByDefault: false,
    },
    {
      id: 'com.example.accessibility-audit',
      name: 'Accessibility Audit',
      version: '1.1.0',
      description: 'A11y performance checks and recommendations',
      author: 'A11y First',
      rating: 4.9,
      downloads: 12100,
      downloadUrl: 'https://example.com/plugins/a11y-audit.js',
      tags: ['accessibility', 'a11y', 'audit'],
      enabledByDefault: false,
    },
    {
      id: 'com.example.websocket-monitor',
      name: 'WebSocket Monitor',
      version: '1.0.0',
      description: 'Track WebSocket message flow and latency',
      author: 'Socket Dev',
      rating: 4.3,
      downloads: 3400,
      downloadUrl: 'https://example.com/plugins/websocket-monitor.js',
      tags: ['websocket', 'network', 'real-time'],
      enabledByDefault: false,
    },
  ];

  useEffect(() => {
    // Simulate loading from registry
    setTimeout(() => {
      setPlugins(mockPlugins);
      setIsLoading(false);
    }, 500);
  }, []);

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = 
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    
    const matchesCategory = 
      selectedCategory === 'all' || 
      plugin.tags.includes(selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const handleInstall = async (plugin: MarketplacePlugin) => {
    setInstalling(plugin.id);
    
    try {
      // In real implementation, download and validate plugin
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock installation
      alert(`Installed ${plugin.name}!`);
    } catch (error) {
      console.error('Installation failed:', error);
    }
    
    setInstalling(null);
  };

  const categories = ['all', 'state', 'router', 'performance', 'animation', 'accessibility', 'network'];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>🛒 Plugin Marketplace</h2>
        <p>Discover and install community plugins to extend React Perf Profiler</p>
      </div>

      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search plugins..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.categories}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`${styles.categoryButton} ${selectedCategory === cat ? styles.active : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading marketplace...</div>
      ) : (
        <div className={styles.pluginGrid}>
          {filteredPlugins.map(plugin => (
            <div key={plugin.id} className={styles.pluginCard}>
              <div className={styles.pluginHeader}>
                <h3>{plugin.name}</h3>
                <span className={styles.version}>{plugin.version}</span>
              </div>

              <p className={styles.description}>{plugin.description}</p>

              <div className={styles.tags}>
                {plugin.tags.map(tag => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>

              <div className={styles.meta}>
                <div className={styles.rating}>
                  <span>⭐ {plugin.rating}</span>
                  <span>{plugin.downloads.toLocaleString()} downloads</span>
                </div>
                <span className={styles.author}>by {plugin.author}</span>
              </div>

              <button
                className={styles.installButton}
                onClick={() => handleInstall(plugin)}
                disabled={installing === plugin.id}
              >
                {installing === plugin.id ? 'Installing...' : 'Install'}
              </button>
            </div>
          ))}
        </div>
      )}

      {filteredPlugins.length === 0 && !isLoading && (
        <div className={styles.empty}>
          <p>No plugins found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default PluginMarketplace;
