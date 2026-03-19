import React, { type ReactNode } from 'react';
import { Icon, type IconName } from '../Icon/Icon';
import { Button } from '../Button/Button';
import styles from './Panel.module.css';

export interface PanelProps {
  title?: string;
  children: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footer?: ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  children,
  icon,
  actions,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  className,
  headerClassName,
  bodyClassName,
  footer,
}) => {
  return (
    <div className={`${styles["panel"]} ${className || ''}`}>
      {(title || actions || collapsible) && (
        <div className={`${styles["header"]} ${headerClassName || ''}`}>
          <div className={styles["headerLeft"]}>
            {icon && <Icon name={icon} size={18} className={styles["headerIcon"]} />}
            {title && <h3 className={styles["title"]}>{title}</h3>}
          </div>
          <div className={styles["headerRight"]}>
            {actions}
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                icon={collapsed ? 'chevron-right' : 'chevron-down'}
                onClick={onToggleCollapse}
                aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
                aria-expanded={!collapsed}
              />
            )}
          </div>
        </div>
      )}

      {!collapsed && (
        <>
          <div className={`${styles["body"]} ${bodyClassName || ''}`}>{children}</div>

          {footer && <div className={styles["footer"]}>{footer}</div>}
        </>
      )}
    </div>
  );
};

// Panel Section for grouping content within a panel
export interface PanelSectionProps {
  title?: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const PanelSection: React.FC<PanelSectionProps> = ({
  title,
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
}) => {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <div className={`${styles["section"]} ${className || ''}`}>
      {title && (
        <button
          type="button"
          className={`${styles["sectionHeader"]} ${collapsible ? styles["collapsible"] : ''}`}
          onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
          aria-expanded={collapsible ? !collapsed : undefined}
        >
          {collapsible && (
            <Icon
              name={collapsed ? 'chevron-right' : 'chevron-down'}
              size={14}
              className={styles["sectionIcon"]}
            />
          )}
          <h4 className={styles["sectionTitle"]}>{title}</h4>
        </button>
      )}

      {(!collapsible || !collapsed) && <div className={styles["sectionContent"]}>{children}</div>}
    </div>
  );
};
