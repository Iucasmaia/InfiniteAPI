export var CompanionWebClientType;
(function (CompanionWebClientType) {
    CompanionWebClientType[CompanionWebClientType["UNKNOWN"] = 0] = "UNKNOWN";
    CompanionWebClientType[CompanionWebClientType["CHROME"] = 1] = "CHROME";
    CompanionWebClientType[CompanionWebClientType["EDGE"] = 2] = "EDGE";
    CompanionWebClientType[CompanionWebClientType["FIREFOX"] = 3] = "FIREFOX";
    CompanionWebClientType[CompanionWebClientType["IE"] = 4] = "IE";
    CompanionWebClientType[CompanionWebClientType["OPERA"] = 5] = "OPERA";
    CompanionWebClientType[CompanionWebClientType["SAFARI"] = 6] = "SAFARI";
    CompanionWebClientType[CompanionWebClientType["ELECTRON"] = 7] = "ELECTRON";
    CompanionWebClientType[CompanionWebClientType["UWP"] = 8] = "UWP";
    CompanionWebClientType[CompanionWebClientType["OTHER_WEB_CLIENT"] = 9] = "OTHER_WEB_CLIENT";
})(CompanionWebClientType || (CompanionWebClientType = {}));
// Use a Map (not a plain object) to avoid prototype-pollution lookups
// where browser names like `toString` or `constructor` would return inherited
// function values instead of CompanionWebClientType. Keys are lowercased and
// the input is lowercased on lookup to handle every casing (Chrome/chrome/CHROME,
// IE/ie/Ie/iE) consistently — matching the normalize-then-lookup pattern used by
// the existing browser-utils helper `getPlatformId`.
const BROWSER_TO_COMPANION_WEB_CLIENT = new Map([
    ['chrome', CompanionWebClientType.CHROME],
    ['edge', CompanionWebClientType.EDGE],
    ['firefox', CompanionWebClientType.FIREFOX],
    ['ie', CompanionWebClientType.IE],
    ['opera', CompanionWebClientType.OPERA],
    ['safari', CompanionWebClientType.SAFARI],
    // Android must declare Chrome (1) for pair-code companions; see the matching
    // `pairPlatformId` override in src/Socket/socket.ts.
    ['android', CompanionWebClientType.CHROME]
]);
export const getCompanionWebClientType = ([os, browserName]) => {
    if (browserName === 'Desktop') {
        return os === 'Windows' ? CompanionWebClientType.UWP : CompanionWebClientType.ELECTRON;
    }
    const key = typeof browserName === 'string' ? browserName.trim().toLowerCase() : '';
    return BROWSER_TO_COMPANION_WEB_CLIENT.get(key) ?? CompanionWebClientType.OTHER_WEB_CLIENT;
};
export const getCompanionPlatformId = (browser) => {
    return getCompanionWebClientType(browser).toString();
};
export const buildPairingQRData = (ref, noiseKeyB64, identityKeyB64, advB64, browser) => {
    // InfiniteAPI keeps the legacy 4-field QR payload (`<ref>,<noise>,<identity>,<adv>`)
    // because:
    // 1. The WhatsApp app QR scanner accepts the bare comma-joined form without the URL prefix.
    // 2. The upstream `URL#<...>,<platformId>` format produced `linked_devices#,<ref>` (extra
    //    leading comma after the fragment) and emitted platform 9 for `Browsers.android()`,
    //    breaking pair-code companions that must declare Chrome (1).
    // The browser argument is preserved for API parity with upstream.
    void browser;
    return [ref, noiseKeyB64, identityKeyB64, advB64].join(',');
};
//# sourceMappingURL=companion-reg-client-utils.js.map