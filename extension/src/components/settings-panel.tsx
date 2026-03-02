import { useState, useCallback } from "preact/hooks";
import {
  settings,
  isDarkMode,
  showSettings,
  settingsPage,
  connectionStatus,
  syncEndpoint,
  isLocalhost,
  toolbarPosition,
} from "../store/signals";
import {
  IconHelp,
  IconSun,
  IconMoon,
  IconChevronLeft,
  IconCheckSmallAnimated,
} from "./icons";
import type { OutputDetailLevel, ToolbarSettings } from "../types";
import styles from "../styles/toolbar.module.scss";

const OUTPUT_DETAIL_OPTIONS: { value: OutputDetailLevel; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "detailed", label: "Detailed" },
  { value: "forensic", label: "Forensic" },
];

const COLOR_OPTIONS = [
  { value: "#AF52DE", label: "Purple" },
  { value: "#3c82f7", label: "Blue" },
  { value: "#5AC8FA", label: "Cyan" },
  { value: "#34C759", label: "Green" },
  { value: "#FFD60A", label: "Yellow" },
  { value: "#FF9500", label: "Orange" },
  { value: "#FF3B30", label: "Red" },
];

function updateSettings(updater: (s: ToolbarSettings) => ToolbarSettings) {
  settings.value = updater(settings.value);
}

