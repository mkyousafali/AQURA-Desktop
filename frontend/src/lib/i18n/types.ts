// Aqura Custom i18n Library
// Built specifically for domain-specific translations (not generic auto-translate)

export interface Translation {
  [key: string]: string | Translation;
}

export interface LocaleData {
  code: string;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  translations: Translation;
  pluralRules: PluralRule[];
  dateFormat: string;
  timeFormat: string;
  currencyFormat: string;
  numberFormat: Intl.NumberFormatOptions;
}

export interface PluralRule {
  count: number | "other";
  form: string;
}

export interface I18nConfig {
  defaultLocale: string;
  supportedLocales: string[];
  fallbackLocale: string;
  detectBrowserLocale: boolean;
  persistLocale: boolean;
}

export interface TranslationContext {
  count?: number;
  gender?: "male" | "female" | "neutral";
  [key: string]: any;
}
