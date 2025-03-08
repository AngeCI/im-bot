"use strict";

const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs").promises;
const path = require("path");
const rootDir = path.join(__dirname, "../../");

let readJsonFile = async function (filePath) {
  try {
    console.info(`Reading ${path.join(rootDir, filePath)}...`);
    const data = await fs.readFile(path.join(rootDir, filePath), "utf-8");
	return JSON.parse(data.replace(/(\/\/[^\n]*\n)|(\/\*[\s\S]*?\*\/)/g, ""));
  } catch (err) {
    console.error(`Error reading ${filePath}: `, err);
    return null;
  }
};

(async () => {
const config = await readJsonFile("config.json", "utf-8");

let users, groups, emojiDict, stdb, bibleConfig, spamConfig; // JSON files
let filePaths = [
  config.account_info_file,
  groups = config.group_info_file,
  emojiDict = config.emoji_dict_file,
  stdb = config.sticker_index_file,
  bibleConfig = config.bible_file,
  spamConfig = config.spam_config_file
];
let configVars = ["users", "groups", "emojiDict", "stdb", "bibleConfig", "spamConfig"];
// let jsonData = await Promise.all(filePaths.map(file => readJsonFile(path.join(__dirname, file))));
let i = 0;
for await (const data of filePaths.map(file => readJsonFile(file, "utf-8"))) {
  eval(`${configVars[i]} = data;`);
  i++;
};

let i18n = {}; // translation strings
config.language_list.forEach(async (e) => {
  i18n[e] = await readJsonFile(`src/res/${e}.json`, "utf-8");
  // Object.defineProperty(i18n, e, { value: await readJsonFile(`src/res/${e}.json`, "utf-8") });
});
// console.info(i18n);

const token = config.bot_tokens.telegram;
const bot = new TelegramBot(token, { polling: true });

// Start command
bot.onText(/\/start/, (msg) => {
  config.tg_start_msg.forEach((e) => {
    bot.sendMessage(msg.chat.id, e, { parse_mode: "MarkdownV2", reply_parameters: {message_id: msg.message_id} });
  });
});

// Help command
bot.onText(/\/help/, (msg) => {
  config.tg_help_msg.forEach((e) => {
    bot.sendMessage(msg.chat.id, e, { parse_mode: "MarkdownV2" });
  });
});

// Emoji list command
bot.onText(/\/emojilist/, (msg) => {
  bot.sendMessage(msg.chat.id, Object.keys(emojiDict).join(""), { reply_parameters: {message_id: msg.message_id} });
});

// Emoji dictionary command
bot.onText(/\/emojidict/, (msg) => {
  let emoji;
  let emojiDictEntry = emojiDict[emoji];
  let codepoint = emojiDictEntry.codepoint,
    name = emojiDictEntry.name,
    shortcode = emojiDictEntry.shortcode,
    description = emojiDictEntry.description;
  let output = eval("`" + config.emoji_dict_template + "`");
  bot.sendMessage(msg.chat.id, output, { parse_mode: "MarkdownV2", reply_parameters: {message_id: msg.message_id} });
});

// Chat history logging
let appendToLogFile = function (filePath, text) {
  fs.appendFile(filePath, `${text}\n`, "utf-8", (err) => {
    if (err)
      console.error("Error appending to file: ", err);
  });
};
})();
