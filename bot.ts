import type { KeyboardButton } from "@grammyjs/types";
import {
  Bot,
  Context,
  InlineKeyboard,
  InputFile,
  Keyboard,
  session,
  SessionFlavor,
} from "grammy";
import renderers, { Renderer } from "./render.js";
import * as codecs from "@astropub/codecs";
import * as db from "./db.js";
import secret from "./secret.js";
import md5 from "md5";

enum Step {
  INIT,
  START,
  SELECTED_TYPE,
  SELECTED_SUBTYPE,
}

type SessionData =
  | { step: Step.INIT }
  | { step: Step.START }
  | { step: Step.SELECTED_TYPE; styles: Record<string, Renderer> }
  | { step: Step.SELECTED_SUBTYPE; renderer: Renderer; args: string[] };

function buildKeyboards(input: Record<string, Record<string, any>>) {
  const root = new Keyboard();
  const menus: Record<string, KeyboardButton[][]> = {};
  for (const [key, substyles] of Object.entries(input)) {
    root.text(key).row();
    const menu = new Keyboard();
    let em = 3;
    for (const subkey of Object.keys(substyles)) {
      menu.text(subkey);
      if (--em == 0) {
        em = 3;
        menu.row();
      }
    }
    if (em != 3) menu.row();
    menus[key] = menu.text("reset").row().build();
  }
  menus[""] = root.text("reset").row().build();
  return menus;
}

const menus = buildKeyboards(renderers);

type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(secret.token);

bot.use(session({ initial: () => ({ step: Step.INIT } as SessionData) }));

bot.on("inline_query", async (ctx) => {
  const query = ctx.inlineQuery.query.trim();
  const results: any[] = [];
  const user = ctx.from.id;
  if (query == "" || !db.checkStickerCache(user, query)) {
    for (const id of db.getStickerCache(user)) {
      results.push({
        type: "sticker",
        id: md5(id),
        sticker_file_id: id,
      });
    }
  } else {
    results.push({
      type: "sticker",
      id: md5(query),
      sticker_file_id: query,
    });
  }
  await ctx.answerInlineQuery(results, {
    cache_time: 20,
    is_personal: true,
    switch_pm_text: "Create Your Sticker",
    switch_pm_parameter: "create",
  });
});

const pm = bot.filter((ctx) => ctx.chat?.type === "private");

pm.command("start", async (ctx) => {
  if (ctx.msg.text == "/start create") {
    ctx.session = { step: Step.START } as any;
    await ctx.reply("Starting create sticker, please select style", {
      reply_markup: {
        force_reply: true,
        keyboard: menus[""],
      },
    });
  } else {
    if (ctx.session.step != Step.START) {
      ctx.session = { step: Step.START } as any;
      await ctx.reply("Force reset state", {
        reply_markup: {
          keyboard: [["/start create"]],
        },
      });
    }
  }
});

pm.on("message:text", async (ctx) => {
  switch (ctx.session.step) {
    case Step.INIT:
      await ctx.deleteMessage();
      break;
    case Step.START: {
      const style = ctx.message.text;
      if (style == "reset") {
        ctx.session = { step: Step.INIT } as any;
        await ctx.reply("Reset state", {
          reply_markup: {
            remove_keyboard: true,
          },
        });
      } else if (style in renderers) {
        ctx.session = { step: Step.SELECTED_TYPE, styles: renderers[style] };
        await ctx.reply("Please select sub style", {
          reply_markup: {
            force_reply: true,
            keyboard: menus[style],
          },
        });
      } else {
        await ctx.reply("Unknown style, please select again.");
      }
      break;
    }
    case Step.SELECTED_TYPE: {
      const styles = ctx.session.styles;
      const substyle = ctx.message.text;
      if (substyle == "reset") {
        ctx.session = { step: Step.INIT } as any;
        await ctx.reply("Reset state", {
          reply_markup: {
            remove_keyboard: true,
          },
        });
      } else if (substyle in styles) {
        const renderer = styles[substyle];
        ctx.session = {
          step: Step.SELECTED_SUBTYPE,
          renderer,
          args: [],
        };
        if (renderer.preview) await ctx.replyWithSticker(renderer.preview);
        await ctx.reply(`You need provide ${renderer.inputs_count} arguments`, {
          reply_markup: {
            remove_keyboard: true,
          },
        });
      } else {
        await ctx.reply("Unknown style, please select again.");
      }
      break;
    }
    case Step.SELECTED_SUBTYPE: {
      const { args, renderer } = ctx.session;
      args.push(ctx.message.text);
      if (args.length == renderer.inputs_count) {
        ctx.session = { step: Step.INIT } as any;
        const data = renderer.render(args).toBuffer("image/png");
        const image = await codecs.decode(data);
        const encoded = await codecs.encode(image, "image/webp", {
          lossless: 1,
        } as any);
        try {
          const msg = await ctx.replyWithSticker(
            new InputFile(new Uint8Array(encoded.data), "sticker.webp"),
            {
              reply_markup: {
                remove_keyboard: true,
              },
            }
          );
          db.insertSticker(ctx.from.id, msg.sticker.file_id);
          await ctx.replyWithSticker(msg.sticker.file_id, {
            reply_markup: {
              inline_keyboard: new InlineKeyboard().switchInline(
                "Send",
                msg.sticker.file_id
              ).inline_keyboard,
            },
          });
          await bot.api.deleteMessage(ctx.chat.id, msg.message_id);
        } catch (e) {
          console.error(e);
          await ctx.reply("Failed to send this sticker", {
            reply_markup: {
              remove_keyboard: true,
            },
          });
        }
      } else {
        await ctx.reply(`Remain ${renderer.inputs_count - args.length}`, {
          reply_markup: {
            remove_keyboard: true,
          },
        });
      }
    }
  }
});

bot.catch(console.error);

console.log("starting");
await bot.start();
