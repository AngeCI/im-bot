"use strict";

const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs").promises;
const path = require("path");
const rootDir = path.join(__dirname, "../../");

let readJsonFile = async function (filePath, encoding = "utf-8") {
  try {
    console.info(`Reading ${path.join(rootDir, filePath)}...`);
    const data = await fs.readFile(path.join(rootDir, filePath), encoding);
    return JSON.parse(data.replace(/(\/\/[^\n]*\n)|(\/\*[\s\S]*?\*\/)/g, "")); // Clean up the “comments” before parsing JSON
  } catch (err) {
    console.error(`Error reading ${filePath}: `, err);
    return null;
  };
};

(async () => {
const config = await readJsonFile("config.json", "utf-8");

// JSON files
let users, groups, emojiDict, stdb, bibleConfig, spamConfig;
let filePaths = [
  config.account_info_file,
  groups = config.group_info_file,
  emojiDict = config.emoji_dict_file,
  stdb = config.sticker_index_file,
  bibleConfig = config.bible_file,
  spamConfig = config.spam_config_file
];
let configVars = ["users", "groups", "emojiDict", "stdb", "bibleConfig", "spamConfig"];
let i = 0;
for await (const data of filePaths.map(file => readJsonFile(file, "utf-8"))) {
  eval(`${configVars[i]} = data;`);
  i++;
};

// translation strings
let i18n = {};
config.language_list.forEach(async (e) => {
  i18n[e] = await readJsonFile(`src/res/${e}.json`, "utf-8");
});

const token = config.bot_tokens.telegram;
const bot = new TelegramBot(token, { polling: true });

// Get all whitelisted IDs & compile reverse look-up tables for users and groups
const tgReverseLookupTable = {};
const whitelistedGroups = [];
for (let key in groups) {
  whitelistedGroups.push(groups[key].telegram);
  tgReverseLookupTable[groups[key].telegram] = key;
};

const whitelistedUsers = [];
for (let key in users.users) {
  whitelistedUsers.push(users.users[key].telegram);
  tgReverseLookupTable[users.users[key].telegram] = key;
};
for (let key in users.bots) {
  whitelistedUsers.push(users.bots[key].telegram);
  tgReverseLookupTable[users.bots[key].telegram] = key;
};

// console.info(tgReverseLookupTable);

// Whitelist checking
let isWhitelisted = function (id, action) {
  if (config.whitelist_enabled && whitelistedGroups.indexOf(id) == -1 && whitelistedUsers.indexOf(id) == -1) {
    return false;
  } else {
    return true;
  };
};

// Strict whitelist checking
let isStrictWhitelisted = function (id, action) {
  if (config.strict_whitelist_telegram.indexOf(id) == -1) {
    return false;
  } else {
    return true;
  };
};

let getTranslationString = function (key, lang) {
  if (i18n[lang][key]) {
    return i18n[lang][key];
  } else {
    return key;
  };
};

let getChatLang = function (id) {
  let lang = groups[tgReverseLookupTable[id]]?.lang;
  if (lang && config.language_list.indexOf(lang) != -1) {
    return lang;
  } else {
    return "en";
  };
};

let replyParam = function (id) {
  return {
    parse_mode: "MarkdownV2",
    reply_parameters: {
      message_id: id
    }
  };
};

let checkWhitelistAndReply = function (msg, action, content, params = {}) {
  if (isWhitelisted(msg.chat.id, action)) {
    if (action != "debug_commands" || isStrictWhitelisted(msg.chat.id)) { // Check a stricter whitelist before processing debug commands.
      bot.sendMessage(msg.chat.id, content, replyParam(msg.message_id));
    } else { // Refuse to execute debug commands.
      bot.sendMessage(id, getTranslationString("general.action_not_allowed", getChatLang(msg.chat.id)), replyParam(msg.message_id));
    };
  } else {
    bot.sendMessage(msg.chat.id, getTranslationString("general.action_not_allowed", getChatLang(msg.chat.id)), replyParam(msg.message_id));
  };
};

let checkWhitelistAndMassReply = function (msg, action, content, params = {}) {
  if (isWhitelisted(msg.chat.id, action)) {
    if (action != "debug_commands" || isStrictWhitelisted(msg.chat.id)) { // Check a stricter whitelist before processing debug commands.
      content.forEach((e) => {
        bot.sendMessage(msg.chat.id, e, replyParam(msg.message_id));
      });
    } else { // Refuse to execute debug commands.
      bot.sendMessage(msg.chat.id, getTranslationString("general.action_not_allowed", getChatLang(msg.chat.id)), replyParam(msg.message_id));
    };
  } else {
    bot.sendMessage(msg.chat.id, getTranslationString("general.action_not_allowed", getChatLang(msg.chat.id)), replyParam(msg.message_id));
  };
};

let checkWhitelistAndNotReply = function (msg, action, content, params = {}) {
  if (isWhitelisted(msg.chat.id, action)) {
    if (action != "debug_commands" || isStrictWhitelisted(msg.chat.id)) { // Check a stricter whitelist before processing debug commands.
      bot.sendMessage(msg.chat.id, content, { parse_mode: "MarkdownV2" });
    } else { // Refuse to execute debug commands.
      bot.sendMessage(id, getTranslationString("general.action_not_allowed", getChatLang(msg.chat.id)), params);
    };
  } else {
    bot.sendMessage(msg.chat.id, getTranslationString("general.action_not_allowed", getChatLang(msg.chat.id)), params);
  };
};

let checkWhitelistAndMassNotReply = function (msg, action, content, params = {}) {
  if (isWhitelisted(msg.chat.id, action)) {
    if (action != "debug_commands" || isStrictWhitelisted(msg.chat.id)) { // Check a stricter whitelist before processing debug commands.
      content.forEach((e) => {
        bot.sendMessage(msg.chat.id, e, { parse_mode: "MarkdownV2" });
      });
    } else { // Refuse to execute debug commands.
      bot.sendMessage(msg.chat.id, getTranslationString("general.action_not_allowed", getChatLang(msg.chat.id)), params);
    };
  } else {
    bot.sendMessage(msg.chat.id, getTranslationString("general.action_not_allowed", getChatLang(msg.chat.id)), params);
  };
};

let checkWhitelistAndProceed = function (msg, action, passFunc, rejectFunc = (msg) => {
  bot.sendMessage(msg.chat.id, getTranslationString("general.action_not_allowed", getChatLang(msg.chat.id)), params);
}, params = {}) {
  if (isWhitelisted(msg.chat.id, action)) {
    if (action != "debug_commands" || isStrictWhitelisted(msg.chat.id)) { // Check a stricter whitelist before processing debug commands.
      if (action != "checkuser" || isStrictWhitelisted(msg.from.id)) {
        passFunc(msg);
      } else {
        rejectFunc(msg)
      };
    } else { // Refuse to execute debug commands.
      rejectFunc(msg);
    };
  } else {
    rejectFunc(msg);
  };
};

/*
bot.on("message", (msg) => {
  if (isWhitelisted(msg.chat.id)) {
  } else {
    return;
  };
});
*/

/** GENERAL COMMANDS **/
// Start command
bot.onText(/\/start/, (msg) => {
  checkWhitelistAndMassReply(msg, "general", config.tg_start_msg);
});

// Help command
bot.onText(/\/help/, (msg) => {
  checkWhitelistAndMassNotReply(msg, "general", config.tg_help_msg);
});

// ID command
bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `Chat ID: ${msg.chat.id}\nUser ID: ${msg.from.id}`.replaceAll("-", "\\-"), replyParam(msg.message_id));
});

