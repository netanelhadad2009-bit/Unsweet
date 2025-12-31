// Dynamic Expo config that passes environment variables to the app
// This ensures EXPO_PUBLIC_* variables are available in both local and EAS builds

module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      // Pass OpenAI API key through Expo Constants
      // This will be accessible via Constants.expoConfig?.extra?.openaiApiKey
      openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    },
  };
};
