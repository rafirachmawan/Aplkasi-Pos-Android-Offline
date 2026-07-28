const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidRepositories(config) {
  return withProjectBuildGradle(config, (config) => {
    config.modResults.contents = config.modResults.contents.replace(
      /allprojects \{[\s\S]*?repositories \{/,
      `allprojects {\n    buildscript {\n        repositories {\n            google()\n            mavenCentral()\n        }\n    }\n    repositories {\n        google()\n        mavenCentral()`
    );

    // Hilangkan semua jcenter HTTP dari seluruh project (termasuk library)
    config.modResults.contents += `

// Forcing all subprojects to use secure repositories and avoid jcenter HTTP errors
allprojects {
    buildscript {
        repositories {
            google()
            mavenCentral()
        }
    }
    repositories {
        google()
        mavenCentral()
    }
    
    // Memaksa resolusi untuk error HTTP
    tasks.withType(JavaCompile) {
        options.compilerArgs << "-Xlint:deprecation"
    }
}
`;
    return config;
  });
};
