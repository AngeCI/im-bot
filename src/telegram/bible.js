"use strict";

const fs = require("fs").promises;
const path = require("path");
const rootDir = path.join(__dirname, "../../");

let readJsonFile = async function (filePath) {
  try {
    console.info(`Reading ${path.join(rootDir, filePath)}...`);
    const data = await fs.readFile(path.join(rootDir, filePath), "utf-8");
	return JSON.parse(data.replace(/(\/\/[^\n]*\n)|(\/\*[\s\S]*?\*\/)/g, "")); // Clean up the “comments” before parsing JSON
  } catch (err) {
    console.error(`Error reading ${filePath}: `, err);
    return null;
  };
};

let readList = async function (filePath) {
  const metaData = await readJsonFile(filePath, "utf-8");

  const fileList = [];
  for (const id in metaData.id) {
    fileList.push(metaData[id].file);
  };
  /*
  const formatList = [];
  for (const format in metaData.id) {
    formatList.push(metaData[id].format);
  };
  */

  const files = [];
  for await (const data of fileList.map(file => fs.readFile(path.join(rootDir, file)))) {
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    files.push(buffer);
  };

  return {
    "metaData": metaData,
    // "id": meteData.id,
    // "format": formatList,
    "files": files
  };
};

let parseBinary = function (buffer, format = 0) {
  if (format & 2) { // Format 2
    let rawEntries = [];
    new TextDecoder().decode(buffer).split("\r\n").forEach((e) => {
      rawEntries.push(e.split(","));
    });

    let entries = [];
    const keys = rawEntries.splice(0, 1)[0];

    rawEntries.forEach((row) => {
      let obj = {};
      row.forEach((e, i) => {
        if ((i != 6 && i != 7) && !isNaN(parseInt(e))) { // Numbers
          obj[keys[i]] = parseInt(e);
        } else if (i == 7) { // Dates
          obj[keys[i]] = (new Date(e).getTime() - 60000 * new Date().getTimezoneOffset()) / 86400000;
        } else { // Text
          obj[keys[i]] = e;
        }
      });
      entries.push(obj);
    });

    return entries;
  } else if (format & 4) { // Format 4
    
  } else { // Format 0
    return JSON.parse(new TextDecoder().decode(buffer));
  };
};
