const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const POD_NAME = 'TPNFacebookSDKAdapter';
const POD_VERSION = '6.4.93';
const MARKER = `pod '${POD_NAME}'`;

module.exports = function withTopOnFacebook(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) return cfg;

      const injection = `use_expo_modules!\n\n  # TopOn Facebook Audience Network adapter (pulls FBAudienceNetwork transitively)\n  pod '${POD_NAME}', '${POD_VERSION}'`;

      if (!contents.includes('use_expo_modules!')) {
        throw new Error(
          '[withTopOnFacebook] Could not find "use_expo_modules!" in Podfile. Plugin injection point missing.'
        );
      }

      contents = contents.replace('use_expo_modules!', injection);
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
