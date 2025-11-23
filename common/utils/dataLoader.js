const fs = require('fs');
const path = require('path');

/**
 * Safely read and parse JSON from disk.
 * @param {string} filePath absolute path to the JSON file
 * @returns {Array|Object} parsed JSON data or an empty array on error
 */
function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to read JSON at ${filePath}:`, err.message);
    return [];
  }
}

/**
 * Load the standard property datasets from the given directory.
 * @param {string} dataDir directory containing property JSON files
 * @returns {{ basics: Array<object>, characteristics: Array<object>, images: Array<object> }}
 */
function loadPropertyDatasets(dataDir) {
  const basicsPath = path.join(dataDir, 'property_basics.json');
  const characteristicsPath = path.join(
    dataDir,
    'property_characteristics.json'
  );
  const imagesPath = path.join(dataDir, 'property_images.json');

  return loadPropertyDatasetsFromFiles({
    basicsPath,
    characteristicsPath,
    imagesPath,
  });
}

/**
 * Load property datasets using explicit file paths.
 * @param {{ basicsPath: string, characteristicsPath: string, imagesPath: string }} paths
 * @returns {{ basics: Array<object>, characteristics: Array<object>, images: Array<object> }}
 */
function loadPropertyDatasetsFromFiles(paths) {
  const { basicsPath, characteristicsPath, imagesPath } = paths;

  return {
    basics: safeReadJson(basicsPath) || [],
    characteristics: safeReadJson(characteristicsPath) || [],
    images: safeReadJson(imagesPath) || [],
  };
}

module.exports = {
  loadPropertyDatasets,
  loadPropertyDatasetsFromFiles,
};
