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

// Get all whitelisted IDs
const whitelistedGroups = [];
for (let key in groups) {
  whitelistedGroups.push(groups[key].telegram);
};

const whitelistedUsers = [];
for (let key in users) {
  whitelistedUsers.push(users[key].telegram);
};

// Whitelist checking
let isWhitelisted = function (id, action) {
  if (config.whitelist_enabled && whitelistedGroups.indexOf(id) == -1) {
    return false;
  } else {
    return true;
  };
};

let getTranslationString = function (key, lang) {
  if (i18n[lang][key]) {
    return ;
  } else {
    return key;
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

// Start command
bot.onText(/\/start/, (msg) => {
  config.tg_start_msg.forEach((e) => {
    bot.sendMessage(msg.chat.id, e, replyParam(msg.message_id));
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
  bot.sendMessage(msg.chat.id, `ID: ${msg.chat.id}`, replyParam(msg.message_id));
});

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
  let code = text.split(" ").splice(0, 1);

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
  args = text.split(" ").splice(0, 1);
  if (args.length > 1) {
    bot.sendMessage(args[0], args[1]);
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Supply two parameters right after the command.", replyParam(msg.message_id));
  }
});

// Send sticker command
bot.onText(/\/sendtext/, (msg, text) => {
  args = text.split(" ").splice(0, 1);
  if (args.length > 1) {
    bot.sendSticker(args[0], args[1]);
  } else {
    bot.sendMessage(msg.chat.id, "No parameter provided. Supply two parameters right after the command.", replyParam(msg.message_id));
  }
});

// Emoji list command
bot.onText(/\/emojilist/, (msg) => {
  bot.sendMessage(msg.chat.id, Object.keys(emojiDict).join(""), replyParam(msg.message_id));
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
    let codepoint = emojiDictEntry.codepoint,
      name = emojiDictEntry.name,
      shortcode = emojiDictEntry.shortcode.join(", "),
      description = emojiDictEntry.description;
    output += eval("`" + config.emoji_dict_template + "`").replace(/_/g, "\\_");
  });

  bot.sendMessage(msg.chat.id, output, replyParam(msg.message_id));
});

// Chat history logging
let appendToLogFile = function (filePath, text) {
  fs.access(filePath, fs.constants.F_OK)
  .then(() => {
    fs.appendFile(filePath, `${text}\n`, "utf-8");
  })
  .catch((err) => {
    if (err.code === "ENOENT") {
      fs.writeFile(filePath, `${text}\n`, "utf-8"); // File not exist, create the file when writing
    } else {
      console.error(`Error appending to file ${filePath}: `, err);
    };
  });
};

bot.on("error", (err) => {
  console.log(`${err}: ${err.code}, ${err.response}, ${err.response.body}`);
});

bot.on("polling_error", (err) => {
  console.log(`${err}: ${err.code}, ${err.response}, ${err.response.body}`);
});

bot.on("webhook_error", (err) => {
  console.log(`${err}: ${err.code}, ${err.response}, ${err.response.body}`);
});

/*bot.on("message", async (msg) => {
  await appendToLogFile(path.join(config.chat_history_directory, `${msg.chat.id}.json`), JSON.stringify());
});*/
})();