export function SettingsPanel() {
  const dark = isDarkMode.value;
  const s = settings.value;
  const page = settingsPage.value;
  const pos = toolbarPosition.value;
  const connStatus = connectionStatus.value;
  const visible = showSettings.value;

  if (!visible) return null;

  return (
    <div
      className={`${styles.settingsPanel} ${dark ? styles.dark : styles.light} ${styles.enter}`}
      onClick={(e: MouseEvent) => e.stopPropagation()}
      style={pos && pos.y < 230 ? { bottom: "auto", top: "calc(100% + 0.5rem)" } : undefined}
    >
      <div className={styles.settingsPanelContainer}>
        {/* Main settings page */}
        <div className={`${styles.settingsPage} ${page === "automations" ? styles.slideLeft : ""}`}>
          <div className={styles.settingsHeader}>
            <span className={styles.settingsBrand}>
              <span
                className={styles.settingsBrandSlash}
                style={{ color: s.annotationColor, transition: "color 0.2s ease" }}
              >
                /
              </span>
              agentation
            </span>
            <span className={styles.settingsVersion}>ext</span>
            <button
              className={styles.themeToggle}
              onClick={() => { isDarkMode.value = !isDarkMode.value; }}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className={styles.themeIconWrapper}>
                <span className={styles.themeIcon}>
                  {dark ? <IconSun size={20} /> : <IconMoon size={20} />}
                </span>
              </span>
            </button>
          </div>

          {/* Output Detail */}
          <div className={styles.settingsSection}>
            <div className={styles.settingsRow}>
              <div className={`${styles.settingsLabel} ${!dark ? styles.light : ""}`}>
                Output Detail
              </div>
              <button
                className={`${styles.cycleButton} ${!dark ? styles.light : ""}`}
                onClick={() => {
                  const idx = OUTPUT_DETAIL_OPTIONS.findIndex((o) => o.value === s.outputDetail);
                  const next = (idx + 1) % OUTPUT_DETAIL_OPTIONS.length;
                  updateSettings((prev) => ({ ...prev, outputDetail: OUTPUT_DETAIL_OPTIONS[next].value }));
                }}
              >
                <span className={styles.cycleButtonText}>
                  {OUTPUT_DETAIL_OPTIONS.find((o) => o.value === s.outputDetail)?.label}
                </span>
                <span className={styles.cycleDots}>
                  {OUTPUT_DETAIL_OPTIONS.map((option) => (
                    <span
                      key={option.value}
                      className={`${styles.cycleDot} ${!dark ? styles.light : ""} ${s.outputDetail === option.value ? styles.active : ""}`}
                    />
                  ))}
                </span>
              </button>
            </div>

            {/* React Components toggle */}
            <div className={`${styles.settingsRow} ${styles.settingsRowMarginTop} ${!isLocalhost.value ? styles.settingsRowDisabled : ""}`}>
              <div className={`${styles.settingsLabel} ${!dark ? styles.light : ""}`}>
                React Components
              </div>
              <label className={`${styles.toggleSwitch} ${!isLocalhost.value ? styles.disabled : ""}`}>
                <input
                  type="checkbox"
                  checked={isLocalhost.value && s.reactEnabled}
                  disabled={!isLocalhost.value}
                  onChange={() => updateSettings((prev) => ({ ...prev, reactEnabled: !prev.reactEnabled }))}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          </div>

          {/* Marker Colour */}
          <div className={styles.settingsSection}>
            <div className={`${styles.settingsLabel} ${styles.settingsLabelMarker} ${!dark ? styles.light : ""}`}>
              Marker Colour
            </div>
            <div className={styles.colorOptions}>
              {COLOR_OPTIONS.map((color) => (
                <div
                  key={color.value}
                  role="button"
                  onClick={() => updateSettings((prev) => ({ ...prev, annotationColor: color.value }))}
                  style={{ borderColor: s.annotationColor === color.value ? color.value : "transparent" }}
                  className={`${styles.colorOptionRing} ${s.annotationColor === color.value ? styles.selected : ""}`}
                >
                  <div
                    className={`${styles.colorOption} ${s.annotationColor === color.value ? styles.selected : ""}`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Checkboxes */}
          <div className={styles.settingsSection}>
            <label className={styles.settingsToggle}>
              <input
                type="checkbox"
                checked={s.autoClearAfterCopy}
                onChange={() => updateSettings((prev) => ({ ...prev, autoClearAfterCopy: !prev.autoClearAfterCopy }))}
              />
              <label
                className={`${styles.customCheckbox} ${s.autoClearAfterCopy ? styles.checked : ""}`}
              >
                {s.autoClearAfterCopy && <IconCheckSmallAnimated size={14} />}
              </label>
              <span className={`${styles.toggleLabel} ${!dark ? styles.light : ""}`}>
                Clear on copy/send
              </span>
            </label>

            <label className={`${styles.settingsToggle} ${styles.settingsToggleMarginBottom}`}>
              <input
                type="checkbox"
                checked={s.blockInteractions}
                onChange={() => updateSettings((prev) => ({ ...prev, blockInteractions: !prev.blockInteractions }))}
              />
              <label
                className={`${styles.customCheckbox} ${s.blockInteractions ? styles.checked : ""}`}
              >
                {s.blockInteractions && <IconCheckSmallAnimated size={14} />}
              </label>
              <span className={`${styles.toggleLabel} ${!dark ? styles.light : ""}`}>
                Block page interactions
              </span>
            </label>
          </div>

          {/* Automations nav link */}
          <div className={`${styles.settingsSection} ${styles.settingsSectionExtraPadding}`}>
            <button
              className={`${styles.settingsNavLink} ${!dark ? styles.light : ""}`}
              onClick={() => { settingsPage.value = "automations"; }}
            >
              <span>Manage MCP & Webhooks</span>
              <span className={styles.settingsNavLinkRight}>
                {connStatus !== "disconnected" && (
                  <span className={`${styles.mcpNavIndicator} ${styles[connStatus]}`} />
                )}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7.5 12.5L12 8L7.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        {/* Automations Page */}
        <div className={`${styles.settingsPage} ${styles.automationsPage} ${page === "automations" ? styles.slideIn : ""}`}>
          <button
            className={`${styles.settingsBackButton} ${!dark ? styles.light : ""}`}
            onClick={() => { settingsPage.value = "main"; }}
          >
            <IconChevronLeft size={16} />
            <span>Manage MCP & Webhooks</span>
          </button>

          {/* MCP Connection */}
          <div className={styles.settingsSection}>
            <div className={styles.settingsRow}>
              <span className={`${styles.automationHeader} ${!dark ? styles.light : ""}`}>
                MCP Connection
              </span>
              <div
                className={`${styles.mcpStatusDot} ${styles[connStatus]}`}
                title={connStatus === "connected" ? "Connected" : connStatus === "connecting" ? "Connecting..." : "Disconnected"}
              />
            </div>
            <p className={`${styles.automationDescription} ${!dark ? styles.light : ""}`} style={{ paddingBottom: 6 }}>
              MCP connection allows agents to receive and act on annotations.{" "}
              <a
                href="https://agentation.dev/mcp"
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.learnMoreLink} ${!dark ? styles.light : ""}`}
              >
                Learn more
              </a>
            </p>
          </div>

          {/* Webhooks */}
          <div className={`${styles.settingsSection} ${styles.settingsSectionGrow}`}>
            <div className={styles.settingsRow}>
              <span className={`${styles.automationHeader} ${!dark ? styles.light : ""}`}>
                Webhooks
              </span>
              <div className={styles.autoSendRow}>
                <span className={`${styles.autoSendLabel} ${!dark ? styles.light : ""} ${s.webhooksEnabled ? styles.active : ""}`}>
                  Auto-Send
                </span>
                <label className={`${styles.toggleSwitch} ${!s.webhookUrl ? styles.disabled : ""}`}>
                  <input
                    type="checkbox"
                    checked={s.webhooksEnabled}
                    disabled={!s.webhookUrl}
                    onChange={() => updateSettings((prev) => ({ ...prev, webhooksEnabled: !prev.webhooksEnabled }))}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            </div>
            <p className={`${styles.automationDescription} ${!dark ? styles.light : ""}`}>
              The webhook URL will receive live annotation changes and annotation data.
            </p>
            <textarea
              className={`${styles.webhookUrlInput} ${!dark ? styles.light : ""}`}
              placeholder="Webhook URL"
              value={s.webhookUrl}
              onInput={(e) => updateSettings((prev) => ({ ...prev, webhookUrl: (e.target as HTMLTextAreaElement).value }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
