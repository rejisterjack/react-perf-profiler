/**
 * AI Suggestions Panel
 * UI for viewing and applying AI-powered optimization suggestions
 * @module panel/components/AI/AISuggestionsPanel
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { getLLMManager, RECOMMENDED_OLLAMA_MODELS } from '@/panel/utils/llm';
import type { 
  LLMConfig, 
  AIOptimizationSuggestion
} from '@/panel/utils/llm/types';
import { useProfilerStore } from '@/panel/stores';
import { logger } from '@/shared/logger';
import styles from './AISuggestionsPanel.module.css';

/**
 * AI Suggestions Panel Component
 */
export const AISuggestionsPanel: React.FC = () => {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'none',
    enabled: false,
    privacyMode: 'anonymized',
    temperature: 0.2,
    maxTokens: 4096,
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<AIOptimizationSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AIOptimizationSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'suggestions'>('config');
  const [apiKey, setApiKey] = useState('');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const llmManager = getLLMManager();
  const wastedReports = useProfilerStore((s) => s.wastedRenderReports);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      await llmManager.loadConfig();
      const currentConfig = llmManager.getConfig();
      setConfig(currentConfig);
      setIsConfigured(llmManager.isEnabled());
      if (currentConfig.provider === 'ollama') {
        loadOllamaModels();
      }
    };
    loadConfig();
  }, [llmManager]);

  // Subscribe to LLM state changes
  useEffect(() => {
    const unsubscribe = llmManager.subscribe((enabled) => {
      setIsConfigured(enabled);
    });
    return unsubscribe;
  }, [llmManager]);

  const loadOllamaModels = async () => {
    setIsLoadingModels(true);
    const provider = new (await import('@/panel/utils/llm/OllamaProvider')).OllamaProvider(config);
    const models = await provider.getAvailableModels();
    setOllamaModels(models);
    setIsLoadingModels(false);
  };

  const handleSaveConfig = () => {
    const newConfig: Partial<LLMConfig> = {
      provider: config.provider,
      enabled: config.provider !== 'none',
      privacyMode: config.privacyMode,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      model: config.model,
    };

    if (apiKey && config.provider !== 'ollama') {
      newConfig.apiKey = apiKey;
    }

    llmManager.setConfig(newConfig as LLMConfig);
    setIsConfigured(llmManager.isEnabled());
    
    if (llmManager.isEnabled()) {
      setActiveTab('suggestions');
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!llmManager.isEnabled()) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Convert reports to analysis contexts
      const contexts = wastedReports.map(report => ({
        componentName: report.componentName,
        wastedRenderReport: report,
        renderCount: report.renderCount,
        wastedRenderCount: report.wastedRenders,
        averageRenderTime: report.estimatedSavingsMs / (report.wastedRenders || 1),
      }));

      const newSuggestions = await llmManager.generateBatchSuggestions(contexts);
      setSuggestions(newSuggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
      logger.error('AI suggestion generation failed', {
        error: err instanceof Error ? err.message : String(err),
        source: 'AISuggestionsPanel',
      });
    }

    setIsGenerating(false);
  };

  const handleApplySuggestion = (suggestion: AIOptimizationSuggestion) => {
    // Copy to clipboard
    navigator.clipboard.writeText(suggestion.suggestedCode);
    
    // Mark as applied
    setSuggestions(suggestions.map(s => 
      s.id === suggestion.id 
        ? { ...s, applied: true, appliedAt: Date.now() }
        : s
    ));
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'memo': 'React.memo',
      'useMemo': 'useMemo',
      'useCallback': 'useCallback',
      'split-props': 'Split Props',
      'colocate-state': 'Colocate State',
      'fix-deps': 'Fix Dependencies',
      'custom-hook': 'Custom Hook',
    };
    return labels[type] || type;
  };

  // =============================================================================
  // Render Config Tab
  // =============================================================================

  const renderConfigTab = () => (
    <div className={styles.configTab}>
      <div className={styles.configSection}>
        <h4>AI Provider</h4>
        <div className={styles.providerOptions}>
          <label className={styles.radioCard}>
            <input
              type="radio"
              name="provider"
              value="none"
              checked={config.provider === 'none'}
              onChange={() => setConfig({ ...config, provider: 'none' })}
            />
            <div className={styles.radioContent}>
              <strong>Disabled</strong>
              <span>Don't use AI suggestions</span>
            </div>
          </label>

          <label className={styles.radioCard}>
            <input
              type="radio"
              name="provider"
              value="claude"
              checked={config.provider === 'claude'}
              onChange={() => setConfig({ ...config, provider: 'claude' })}
            />
            <div className={styles.radioContent}>
              <strong>Claude (Anthropic)</strong>
              <span>Best for code understanding</span>
            </div>
          </label>

          <label className={styles.radioCard}>
            <input
              type="radio"
              name="provider"
              value="openai"
              checked={config.provider === 'openai'}
              onChange={() => setConfig({ ...config, provider: 'openai' })}
            />
            <div className={styles.radioContent}>
              <strong>OpenAI GPT-4</strong>
              <span>Most capable model</span>
            </div>
          </label>

          <label className={styles.radioCard}>
            <input
              type="radio"
              name="provider"
              value="ollama"
              checked={config.provider === 'ollama'}
              onChange={() => {
                setConfig({ ...config, provider: 'ollama' });
                loadOllamaModels();
              }}
            />
            <div className={styles.radioContent}>
              <strong>Ollama (Local)</strong>
              <span>Private, runs on your machine</span>
            </div>
          </label>
        </div>
      </div>

      {config.provider !== 'none' && config.provider !== 'ollama' && (
        <div className={styles.configSection}>
          <h4>API Key</h4>
          <div className={styles.apiKeyInput}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${config.provider} API key`}
            />
            <small>
              Stored in extension storage (chrome.storage.local), not on web pages. For maximum
              privacy, use Ollama (local) so keys never leave your machine.
            </small>
          </div>
        </div>
      )}

      {config.provider === 'ollama' && (
        <div className={styles.configSection}>
          <h4>Ollama Model</h4>
          <select
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            className={styles.modelSelect}
          >
            <option value="">Select a model...</option>
            {ollamaModels.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          
          {ollamaModels.length === 0 && !isLoadingModels && (
            <div className={styles.ollamaHelp}>
              <p>No models found. Install Ollama and pull a model:</p>
              <code>ollama pull codellama</code>
              <a 
                href="https://ollama.com" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Learn more
              </a>
            </div>
          )}

          <div className={styles.recommendedModels}>
            <h5>Recommended Models</h5>
            <div className={styles.modelGrid}>
              {RECOMMENDED_OLLAMA_MODELS.map(model => (
                <div key={model.name} className={styles.modelCard}>
                  <strong>{model.name}</strong>
                  <span>{model.description}</span>
                  <small>{model.size}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {config.provider !== 'none' && (
        <>
          <div className={styles.configSection}>
            <h4>Privacy Mode</h4>
            <div className={styles.privacyOptions}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="local"
                  checked={config.privacyMode === 'local'}
                  onChange={() => setConfig({ ...config, privacyMode: 'local' })}
                  disabled={config.provider !== 'ollama'}
                />
                <div>
                  <strong>Local Only</strong>
                  <span>Model runs on your machine, code never leaves</span>
                </div>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="anonymized"
                  checked={config.privacyMode === 'anonymized'}
                  onChange={() => setConfig({ ...config, privacyMode: 'anonymized' })}
                />
                <div>
                  <strong>Anonymized</strong>
                  <span>Component names are replaced before sending</span>
                </div>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  value="full"
                  checked={config.privacyMode === 'full'}
                  onChange={() => setConfig({ ...config, privacyMode: 'full' })}
                />
                <div>
                  <strong>Full Context</strong>
                  <span>Send actual component names for better suggestions</span>
                </div>
              </label>
            </div>
          </div>

          <div className={styles.configSection}>
            <h4>Advanced Settings</h4>
            <div className={styles.advancedSettings}>
              <div className={styles.setting}>
                <label>Temperature</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig({ ...config, temperature: Number.parseFloat(e.target.value) })}
                />
                <span>{config.temperature}</span>
                <small>Lower = more deterministic suggestions</small>
              </div>

              <div className={styles.setting}>
                <label>Max Tokens</label>
                <select
                  value={config.maxTokens}
                  onChange={(e) => setConfig({ ...config, maxTokens: Number.parseInt(e.target.value) })}
                >
                  <option value={2048}>2K (Fast)</option>
                  <option value={4096}>4K (Balanced)</option>
                  <option value={8192}>8K (Detailed)</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      <div className={styles.configActions}>
        <button className={styles.saveButton} onClick={handleSaveConfig}>
          Save Configuration
        </button>
      </div>
    </div>
  );

  // =============================================================================
  // Render Suggestions Tab
  // =============================================================================

  const renderSuggestionsTab = () => (
    <div className={styles.suggestionsTab}>
      {!isConfigured ? (
        <div className={styles.notConfigured}>
          <p>AI suggestions are not configured.</p>
          <button onClick={() => setActiveTab('config')}>
            Configure AI
          </button>
        </div>
      ) : (
        <>
          <div className={styles.suggestionsHeader}>
            <div className={styles.stats}>
              <span>{suggestions.length} suggestions</span>
              <span>{suggestions.filter(s => s.applied).length} applied</span>
            </div>
            <button
              className={styles.generateButton}
              onClick={handleGenerateSuggestions}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className={styles.spinner} />
                  Analyzing...
                </>
              ) : (
                '✨ Generate Suggestions'
              )}
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {suggestions.length === 0 && !isGenerating && (
            <div className={styles.emptyState}>
              <p>No AI suggestions yet.</p>
              <p>Click "Generate Suggestions" to analyze your profile.</p>
            </div>
          )}

          <div className={styles.suggestionsList}>
            {suggestions.map(suggestion => (
              <div
                key={suggestion.id}
                className={`${styles.suggestionCard} ${suggestion.applied ? styles.applied : ''}`}
                onClick={() => setSelectedSuggestion(suggestion)}
              >
                <div className={styles.suggestionHeader}>
                  <span className={styles.severityIcon}>
                    {getSeverityIcon(suggestion.severity)}
                  </span>
                  <span className={styles.componentName}>
                    {suggestion.componentName}
                  </span>
                  <span className={styles.suggestionType}>
                    {getTypeLabel(suggestion.type)}
                  </span>
                  {suggestion.applied && (
                    <span className={styles.appliedBadge}>Applied</span>
                  )}
                </div>
                <h5 className={styles.suggestionTitle}>{suggestion.title}</h5>
                <p className={styles.suggestionDescription}>{suggestion.description}</p>
                {suggestion.estimatedImprovement && (
                  <div className={styles.improvement}>
                    <span>📈 {suggestion.estimatedImprovement.renderTimeReduction}</span>
                    <span className={styles.confidence}>
                      {Math.round(suggestion.estimatedImprovement.confidence * 100)}% confidence
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {selectedSuggestion && (
        <div className={styles.detailOverlay} onClick={() => setSelectedSuggestion(null)}>
          <div className={styles.detailPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <h4>{selectedSuggestion.title}</h4>
              <button onClick={() => setSelectedSuggestion(null)}>×</button>
            </div>

            <div className={styles.detailContent}>
              <div className={styles.detailMeta}>
                <span>{getSeverityIcon(selectedSuggestion.severity)} {selectedSuggestion.severity}</span>
                <span>{getTypeLabel(selectedSuggestion.type)}</span>
                <span>{selectedSuggestion.componentName}</span>
              </div>

              <p className={styles.detailExplanation}>{selectedSuggestion.explanation}</p>

              <div className={styles.codeComparison}>
                <div className={styles.codeBlock}>
                  <label>Current Code</label>
                  <pre><code>{selectedSuggestion.currentCode}</code></pre>
                </div>
                <div className={`${styles.codeBlock} ${styles.improved}`}>
                  <label>Suggested Code</label>
                  <pre><code>{selectedSuggestion.suggestedCode}</code></pre>
                </div>
              </div>

              {selectedSuggestion.dependencies.length > 0 && (
                <div className={styles.dependencies}>
                  <label>Dependencies:</label>
                  <ul>
                    {selectedSuggestion.dependencies.map((dep, i) => (
                      <li key={i}>{dep}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={styles.detailActions}>
                <button
                  className={styles.copyButton}
                  onClick={() => handleApplySuggestion(selectedSuggestion)}
                >
                  📋 Copy to Clipboard
                </button>
                <button
                  className={styles.closeButton}
                  onClick={() => setSelectedSuggestion(null)}
                >
                  Close
                </button>
              </div>

              {selectedSuggestion.llmModel && (
                <div className={styles.modelInfo}>
                  Generated by {selectedSuggestion.llmModel}
                  {selectedSuggestion.tokensUsed && ` (${selectedSuggestion.tokensUsed} tokens)`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // =============================================================================
  // Main Render
  // =============================================================================

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>🤖 AI Suggestions</h2>
        {isConfigured && (
          <span className={styles.statusBadge}>
            {config.provider === 'ollama' ? '🏠 Local' : '☁️ Cloud'}
          </span>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'config' ? styles.active : ''}`}
          onClick={() => setActiveTab('config')}
        >
          Configuration
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'suggestions' ? styles.active : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          Suggestions ({suggestions.length})
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'config' ? renderConfigTab() : renderSuggestionsTab()}
      </div>
    </div>
  );
};

export default AISuggestionsPanel;