/** DEBUG COMMANDS **/
// Echo command
bot.onText(/\/echo/, (msg) => {
  let replyMsg = msg?.reply_to_message;
  if (replyMsg?.text) {
    bot.sendMessage(msg.chat.id, msg.text, replyParam(msg.message_id));
  } else if (replyMsg?.sticker) {
    bot.sendSticker(msg.chat.id, replyMsg.sticker.file_id, replyParam(msg.message_id));
  } else if (replyMsg?.photo) {
    bot.sendPhoto(msg.chat.id, replyMsg.photo[1].file_id, replyParam(msg.message_id));
  } else {
    bot.sendMessage(msg.chat.id, "No supported formats detected.", replyParam(msg.message_id));
  }
});

// Get file ID command
bot.onText(/\/getfileid/, (msg) => {
  let replyMsg = msg?.reply_to_message;
  if (replyMsg) {
    if (replyMsg?.sticker) {
      bot.sendMessage(msg.chat.id, replyMsg.sticker.file_id, replyParam(msg.message_id));
    } else if (replyMsg?.photo) {
      bot.sendMessage(msg.chat.id, replyMsg.photo[1].file_id, replyParam(msg.message_id));
    } else {
      bot.sendMessage(msg.chat.id, "No picture or sticker is detected.", replyParam(msg.message_id));
    }
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Use reply to supply a parameter.", replyParam(msg.message_id));
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
  let code = text.input.split(" ").splice(0, 1);

  if (code) {
    // code = flagCombine(code);
    // code = flagCorrect(code);

    if (isFlagConverted) {
      bot.sendMessage(msg.chat.id, code, replyParam(msg.message_id));
    } else if (isFlagCorrected) {
      bot.sendMessage(msg.chat.id, `${flagCalculate(code)} = code`, replyParam(msg.message_id));
    } else {
      bot.sendMessage(msg.chat.id, flagCalculate(code), replyParam(msg.message_id));
    }
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Supply a parameter right after the command.", replyParam(msg.message_id));
  }

  isFlagCorrected = false;
  isFlagConverted = false;
});

// Send text command
bot.onText(/\/sendtext/, (msg, text) => {
  let args = text.input.split(" ").splice(0, 1);
  if (args.length > 1) {
    bot.sendMessage(args[0], args[1]);
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Supply two parameters right after the command.", replyParam(msg.message_id));
  }
});

// Send sticker command
bot.onText(/\/sendtext/, (msg, text) => {
  let args = text.input.split(" ").splice(0, 1);
  if (args.length > 1) {
    bot.sendSticker(args[0], args[1]);
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Supply two parameters right after the command.", replyParam(msg.message_id));
  }
});

// Forward command
// Todo

// Forward-To command
// Todo

/** CHECKUSER COMMANDS **/
let outputUserInfo = function (id, platform, wiki = false) {
  let str = "";
  switch (platform) {
    case 0: { // Telegram
      let user = users.users[tgReverseLookupTable[id]];
	  if (user) {
        if (user.telegram_username) {
          str += `Telegram: [${user.telegram}](tg://user?id=${user.telegram}) \\(@${user.telegram_username.replaceAll("_", "\\_")}\\)\n`;
        } else {
          str += `Telegram: [${user.telegram}](tg://user?id=${user.telegram})\n`;
        };      
        if (user.discord) {
		  const discordId = ((BigInt(user.discord[0]) << 32n) + BigInt(user.discord[1])).toString();
          str += `Discord: ${discordId} \\(${user.discord_username.replaceAll("_", "\\_")}\\)\n`;
        };      
        /*if (wiki) {
          str += ``;
        };*/
        return str;
	  } else if (user = users.bot[tgReverseLookupTable[id]]) {
	    str += `Telegram: [${user.telegram}](tg://user?id=${user.telegram}) \\(@${user.telegram_username.replaceAll("_", "\\_")}\\)\n`;      
        if (user.discord) {
		  const discordId = ((BigInt(user.discord[0]) << 32n) + BigInt(user.discord[1])).toString();
          str += `Discord: ${discordId} \\(${user.discord_username.replaceAll("_", "\\_")}\\)\n`;
        }; 
	  };
      break;
    };
    case 1: { // Discord
      // Todo
      break;
    };
    case 2: { // Matrix
      // Todo
      break;
    };
  };
};

bot.onText(/\/checkuser/, (msg, text) => {
  checkWhitelistAndProceed(msg, "checkuser", () => {
    let userId = text.input.split(" ")[1];
    let id, wiki; // Processed ID
    const srcChatKey = tgReverseLookupTable[msg.chat.id];
    if (groups[tgReverseLookupTable[msg.chat.id]]) { // From a group
      wiki = groups[tgReverseLookupTable[msg.chat.id]].user_wiki_info;
    } else { // From a DM
      wiki = true;
    };
    console.debug(`Checkuser: ${userId}, ${wiki}`);
    if (userId.match(/^\d+$/)){ // plain Telegram UID
      id = parseInt(userId);
      if (id < Number.MAX_SAFE_INTEGER) {
        bot.sendMessage(msg.chat.id, outputUserInfo(id, 0, wiki), replyParam(msg.message_id));
      } else { // Larger than Number.MAX_SAFE_INTEGER, treat as Discord UID
        bot.sendMessage(msg.chat.id, outputUserInfo(id, 1, wiki), replyParam(msg.message_id));
      };
    } else if (userId.match(/^tg\d+$/)) { // Telegram UID with “tg” prefix
      bot.sendMessage(msg.chat.id, outputUserInfo(parseInt(userId.match(/^tg(\d+)$/)[1]), 0, wiki), replyParam(msg.message_id));
    } else if (userId.match(/^tgx[\dABCDEFabcdef]+$/)) { // Telegram UID with “tgx” prefix
      bot.sendMessage(msg.chat.id, outputUserInfo(parseInt("0x" + userId.match(/^tgx(\d+)$/)[1]), 0, wiki), replyParam(msg.message_id));
    } else if (userId.match(/^dc\d+$/)) { // Discord UID with “dc” prefix
      bot.sendMessage(msg.chat.id, outputUserInfo(parseInt(userId.match(/^dc(\d+)$/)[1]), 1, wiki), replyParam(msg.message_id));
    } else if (userId.match(/^dcx[\dABCDEFabcdef]+$/)) { // Discord UID with “dcx” prefix
      bot.sendMessage(msg.chat.id, outputUserInfo(parseInt("0x" + userId.match(/^dcx(\d+)$/)[1]), 1, wiki), replyParam(msg.message_id));
    } else if (userId.match(/^.+:.+$/)) { // Matrix UID
      id = userId[0] == "@" ? userId : "@" + userId;
      bot.sendMessage(msg.chat.id, outputUserInfo(id, 2, wiki), replyParam(msg.message_id));
    } else {
      bot.sendMessage(msg.chat.id, "Cannot parse user ID.", replyParam(msg.message_id));
    };
  });
});

/** EMOJI DICTIONARY COMMANDS **/
// Emoji list command
bot.onText(/\/emojilist/, (msg) => {
  checkWhitelistAndReply(msg, "emoji_dict", Object.keys(emojiDict).join(""));
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

  let output = "";
  emoji.forEach((e) => {
    let emojiDictEntry = emojiDict[e];
    emojiDictEntry.shortcode.forEach((e, i) => {
      emojiDictEntry.shortcode[i] = "`:" + e + ":`";
    });
    let codepoint = emojiDictEntry.codepoint,
      name = emojiDictEntry.name,
      shortcode = emojiDictEntry.shortcode.join(", "),
      description = emojiDictEntry.description;
    output += eval("`" + config.emoji_dict_template + "`").replace(/_/g, "\\_");
  });

  bot.sendMessage(msg.chat.id, output, replyParam(msg.message_id));
});

// Chat history logging
let appendToLogFile = async function (filePath, text) {
  try {
    await fs.mkdir(path.join(rootDir, path.dirname(filePath)), { recursive: true });
    await fs.appendFile(path.join(rootDir, filePath), `${text}\n`, { encoding: "utf-8", flag: "a" });
    console.debug(`Successfully wrote to file ${path.join(rootDir, filePath)}`);
  } catch (err) {
    console.error(`Error writing to file ${path.join(rootDir, filePath)}: `, err);
  };
};

bot.on("error", (err) => {
  console.error(`${err}: ${err.code}, ${err.response}, ${err.response?.body}`);
});

bot.on("polling_error", (err) => {
  console.error(`${err}: ${err.code}, ${err.response}, ${err.response?.body}`);
});

bot.on("webhook_error", (err) => {
  console.error(`${err}: ${err.code}, ${err.response}, ${err.response?.body}`);
});

bot.on("message", async (msg) => {
  await appendToLogFile(path.join(config.chat_history_directory, `${msg.chat.id}.json`), JSON.stringify(msg));
});
})();
