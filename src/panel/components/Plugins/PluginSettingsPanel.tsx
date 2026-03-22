/**
 * Plugin Settings Panel
 * @module panel/components/Plugins/PluginSettingsPanel
 *
 * Provides UI for managing plugin settings, enabling/disabling plugins,
 * and viewing plugin metadata.
 */

import type React from 'react';
import { useState, useCallback } from 'react';
import { panelLogger } from '@/shared/logger';
import { Panel } from '../Common/Panel/Panel';
import { Button } from '../Common/Button/Button';
import { Checkbox } from '../Common/Checkbox/Checkbox';
import { Input } from '../Common/Input/Input';
import { Badge } from '../Common/Badge/Badge';
import { Icon } from '../Common/Icon/Icon';
import { Tooltip } from '../Common/Tooltip/Tooltip';
import type {
  AnalysisPlugin,
  PluginState,
  PluginSettingSchema,
} from '@/panel/plugins/types';
import type { PluginManager } from '@/panel/plugins/PluginManager';
import styles from './PluginSettingsPanel.module.css';

interface PluginSettingsPanelProps {
  /** Plugin manager instance */
  pluginManager: PluginManager;
  /** Optional className */
  className?: string;
  /** Called when a plugin is toggled */
  onPluginToggle?: (pluginId: string, enabled: boolean) => void;
}

/**
 * Setting input component based on type
 */
