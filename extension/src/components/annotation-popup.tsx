import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import { forwardRef } from "preact/compat";
import type { JSX, Ref } from "preact";
import styles from "../styles/popup.module.scss";
import { IconTrash } from "./icons";
import { originalSetTimeout } from "../utils/freeze-animations";

// =============================================================================
// Types
// =============================================================================

export interface AnnotationPopupProps {
  element: string;
  timestamp?: string;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  style?: JSX.CSSProperties;
  accentColor?: string;
  isExiting?: boolean;
  lightMode?: boolean;
  computedStyles?: Record<string, string>;
}

export interface AnnotationPopupHandle {
  shake: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const AnnotationPopup = forwardRef<AnnotationPopupHandle, AnnotationPopupProps>(
  function AnnotationPopup(
    {
      element,
      timestamp,
      selectedText,
      placeholder = "What should change?",
      initialValue = "",
      submitLabel = "Add",
      onSubmit,
      onCancel,
      onDelete,
      style,
      accentColor = "#3c82f7",
      isExiting = false,
      lightMode = false,
      computedStyles,
    },
    ref: Ref<AnnotationPopupHandle>,
  ) {
    const [text, setText] = useState(initialValue);
    const [isShaking, setIsShaking] = useState(false);
    const [animState, setAnimState] = useState<"initial" | "enter" | "entered" | "exit">("initial");
    const [isFocused, setIsFocused] = useState(false);
    const [isStylesExpanded, setIsStylesExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync with parent exit state
    useEffect(() => {
      if (isExiting && animState !== "exit") {
        setAnimState("exit");
      }
    }, [isExiting, animState]);

    // Animate in on mount and focus textarea
    useEffect(() => {
      originalSetTimeout(() => setAnimState("enter"), 0);
      const enterTimer = originalSetTimeout(() => setAnimState("entered"), 200);
      const focusTimer = originalSetTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
          textarea.scrollTop = textarea.scrollHeight;
        }
      }, 50);
      return () => {
        clearTimeout(enterTimer);
        clearTimeout(focusTimer);
        if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      };
    }, []);

    // Shake animation
    const shake = useCallback(() => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      setIsShaking(true);
      shakeTimerRef.current = originalSetTimeout(() => {
        setIsShaking(false);
        textareaRef.current?.focus();
      }, 250);
    }, []);

    // Expose shake to parent via ref
    if (typeof ref === "function") {
      ref({ shake });
    } else if (ref) {
      (ref as { current: AnnotationPopupHandle | null }).current = { shake };
    }

    const handleCancel = useCallback(() => {
      setAnimState("exit");
      cancelTimerRef.current = originalSetTimeout(() => onCancel(), 150);
    }, [onCancel]);

    const handleSubmit = useCallback(() => {
      if (!text.trim()) return;
      onSubmit(text.trim());
    }, [text, onSubmit]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if ((e as any).isComposing) return;
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
        if (e.key === "Escape") {
          handleCancel();
        }
      },
      [handleSubmit, handleCancel],
    );

    const popupClassName = [
      styles.popup,
      lightMode ? styles.light : "",
      animState === "enter" ? styles.enter : "",
      animState === "entered" ? styles.entered : "",
      animState === "exit" ? styles.exit : "",
      isShaking ? styles.shake : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        ref={popupRef}
        className={popupClassName}
        data-agentation
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          {computedStyles && Object.keys(computedStyles).length > 0 ? (
            <button
              className={styles.headerToggle}
              onClick={() => {
                const wasExpanded = isStylesExpanded;
                setIsStylesExpanded(!isStylesExpanded);
                if (wasExpanded) {
                  originalSetTimeout(() => textareaRef.current?.focus(), 0);
                }
              }}
              type="button"
            >
              <svg
                className={`${styles.chevron} ${isStylesExpanded ? styles.expanded : ""}`}
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.5 10.25L9 7.25L5.75 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className={styles.element}>{element}</span>
            </button>
          ) : (
            <span className={styles.element}>{element}</span>
          )}
          {timestamp && <span className={styles.timestamp}>{timestamp}</span>}
        </div>

        {computedStyles && Object.keys(computedStyles).length > 0 && (
          <div className={`${styles.stylesWrapper} ${isStylesExpanded ? styles.expanded : ""}`}>
            <div className={styles.stylesInner}>
              <div className={styles.stylesBlock}>
                {Object.entries(computedStyles).map(([key, value]) => (
                  <div key={key} className={styles.styleLine}>
                    <span className={styles.styleProperty}>
                      {key.replace(/([A-Z])/g, "-$1").toLowerCase()}
                    </span>
                    : <span className={styles.styleValue}>{value}</span>;
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {selectedText && (
          <div className={styles.quote}>
            &ldquo;{selectedText.slice(0, 80)}
            {selectedText.length > 80 ? "..." : ""}&rdquo;
          </div>
        )}

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          style={{ borderColor: isFocused ? accentColor : undefined }}
          placeholder={placeholder}
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={2}
          onKeyDown={handleKeyDown}
        />

        <div className={styles.actions}>
          {onDelete && (
            <div className={styles.deleteWrapper}>
              <button className={styles.deleteButton} onClick={onDelete} type="button">
                <IconTrash size={22} />
              </button>
            </div>
          )}
          <button className={styles.cancel} onClick={handleCancel}>
            Cancel
          </button>
          <button
            className={styles.submit}
            style={{
              backgroundColor: accentColor,
              opacity: text.trim() ? 1 : 0.4,
            }}
            onClick={handleSubmit}
            disabled={!text.trim()}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    );
  },
);
