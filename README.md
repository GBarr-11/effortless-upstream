<h3 align="center">Two mods for Claude Code, by HeyCubit</h3>

<table>
<tr>
<td width="50%" align="center" valign="top">
<a href="#effortless"><img src="docs/readme/banner.png" alt="effortless" width="100%"></a>
<p><b>effortless</b><br>Picks the reasoning effort for every prompt. On real coding tasks, 21% cheaper than Opus on medium, with the same answers.</p>
<p><a href="https://heycubit.github.io/effortless/">Website</a> · <a href="#install">Install</a></p>
</td>
<td width="50%" align="center" valign="top">
<a href="#textless"><img src="textless/brand/readme-banner.png" alt="textless" width="100%"></a>
<p><b>textless</b><br>While Claude works, one pixel-art picture stands in for the wall of steps. Pick a set, use your own art, or find one in the Marketplace.</p>
<p><a href="https://heycubit.github.io/effortless/textless/">Website</a> · <a href="#textless">Install</a></p>
</td>
</tr>
</table>

## effortless

<p align="center">
  <a href="#install"><b>Install</b></a> ·
  <a href="#what-the-bar-shows"><b>What it shows</b></a> ·
  <a href="#pick-your-judge"><b>Judges</b></a>
</p>

https://github.com/user-attachments/assets/9b5af48e-2ad8-4826-9443-4aeea1306664

