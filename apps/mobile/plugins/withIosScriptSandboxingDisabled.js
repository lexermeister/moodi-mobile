const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withIosScriptSandboxingDisabled(config) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const projectConfigurationListId = project.getFirstProject().firstProject.buildConfigurationList;
    const configurationList = project.pbxXCConfigurationList()[projectConfigurationListId];
    const configurations = project.pbxXCBuildConfigurationSection();

    for (const { value } of configurationList.buildConfigurations) {
      configurations[value].buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
    }

    return modConfig;
  });
};
