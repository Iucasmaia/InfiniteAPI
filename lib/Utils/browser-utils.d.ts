import type { BrowsersMap } from '../Types/index.js';
/**
 * Browser configuration presets for WhatsApp device registration.
 * Each factory returns a tuple of [platform, browser, version].
 *
 * Versions are automatically detected at module load:
 * - Linux: Reads /etc/os-release for distribution version
 * - macOS: Converts Darwin kernel version to macOS version
 * - Windows: Uses os.release() directly
 *
 * @example
 * // Use Ubuntu preset with auto-detected version
 * const config = Browsers.ubuntu('Chrome')
 * // Returns: ['Ubuntu', 'Chrome', '24.04.1'] (version detected automatically)
 *
 * @example
 * // Use automatic platform and version detection
 * const config = Browsers.appropriate('MyApp')
 * // Returns: ['Mac OS', 'MyApp', '15.2'] (on macOS Sequoia)
 */
export declare const Browsers: BrowsersMap;
/**
 * Exposed OS versions for debugging and logging purposes.
 * These are the versions that will be used by the Browsers presets.
 */
export declare const detectedOSVersions: Readonly<{
    ubuntu: string;
    macOS: string;
    windows: string;
    baileys: string;
}>;
/**
 * Resolves the platform type ID for a given browser name.
 * Uses the WhatsApp protocol buffer definitions for mapping.
 *
 * This function safely handles invalid inputs (null, undefined, non-strings)
 * by returning the default Chrome platform ID.
 *
 * @param browser - Browser identifier (e.g., 'chrome', 'firefox', 'safari').
 *                  Accepts unknown types for runtime safety.
 * @returns Platform type ID as string (defaults to '1' for Chrome)
 *
 * @example
 * getPlatformId('chrome')   // Returns '1'
 * getPlatformId('CHROME')   // Returns '1' (case-insensitive)
 * getPlatformId('firefox')  // Returns platform-specific ID
 * getPlatformId('')         // Returns '1' (default)
 */
export declare const getPlatformId: (browser: unknown) => string;
/**
 * Type guard to check if a value is a valid browser preset key.
 * Useful for external validation before using Browsers presets.
 *
 * Uses Object.prototype.hasOwnProperty to avoid matching inherited
 * properties like 'toString' or 'constructor'.
 *
 * @param value - Value to check
 * @returns True if value is a valid browser preset key ('ubuntu', 'macOS', 'windows', 'baileys', 'appropriate', 'android')
 *
 * @example
 * isValidBrowserPreset('ubuntu')      // true
 * isValidBrowserPreset('macOS')       // true
 * isValidBrowserPreset('invalid')     // false
 * isValidBrowserPreset('toString')    // false (inherited property)
 *
 * @example
 * if (isValidBrowserPreset(userInput)) {
 *   const config = Browsers[userInput]('MyApp')
 * }
 */
/**
 * Checks if the browser tuple represents an Android companion device.
 *
 * @param browser - Browser tuple [os, platform, version]
 * @returns True if platform is 'Android' (case-insensitive)
 */
export declare const isAndroidBrowser: (browser: [string, string, string]) => boolean;
export declare const isValidBrowserPreset: (value: unknown) => value is keyof BrowsersMap;
//# sourceMappingURL=browser-utils.d.ts.map