A Claude Code mod that picks the reasoning effort for every prompt. Quick questions get **Low**, hard jobs get **High**,
and you never touch the Effort control. On real coding tasks it cut the cost of Opus by **21%** against Anthropic's
recommended medium, **29%** against high and **42%** against xhigh, with every answer still right
([the benchmark](#what-it-saves-measured)). One bar above the prompt also shows how full the chat is, how long the
prompt cache stays warm, and hands off or compacts in one click when a chat gets heavy.

<p align="center">
  <img src="docs/readme/story.gif" alt="effortless in a Claude Code chat: effort per prompt, Handoff, cold cache, heavy chat, limits and settings" width="100%">
</p>

## Powered by Haiku 5.5

Haiku 5.5 costs about 75% less than Haiku 4.5, and Anthropic names compaction and quick, well-defined work among what
it is built for. effortless uses it in three places:

| | |
|---|---|
| **The judge** | reads each prompt and picks the effort, in about a second, on your own Claude login |
| **Cheaper model when it can** | experimental, off by default. When on, a prompt the judge calls simple may run on Haiku 5.5 (or Sonnet), never above your chat's model, but only when the switch pays: each model keeps its own prompt cache, so in a chat that is in use the switch usually costs more than it saves ([why](#why-model-switching-is-off)) |
| **Compaction** | every compaction, `/compact` and the automatic one included, is summarized by Haiku 5.5. If Haiku fails, Claude Code compacts as usual |

The cheaper model is switched on in Settings → Model; compaction is switched in Settings → Handoff → Compact with.

## Install

Two ways. Both take a minute and need no terminal.

**1. Ask Claude** (easiest). Paste this into Claude Code and press Enter:

```text
Install the effortless plugin for me: run `claude plugin marketplace add HeyCubit/effortless` and then `claude plugin install effortless@effortless`. When both succeed, tell me to run /reload-plugins.
```

**2. Commands.** Type these two lines in Claude Code's chat box:

```text
/plugin marketplace add HeyCubit/effortless
```

```text
/plugin install effortless@effortless
```

Or in a terminal, in one line:

```bash
claude plugin marketplace add HeyCubit/effortless; claude plugin install effortless@effortless
```

Then run `/reload-plugins` (or restart Claude Code). A short setup opens above the prompt: keep **Haiku** alone (one click,
no key, runs on your own Claude login) or add **Jev** (a TypeSafe key, about 4x faster effort calls), lean cheaper or
smarter, and pick how handoffs are written. Run `/effortless setup` to go through it again, or change any of it in ⚙.

Updates come to you: when a new version is out, a card above the prompt offers **Update** or **Later**. Update loads the
new version in the chat you pressed it in, with nothing to type.

## What the bar shows

<p align="center"><img src="docs/readme/hero.gif" alt="The bar: Deciding, then Low for a quick question, then High for a refactor" width="100%"></p>

| On the bar | Means |
|---|---|
| **High · Opus** | the effort Auto picked for this prompt, and the model the chat runs on. `Deciding` while the judge thinks; a switch flashes violet and fades to white |
| **◔ 38%** | how full the chat's context is |
| **cache 59:00** | time until the prompt cache goes cold, after which the next message pays full price to re-read the chat |
| *Haiku: a refactor…* | who judged and why |
| **Auto** | switches the judge on and off. Changing effort in the app yourself also turns Auto off at your next message, and says so: you always win |
| **Compact** | compacts the chat. It turns into a glowing **Handoff** when Haiku says a fresh chat would pay off, with Compact as quiet text beside it. Set Settings → Handoff → Handoff button to **Always** to keep Handoff on the bar |
| **⚙** | settings |

Prefer it quiet? Settings → Customize has a **Minimal** look with no bar. It also sets the **Appearance** (match Claude Code, dark or light) and the **Theme** (violet, Claude orange or cherry blossom).

### When a chat gets heavy

When the cache has gone cold on a big chat, the bar turns to ice with **Compact** and **Handoff**:

<p align="center"><img src="docs/readme/cold.gif" alt="The Chat went cold bar, breathing" width="100%"></p>

**Handoff** writes a summary of the chat and carries on in a clean one. **Quick** takes a few seconds; **Full** checks
git and saves `HANDOFF.md` (or runs your own skill). Then clear and carry on, clear and wait, or keep the chat and copy.

<p align="center"><img src="docs/readme/handoff.png" alt="The Handoff bar with Quick and Full" width="100%"></p>

**Compact** takes an optional note for what the summary should keep. Every compaction, also `/compact` and the automatic one, is written by **Haiku 5.5** by default, which Anthropic recommends for compaction at a fraction of the chat model's price; if Haiku fails, Claude Code compacts as usual. Switch it in Settings → Handoff → Compact with.

<p align="center"><img src="docs/readme/compact.png" alt="The Compact bar with an optional summary field" width="100%"></p>

The bar also warns when a chat is getting swamped (each message re-reads a lot of context), when a 5-hour or weekly
limit passes 80% (with a Save mode that caps effort at Medium), and when your judge stops answering.

### Settings

<p align="center"><img src="docs/readme/settings.png" alt="The settings panel: Effort, Judge, Handoff, Customize" width="100%"></p>

## Haiku, and Jev if you add it

Haiku 5.5 runs on your own Claude login and needs no key. It always makes the handoff call: from 30% of context, every second message, it reads what the chat was for, the trail of topics, the last reply and how full the context is, and says a fresh chat would suit only for a clear reason. Then the Compact button turns into a lit Handoff with the reason. Want Handoff on the bar all the time? Settings → Handoff → Handoff button → **Always**.

Haiku also picks the effort, unless you add Jev, TypeSafe's faster judge (about 0.25 s against about 1 s). With a key, Jev answers the effort first and Haiku steps in whenever Jev is unsure. Run `/plugin configure effortless@effortless` in Claude Code, or use the setup guide or the Judge card in Settings.

| Setting | What it does |
|---|---|
| `auto` (default) | Haiku, and Jev too when a [TypeSafe](https://typesafe.ai) key is set in the settings or `TYPESAFE_API_KEY` |
| `haiku` | Haiku only, a key is never used |
| `jev` | Haiku and Jev, and the key may also come from `~/.config/jev/.env` |

A key set with `/plugin configure` is kept in Claude Code's secure storage. A key pasted in the setup guide or the Judge card is written in plain text to `~/.config/jev/.env` (the file the jev skills read), never to a file of this repo. If Jev fails or takes longer than 3 seconds, Haiku judges that prompt and effortless tells you why once per session (out of credits, key rejected, no answer).

Short follow-ups such as "go", "ok" or "yes" keep the effort already picked and ask no judge.

## Keys and trust

- The default judge needs **no key**: Haiku runs on your own Claude login.
- A key is only needed to add Jev. Enter it with `/plugin configure`, never on the command line, so it stays out of your shell history: Claude Code then keeps it in its secure storage. A key pasted in the setup guide or the Judge card is saved in plain text to `~/.config/jev/.env` instead, so prefer `/plugin configure` on a shared machine.
- A key is sent only to TypeSafe, and to nothing else. Use a key with a spending limit if your provider offers one.
- Like any Claude Code plugin, this mod runs code on your machine. Its code is in [`hooks/`](hooks/): read it before you install if you do not know the author. The programs it starts are `claude` itself (to update or uninstall the mod when you press those buttons), `git` (to see if a new version is out) and, on Update, a plain file copy of the new version into the folder your open chat runs from.

## What it saves, measured

Four real coding tasks in a fresh copy of this repo, each run 3 times with effortless on and with it off, through
Anthropic's API so the cost is real. Every answer was checked. Run 2026-10-10, 96 runs:

| Opus 5.5 | Correct | Cost per task | Requests | Time |
| --- | --- | --- | --- | --- |
| medium (recommended), no effortless | 12 of 12 | $0.190 | 7.3 | 24 s |
| high, no effortless | 12 of 12 | $0.209 | 8.0 | 27 s |
| xhigh, no effortless | 12 of 12 | $0.257 | 9.9 | 44 s |
| **effortless on** | **12 of 12** | **$0.149** | **5.8** | **20 s** |

That is **21%** less than medium, **29%** less than high and **42%** less than xhigh. On Sonnet it came out even
against medium (Sonnet at medium is already lean) and saved 10% against high and 35% against xhigh.

The saving comes from fewer steps: every request rereads the whole chat, and at a lower effort the model makes fewer of
them. Over 80k requests of real Claude Code use, about 76% of the cost was that reread, 16% cache writes and 8% output.
Keeping chats short and compacting before the cache goes cold saves on the same 76%; that is what the countdown is for.

Limits: four tasks, three runs each, mostly easy work where effortless goes low. On hard work it picks more effort and
saves less. Fresh chats through the API, not long chats on a plan. Run it again with `bash bench/agentic/run.sh`;
all numbers and limits are in [bench/RESULTS.md](bench/RESULTS.md).

## Why model switching is off

Moving a simple prompt to Haiku looks cheap on a single prompt: the cheaper answers were good enough in 27 of 30 and
cost 60 to 77% less. But each model keeps its own prompt cache, so a prompt moved mid-chat has to write the whole chat
into the other model's cache first. Measured on an 80k-token chat, that costs about 5 times what staying on a warm
Opus does (10 times for Sonnet). So **Cheaper model when it can** is off by default and marked experimental.
[Details](bench/RESULTS.md#3-why-model-switching-is-off-node-benchquality-mjs).

## How often the judge is right

`/effortless bench` runs labelled prompts through each judge you have set up, using the same code a real prompt goes
through, and scores them against a fixed effort. Each case lists the efforts a careful person would accept for that
message on that model. The cases are in [`bench/judge-cases.json`](bench/judge-cases.json); run it yourself.

Two runs on version 1.5.1, 73 cases, Sonnet and Opus 5.5:

| Judge | Right, all 73 | Right, 20 held out | Too low | Too high | Median time |
| --- | --- | --- | --- | --- | --- |
| Always medium | 44% | 40% | 17 | 24 | - |
| Always high | 51% | 50% | 0 | 36 | - |
| Haiku | 92-93% | 95% | 1 | 4-5 | 0.75 s |
| Jev | 99% | 100% | 0 | 1 | 0.24 s |

What this does and does not show:

- It measures whether the judge picks a sensible effort, not how much a session costs or how good the answers are.
- 73 cases is a small set, and the judges are not fully deterministic: runs differ by a few points.
- The judge prompts were tuned on 53 of the cases. The 20 held-out cases were never tuned against, so that column is
  the honest one. They were written after the first run showed which kinds of message miss, so they are not blind.
- Haiku's remaining misses are mostly "yes" or "thanks" after hard work, where it keeps the effort high.

## Models

Effort only changes on Opus 5.5 and Sonnet 5.5. On Fable 5.1 and older models a change of effort between requests rewrote most of the prompt cache, which costs more than it saves, so Auto pauses there and the footer says `Paused`. Haiku takes no effort setting.

## Split view

In the desktop app's split view, Claude Code draws plugin bars only in the left pane. The right pane still draws
replies, so when a chat went cold, is getting swamped or runs hot, a small card in the bar's colours hangs under the
newest reply, naming the command that does what the bar's button would: `/compact`, `/effortless handoff` or
`/effortless save`.

## In the terminal

effortless draws in the terminal CLI too, with moving pixel art in its bands. Claude Code may not load a plugin's code
there yet: if `/effortless` says the mod is not loaded after a restart, add this to `~/.claude/settings.json` and
restart:

```json
{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }
```

Tested on Claude Code 2.1.285 (stable), 2.1.286 and 2.1.288 at 80 and 120 columns. Below 90 columns the bands leave their art out.

## Commands

| Command | Does |
|---|---|
| `/effortless settings` | opens the settings panel |
| `/effortless setup` | runs the setup again |
| `/effortless auto` | Auto on or off |
| `/effortless handoff` / `handoff full` | hands off without the bar, with your last choice of what follows |
| `/effortless stats` | what the prompts Auto steered cost this session, per effort, and what the judge took |
| `/effortless cold`, `swamp`, `hot`, `down` | shows that bar now, to try it |
| `/effortless bench` | scores each judge you have on the labelled prompts in [`bench/judge-cases.json`](bench/judge-cases.json) |
| `/effortless debug` | what the mod sees, and on its last line the model and effort the last request ran on |
| `/effortless update` | checks for a new version now |

## textless

textless works in the Claude desktop app, not in the terminal. While Claude works, Claude Code shows every step it takes. textless shows one piece of art there instead: a scene, an
animation, a quote, a scene someone else made, or a game of chess. When Claude is done the answer is back as normal, and
the steps are one click away under "show steps".

- **Pick what shows:** a set (Clawd, Scenery, Paintings, Abstract, Minimal, Nostalgia, Working or Quotes), one favourite
  scene, or your own art in `~/.claude/textless/scenes`.
- **The Marketplace:** scenes other people made, checked before they go live. One command puts one on:
  `/textless get <id>`.
- **Chess:** `/chess` plays a built-in opponent with four levels, `/chess claude` plays against Claude.
- **One switch per chat:** the Aa on the card (struck through means the steps are hidden), or `/textless`. The gear opens
  the settings and the arrows fold the card to one line.

Website, scenes and Marketplace: [heycubit.github.io/effortless/textless](https://heycubit.github.io/effortless/textless/).
The code is in [`textless/`](textless/).

## Open source

effortless is MIT licensed. Like any Claude Code plugin it runs code on your machine, so the whole mod is here to read:
[`hooks/`](hooks/). It sends nothing anywhere except your prompt to the judge you picked.

## Develop

```bash
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

`tools/render-band` draws the bar the way the desktop app does, without opening it; the images in this README come from it.

## License

[MIT](LICENSE)
