const fs = require('node:fs');
const path = require('node:path');

function createJsonStore(fileName, initialValue) {
  const directory = process.env.CINEBOOK_DATA_DIR
    ? path.resolve(process.env.CINEBOOK_DATA_DIR)
    : path.join(__dirname, '..', 'data');
  const filePath = path.join(directory, fileName);
  fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialValue, null, 2));
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read CineBook store "${fileName}": ${error.message}`);
  }

  return {
    get: () => data,
    save: () => {
      const tempPath = `${filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
      fs.renameSync(tempPath, filePath);
    },
  };
}

module.exports = { createJsonStore };
