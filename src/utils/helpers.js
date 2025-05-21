const { ObjectId } = require('mongoose').Types;
const multer = require('multer');
const fs = require('fs').promises;

const getAsBool = (value) => value === 'true' || value === 'True';
function TypeCheck(value) {
  return {
    isUndefined: () => typeof value === 'undefined',
    isNull: () => value === null,
    isBoolean: () => typeof value === 'boolean',
    isNumber: () => typeof value === 'number',
    isString: () => typeof value === 'string',
    isObject: () => typeof value === 'object',
    isArray: () => Array.isArray(value),
    isObjectNotArray: () => typeof value === 'object' && !Array.isArray(value),
    isFunction: () => typeof value === 'function',
    isSymbol: () => typeof value === 'symbol',
    isBigInt: () => typeof value === 'bigint'
  };
}
const dualBodyParser = (req, res, next) => {
  const contentType = req.headers['content-type'];
  if (contentType && contentType.includes('multipart/form-data')) {
    multer().any()(req, res, (err) => {
      if (err) {
        console.error('Error handling form data:', err);
        return res.status(500).send('Internal Server Error');
      }

      return next();
    });
  } else next();
};
function modifyPipelineForEmptyUnwind(pipeline) {
  for (let i = 0; i < pipeline.length; i++) {
    const stage = pipeline[i];
    if (stage.$unwind) {
      const unwindField = stage.$unwind;

      // Replace the original $unwind stage with the modified $unwind stage
      pipeline[i] = {
        $unwind: {
          path: `${unwindField}`,
          preserveNullAndEmptyArrays: true
        }
      };
    }
  }

  return pipeline;
}
function toObjectId(id) {
  return new ObjectId(id);
}
const logResponseTime = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${duration}ms`);
  });
  next();
};

// Read File Async
const readFileAsync = async (filePath, encoding = 'utf-8') => {
  try {
    const content = await fs.readFile(filePath, encoding);
    return content;
  } catch (error) {
    throw new Error(`Error reading file: ${error.message}`);
  }
};

// Write File Async
const writeFileAsync = async (filePath, data, encoding = 'utf-8') => {
  try {
    await fs.writeFile(filePath, data, encoding);
    console.log('File written successfully!');
  } catch (error) {
    throw new Error(`Error writing file: ${error.message}`);
  }
};

// Delete File Async
const deleteFileAsync = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log('File deleted successfully!');
  } catch (error) {
    throw new Error(`Error deleting file: ${error.message}`);
  }
};

// Check if File Exists Async
const fileExistsAsync = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};
const extractFields = (sourceObject, fields) => {
  const extractedData = {};

  fields.reduce((acc, key) => {
    if (sourceObject[key]) {
      acc[key] = sourceObject[key];
    }
    return acc;
  }, extractedData);

  return extractedData;
};
const removeFields = (sourceObject, fields) => {
  const filteredData = { ...sourceObject };

  fields.forEach((key) => {
    if (filteredData[key]) {
      delete filteredData[key];
    }
  });

  return filteredData;
};

// Middleware to Log Requests

module.exports = {
  getAsBool,
  TypeCheck,
  modifyPipelineForEmptyUnwind,
  toObjectId,
  readFileAsync,
  writeFileAsync,
  deleteFileAsync,
  fileExistsAsync,
  logResponseTime,
  extractFields,
  removeFields,
  dualBodyParser
};
