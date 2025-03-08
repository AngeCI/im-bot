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

// ID command
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `ID: ${msg.chat.id}`, { reply_parameters: {message_id: msg.message_id} });
});

// Echo command
bot.onText(/\/echo/, (msg) => {
  let replyMsg = msg?.reply_to_message;
  if (replyMsg?.text) {
    bot.sendMessage(msg.chat.id, msg.text, { reply_parameters: {message_id: msg.message_id} });
  } else if (replyMsg?.sticker) {
    bot.sendSticker(msg.chat.id, replyMsg.sticker.file_id, { reply_parameters: {message_id: msg.message_id} });
  } else if (replyMsg?.photo) {
    bot.sendPhoto(msg.chat.id, replyMsg.photo[1].file_id, { reply_parameters: {message_id: msg.message_id} });
  } else {
    bot.sendMessage(msg.chat.id, "No supported formats detected.", { parse_mode: "MarkdownV2", reply_parameters: {message_id: msg.message_id} });
  }
});

// Get file ID command
bot.onText(/\/getfileid/, (msg) => {
  let replyMsg = msg?.reply_to_message;
  if (replyMsg) {
    if (replyMsg?.sticker) {
      bot.sendMessage(msg.chat.id, replyMsg.sticker.file_id, { reply_parameters: {message_id: msg.message_id} });
    } else if (replyMsg?.photo) {
      bot.sendMessage(msg.chat.id, replyMsg.photo[1].file_id, { reply_parameters: {message_id: msg.message_id} });
    } else {
      bot.sendMessage(msg.chat.id, "No picture or sticker is detected.", { reply_parameters: {message_id: msg.message_id} });
    }
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Use reply to supply a parameter.", { reply_parameters: {message_id: msg.message_id} });
  }
});

// Flag command
let flagCalculate = function (code) {
  code = code.toUpperCase();
  return (code.charCodeAt(0) + 127397) + (code.charCodeAt(1) + 127397);
};

bot.onText(/\/flag/, (msg, text) => {
  let isFlagCorrected = false;
  let isFlagConverted = false;
  let code = text.split(" ").splice(0, 1);

  if (code) {
    // code = flagCombine(code);
    // code = flagCorrect(code);

    if (isFlagConverted) {
      bot.sendMessage(msg.chat.id, code, { reply_parameters: {message_id: msg.message_id} });
    } else if (isFlagCorrected) {
      bot.sendMessage(msg.chat.id, `${flagCalculate(code)} = code`, { reply_parameters: {message_id: msg.message_id} });
    } else {
      bot.sendMessage(msg.chat.id, flagCalculate(code), { reply_parameters: {message_id: msg.message_id} });
    }
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Supply a parameter right after the command.", { reply_parameters: {message_id: msg.message_id} });
  }

  isFlagCorrected = false;
  isFlagConverted = false;
});

// Send text command
bot.onText(/\/sendtext/, (msg, text) => {
  args = text.split(" ").splice(0, 1);
  if (args.length > 1) {
    bot.sendMessage(args[0], args[1]);
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Supply two parameters right after the command.", { reply_parameters: {message_id: msg.message_id} });
  }
});

// Send sticker command
bot.onText(/\/sendtext/, (msg, text) => {
  args = text.split(" ").splice(0, 1);
  if (args.length > 1) {
    bot.sendSticker(args[0], args[1]);
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Supply two parameters right after the command.", { reply_parameters: {message_id: msg.message_id} });
  }
});

// Emoji list command
bot.onText(/\/emojilist/, (msg) => {
  bot.sendMessage(msg.chat.id, Object.keys(emojiDict).join(""), { reply_parameters: {message_id: msg.message_id} });
});

// Emoji dictionary command
bot.onText(/\/emojidict/, (msg) => {
  let emoji = [];
  Object.keys(emojiDict).forEach((e) => { // Find emoji in the command first.
    if (msg?.text.match(e)) {
      emoji.push(e);
	} else if (msg?.reply_to_message?.text.match(e)) { // If no match is found, then try to find an emoji in the replies.
      emoji.push(e);
    } else {
      // bot.sendMessage(msg.chat.id, i18nStr[emoji_dict.not_found], { parse_mode: "MarkdownV2", reply_parameters: {message_id: msg.message_id} });
      return; // If no match is found, terminate the function immediately.
    }
  });

  console.info(emoji);
  let output = "";
  emoji.forEach((e) => {
    let emojiDictEntry = emojiDict[e];
    let codepoint = emojiDictEntry.codepoint,
      name = emojiDictEntry.name,
      shortcode = emojiDictEntry.shortcode,
      description = emojiDictEntry.description;
    output += eval("`" + config.emoji_dict_template + "`");
  });

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
