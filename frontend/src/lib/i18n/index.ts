import { writable, derived, get } from "svelte/store";
import type { LocaleData, I18nConfig, TranslationContext } from "./types";
import { englishLocale } from "./locales/en";
import { arabicLocale } from "./locales/ar";

// Available locales
const locales: Record<string, LocaleData> = {
  en: englishLocale,
  ar: arabicLocale,
};

// Configuration
const defaultConfig: I18nConfig = {
  defaultLocale: "ar",
  supportedLocales: ["en", "ar"],
  fallbackLocale: "ar",
  detectBrowserLocale: false,
  persistLocale: true,
};

// Current locale store
export const currentLocale = writable<string>(defaultConfig.defaultLocale);

// Derived store for current locale data
export const localeData = derived(
  currentLocale,
  ($currentLocale) =>
    locales[$currentLocale] || locales[defaultConfig.fallbackLocale],
);

// Initialize i18n system
export function initI18n(config: Partial<I18nConfig> = {}) {
  const mergedConfig = { ...defaultConfig, ...config };

  let initialLocale = mergedConfig.defaultLocale;

  // Detect browser locale if enabled
  if (mergedConfig.detectBrowserLocale && typeof window !== "undefined") {
    const browserLocale = navigator.language.split("-")[0];
    if (mergedConfig.supportedLocales.includes(browserLocale)) {
      initialLocale = browserLocale;
    }
  }

  // Load persisted locale if available
  if (mergedConfig.persistLocale && typeof window !== "undefined") {
    const persistedLocale = localStorage.getItem("aqura-locale");
    if (
      persistedLocale &&
      mergedConfig.supportedLocales.includes(persistedLocale)
    ) {
      initialLocale = persistedLocale;
    }
  }

  currentLocale.set(initialLocale);

  // Apply RTL/LTR direction to document
  currentLocale.subscribe((locale) => {
    const localeData = locales[locale];
    if (typeof document !== "undefined" && localeData) {
      document.documentElement.dir = localeData.direction;
      document.documentElement.lang = locale;

      // Apply Arabic font class if needed
      if (locale === "ar") {
        document.documentElement.classList.add("font-arabic");
      } else {
        document.documentElement.classList.remove("font-arabic");
      }
    }

    // Persist locale
    if (mergedConfig.persistLocale && typeof window !== "undefined") {
      localStorage.setItem("aqura-locale", locale);
    }
  });
}

// Get translation by key path
export function t(keyPath: string, context: TranslationContext = {}): string {
  const locale = get(localeData);
  const keys = keyPath.split(".");

  let value: any = locale.translations;
  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      // Fallback to English if key not found
      const fallbackLocale = locales[defaultConfig.fallbackLocale];
      let fallbackValue: any = fallbackLocale.translations;
      for (const fallbackKey of keys) {
        if (
          fallbackValue &&
          typeof fallbackValue === "object" &&
          fallbackKey in fallbackValue
        ) {
          fallbackValue = fallbackValue[fallbackKey];
        } else {
          console.warn(`Translation key not found: ${keyPath}`);
          return keyPath; // Return key path if translation not found
        }
      }
      value = fallbackValue;
      break;
    }
  }

  if (typeof value !== "string") {
    console.warn(`Translation key is not a string: ${keyPath}`);
    return keyPath;
  }

  // Handle pluralization
  if (context.count !== undefined) {
    const pluralRule = locale.pluralRules.find((rule) => {
      if (rule.count === "other") return true;
      return rule.count === context.count;
    });

    if (pluralRule) {
      const pluralKey = `${keyPath}.${pluralRule.form}`;
      const pluralValue = getPluralTranslation(pluralKey, locale);
      if (pluralValue) {
        value = pluralValue;
      }
    }
  }

  // Handle interpolation
  return interpolate(value, context);
}

// Helper function to get plural translation
function getPluralTranslation(
  keyPath: string,
  locale: LocaleData,
): string | null {
  const keys = keyPath.split(".");
  let value: any = locale.translations;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      return null;
    }
  }

  return typeof value === "string" ? value : null;
}

// Handle string interpolation
function interpolate(template: string, context: TranslationContext): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return context[key]?.toString() || match;
  });
}

// Switch locale
export function switchLocale(locale: string) {
  if (locales[locale]) {
    currentLocale.set(locale);
  } else {
    console.warn(`Locale not supported: ${locale}`);
  }
}

// Get available locales
export function getAvailableLocales(): LocaleData[] {
  return Object.values(locales);
}

// Check if locale is RTL
export function isRTL(locale?: string): boolean {
  const targetLocale = locale || get(currentLocale);
  const localeData = locales[targetLocale];
  return localeData?.direction === "rtl";
}

// Format number according to locale
export function formatNumber(number: number, locale?: string): string {
  const targetLocale = locale || get(currentLocale);
  const localeData = locales[targetLocale];

  return new Intl.NumberFormat(targetLocale, localeData.numberFormat).format(
    number,
  );
}

// Format date according to locale
export function formatDate(date: Date, locale?: string): string {
  const targetLocale = locale || get(currentLocale);

  return new Intl.DateTimeFormat(targetLocale).format(date);
}

// Format currency according to locale
export function formatCurrency(
  amount: number,
  currency = "USD",
  locale?: string,
): string {
  const targetLocale = locale || get(currentLocale);

  return new Intl.NumberFormat(targetLocale, {
    style: "currency",
    currency,
  }).format(amount);
}

// Export the main translation function as default
export default t;

// Create reactive translation store
export const _ = derived(
  localeData,
  ($localeData) => (keyPath: string, context: TranslationContext = {}): string => {
    const keys = keyPath.split(".");

    let value: any = $localeData.translations;
    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = value[key];
      } else {
        // Fallback to English if key not found
        const fallbackLocale = locales[defaultConfig.fallbackLocale];
        let fallbackValue: any = fallbackLocale.translations;
        for (const fallbackKey of keys) {
          if (
            fallbackValue &&
            typeof fallbackValue === "object" &&
            fallbackKey in fallbackValue
          ) {
            fallbackValue = fallbackValue[fallbackKey];
          } else {
            console.warn(`Translation key not found: ${keyPath}`);
            return keyPath; // Return key path if translation not found
          }
        }
        value = fallbackValue;
        break;
      }
    }

    if (typeof value !== "string") {
      console.warn(`Translation key is not a string: ${keyPath}`);
      return keyPath;
    }

    // Handle pluralization
    if (context.count !== undefined) {
      const pluralRule = $localeData.pluralRules.find((rule) => {
        if (rule.count === "other") return true;
        return rule.count === context.count;
      });

      if (pluralRule) {
        const pluralKey = `${keyPath}.${pluralRule.form}`;
        const pluralValue = getPluralTranslation(pluralKey, $localeData);
        if (pluralValue) {
          value = pluralValue;
        }
      }
    }

    // Handle interpolation
    return interpolate(value, context);
  }
);

// Export getTranslation as an alias to t for compatibility
export const getTranslation = t;

// Re-export the locale store as well
export const locale = currentLocale;