function SettingInput({
  schema,
  value,
  onChange,
}: {
  schema: PluginSettingSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}): React.ReactElement {
  const handleChange = useCallback(
    (newValue: unknown) => {
      onChange(newValue);
    },
    [onChange]
  );

  switch (schema.type) {
    case 'boolean':
      return (
        <Checkbox
          checked={Boolean(value)}
          onChange={(checked) => handleChange(checked)}
          label={schema.name}
        />
      );

    case 'number':
      return (
        <div className={styles['numberInput']}>
          <label htmlFor={`setting-${schema.key}`} className={styles['settingLabel']}>
            {schema.name}
            {schema.required && <span className={styles['required']}>*</span>}
          </label>
          <Input
            id={`setting-${schema.key}`}
            type="number"
            value={String(value ?? schema.defaultValue ?? 0)}
            onChange={(e) => handleChange(Number(e.target.value))}
            min={schema.min}
            max={schema.max}
          />
        </div>
      );

    case 'select':
      return (
        <div className={styles['selectInput']}>
          <label htmlFor={`setting-${schema.key}`} className={styles['settingLabel']}>
            {schema.name}
            {schema.required && <span className={styles['required']}>*</span>}
          </label>
          <select
            id={`setting-${schema.key}`}
            className={styles['select']}
            value={String(value ?? schema.defaultValue ?? '')}
            onChange={(e) => handleChange(e.target.value)}
          >
            {schema.options?.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );

    case 'array':
      return (
        <div className={styles['arrayInput']}>
          <label htmlFor={`setting-${schema.key}`} className={styles['settingLabel']}>
            {schema.name}
            {schema.required && <span className={styles['required']}>*</span>}
          </label>
          <Input
            id={`setting-${schema.key}`}
            type="text"
            value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
            onChange={(e) =>
              handleChange(
                e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
              )
            }
            placeholder="Comma-separated values"
          />
        </div>
      );

    case 'string':
    default:
      return (
        <div className={styles['stringInput']}>
          <label htmlFor={`setting-${schema.key}`} className={styles['settingLabel']}>
            {schema.name}
            {schema.required && <span className={styles['required']}>*</span>}
          </label>
          <Input
            id={`setting-${schema.key}`}
            type="text"
            value={String(value ?? schema.defaultValue ?? '')}
            onChange={(e) => handleChange(e.target.value)}
            pattern={schema.validation?.source}
          />
        </div>
      );
  }
}

/**
 * Single plugin settings card
 */
function PluginCard({
  plugin,
  state,
  onToggle,
  onSettingChange,
}: {
  plugin: AnalysisPlugin;
  state: PluginState | undefined;
  onToggle: () => void;
  onSettingChange: (key: string, value: unknown) => void;
}): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const isEnabled = state?.enabled ?? false;
  const hasError = !!state?.error;
  const settings = state?.settings ?? {};

  const hasSettings =
    plugin.metadata.settingsSchema && plugin.metadata.settingsSchema.length > 0;
  const hasHooks = plugin.hooks && Object.keys(plugin.hooks).length > 0;
  const hasUI = !!plugin.getUI || !!plugin.SettingsComponent;

  return (
    <div
      className={`${styles['pluginCard']} ${isEnabled ? styles['enabled'] : ''} ${
        hasError ? styles['error'] : ''
      }`}
    >
      <div className={styles['pluginHeader']}>
        <div className={styles['pluginInfo']}>
          <div className={styles['pluginNameRow']}>
            <h4 className={styles['pluginName']}>{plugin.metadata.name}</h4>
            <Badge variant={isEnabled ? 'success' : 'secondary'} size="sm">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
            {hasError && (
              <Tooltip content={state?.error}>
                <Badge variant="error" size="sm">
                  Error
                </Badge>
              </Tooltip>
            )}
          </div>
          <div className={styles['pluginMeta']}>
            <span className={styles['version']}>v{plugin.metadata.version}</span>
            {plugin.metadata.author && (
              <span className={styles['author']}>by {plugin.metadata.author}</span>
            )}
          </div>
          {plugin.metadata.description && (
            <p className={styles['description']}>{plugin.metadata.description}</p>
          )}
          <div className={styles['pluginCapabilities']}>
            {hasHooks && (
              <span className={styles['capability']} title="Has hooks">
                <Icon name="commit" size={12} />
                Hooks
              </span>
            )}
            {hasSettings && (
              <span className={styles['capability']} title="Has settings">
                <Icon name="settings" size={12} />
                Settings
              </span>
            )}
            {hasUI && (
              <span className={styles['capability']} title="Has custom UI">
                <Icon name="component" size={12} />
                UI
              </span>
            )}
          </div>
        </div>
        <div className={styles['pluginActions']}>
          {hasSettings && isEnabled && (
            <Button
              variant="ghost"
              size="sm"
              icon={isExpanded ? 'chevron-up' : 'chevron-down'}
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'Collapse settings' : 'Expand settings'}
            >
              Settings
            </Button>
          )}
          <Button
            variant={isEnabled ? 'secondary' : 'primary'}
            size="sm"
            onClick={onToggle}
          >
            {isEnabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>

      {isExpanded && hasSettings && isEnabled && (
        <div className={styles['pluginSettings']}>
          {plugin.metadata.settingsSchema?.map((schema) => (
            <div key={schema.key} className={styles['settingRow']}>
              <SettingInput
                schema={schema}
                value={settings[schema.key]}
                onChange={(value) => onSettingChange(schema.key, value)}
              />
              {schema.description && (
                <small className={styles['settingDescription']}>
                  {schema.description}
                </small>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Plugin Settings Panel
 *
 * Provides a comprehensive interface for managing plugins including:
 * - Viewing all registered plugins
 * - Enabling/disabling plugins
 * - Configuring plugin settings
 * - Viewing plugin metadata and capabilities
 *
 * @example
 * ```tsx
 * <PluginSettingsPanel
 *   pluginManager={pluginManager}
 *   onPluginToggle={(id, enabled) => console.log(id, enabled)}
 * />
 * ```
 */
export const PluginSettingsPanel: React.FC<PluginSettingsPanelProps> = ({
  pluginManager,
  className,
  onPluginToggle,
}) => {
  const plugins = pluginManager.getAllPlugins();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleToggle = useCallback(
    async (pluginId: string) => {
      try {
        await pluginManager.togglePlugin(pluginId);
        const isEnabled = pluginManager.isPluginEnabled(pluginId);
        onPluginToggle?.(pluginId, isEnabled);
        setRefreshKey((k) => k + 1);
      } catch (error) {
        panelLogger.error('Failed to toggle plugin', {
          source: 'PluginSettingsPanel',
          pluginId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [pluginManager, onPluginToggle]
  );

  const handleSettingChange = useCallback(
    (pluginId: string, key: string, value: unknown) => {
      try {
        pluginManager.updatePluginSettings(pluginId, { [key]: value });
        setRefreshKey((k) => k + 1);
      } catch (error) {
        panelLogger.error('Failed to update setting', {
          source: 'PluginSettingsPanel',
          pluginId,
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [pluginManager]
  );

  const enabledCount = plugins.filter((p) =>
    pluginManager.isPluginEnabled(p.metadata.id)
  ).length;

  return (
    <Panel
      title="Plugin Settings"
      icon="settings"
      className={className}
      actions={
        <Badge variant="secondary">
          {enabledCount}/{plugins.length} enabled
        </Badge>
      }
    >
      <div className={styles['container']} key={refreshKey}>
        {plugins.length === 0 ? (
          <div className={styles['empty']}>
            <Icon name="info" size={24} className={styles['emptyIcon']} />
            <p>No plugins registered</p>
            <small>Register plugins to see them here</small>
          </div>
        ) : (
          <div className={styles['pluginList']}>
            {plugins.map((plugin) => (
              <PluginCard
                key={plugin.metadata.id}
                plugin={plugin}
                state={pluginManager.getPluginState(plugin.metadata.id)}
                onToggle={() => handleToggle(plugin.metadata.id)}
                onSettingChange={(key, value) =>
                  handleSettingChange(plugin.metadata.id, key, value)
                }
              />
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
};

export default PluginSettingsPanel;
