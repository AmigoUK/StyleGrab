/**
 * Version badge shown next to the app name, so a user filing a report can name
 * the build they are on without digging through chrome://extensions. The text
 * is selectable as one unit to make it easy to copy.
 */
export function AppVersion() {
  const version = chrome.runtime.getManifest().version;
  return <span class="app-version">v{version}</span>;
}
