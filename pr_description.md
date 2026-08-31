🧪 Add tests for session.ts IP management

🎯 **What:** The testing gap addressed
This PR addresses missing unit tests for the `setServerIp` and `getServerIp` functionalities in `src/lib/session.ts`, ensuring interactions with `localStorage` behave correctly. Additionally, testing setup was improved by introducing `fake-indexeddb` to allow IndexedDB dependencies (`idb`) to load safely in the `jsdom` testing environment, and Vitest versions were corrected in `package.json` to valid releases to allow tests to run properly.

📊 **Coverage:** What scenarios are now tested
- `setServerIp`: Valid IP address setting.
- `setServerIp`: Empty string input (removes IP).
- `setServerIp`: Undefined input (removes IP).
- `setServerIp`: Null input (removes IP).
- `getServerIp`: Retrieval of a saved IP.
- `getServerIp`: Fallback to default IP if none is saved.

✨ **Result:** The improvement in test coverage
The critical IP management utilities are now fully covered by tests, improving safety for future refactoring. All unit tests successfully pass with a proper `jsdom` + mock DB environment.
