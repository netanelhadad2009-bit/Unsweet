const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to fix manifest merger conflicts between expo-secure-store and AppsFlyer SDK.
 * Both libraries declare dataExtractionRules and fullBackupContent attributes.
 * This plugin adds tools:replace to resolve the conflict.
 */
function withAndroidManifestFix(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Ensure the tools namespace is added
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Get the application element
    const application = androidManifest.manifest.application?.[0];
    if (application) {
      // Add tools:replace attribute to handle conflicts
      application.$['tools:replace'] = 'android:dataExtractionRules,android:fullBackupContent';
    }

    return config;
  });
}

module.exports = withAndroidManifestFix;
