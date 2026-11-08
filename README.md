# VWS Journal

**The journal built for learning your favourite trading system.**

Log every trade with your system context: market condition, location, setup, direction, evidence, invalidation, target and psychology. Then track your progress in applying the system. The focus is not on profit and loss, but on learning to execute the system well.

**Open the journal: [vwsjournal.com](https://vwsjournal.com)**

Private by design: no account, no subscription, no cloud. Your journal lives in a folder on your own computer.

---

## Features

- **Log every trade with its system context.** Pick symbol, market condition, location, setup, direction, evidence, invalidation, target, psychology and result with one click each. The form remembers your last symbol and market condition.
- **Trade grade.** Every trade gets a grade from C to A+, based on the number of locations (confluences) and whether one is a higher-timeframe level. See how each grade performs on the Stats page.
- **Rules per setup.** Every setup has a short list of rules (context, location, entry, risk). Tick them off when you log a trade, and see on the Stats page how often you follow them and which rule you break most. The default rules for the setups unlock with a VWS code, shared in the Discord of the Drysdale Trading Group: free members get the core setups, premium members core and advanced. The rules for all setups and your own rules always work.
- **Scalping mode.** Many trades in a day? Switch from **Normal** to **Scalp** at the bottom of the sidebar. **Quick trade** logs a trade in seconds: symbol (from your previous trade), direction, setup and result, with an optional Auto-Capture screenshot (key C). Click **Complete trade** later to add the market condition, location and the rest.
- **Day bar and a loss limit.** Above the trades of the day: every trade in order, wins and losses, and the quick trades still to complete. Set **Max losses per day** at the top of Settings > Journal (“Show max losses per day message”) and get a calm message when you reach it.
- **Chart screenshots.** Paste, drop or upload a screenshot, or connect your charting window once and capture it with one click (**Auto-Capture**, also with Option/Alt + A). With scalping mode on, a trade holds up to 10 screenshots: the latest shows large next to the form while you fill it in, and the enlarged view is a carousel.
- **Weekly calendar.** See wins, losses and break-evens per day at a glance and jump between days and weeks.
- **Card and list view.** Full trade cards with the screenshot, or a compact list you can expand per trade.
- **Track your progress.** Built-in charts, such as execution growth, setup effectiveness, invalidation losses and psychology, by day, symbol, market condition, location and setup. Filter by year, month, week or day.
- **Custom charts.** Turn your own questions into a chart, for example "How does Return to Value do in a balanced market?"
- **Made to fit how you trade.** Edit all lists (locations, setups, evidence, targets, psychology) and your rules in Settings and switch sections on or off, so the journal matches the way you trade. Trade another system? Choose **Use your own system** in Settings > Journal to start from empty lists; the VWS lists are kept aside and come back with one click. **Reset to default** puts the default VWS lists and rules back.
- **Dark and light mode**, keyboard shortcuts, and installable as a desktop app.

## Requirements

- **Google Chrome** or **Microsoft Edge** on a desktop or laptop (Windows, macOS, Linux or ChromeOS).
- The journal does not work in Safari or Firefox, or on phones and tablets. It needs access to a folder on your computer, which only these browsers on a computer support.

## Getting started

1. Create an empty folder on your computer, for example `VWS Journal`.
2. Open [vwsjournal.com](https://vwsjournal.com) in Chrome or Edge.
3. Click **Connect Folder**, select the folder and allow access.
4. Click **Add Trade** and log your first trade.

Next time you open the journal, Chrome asks for permission once and you continue where you left off.

**Already have a settings file?** Put your `settings.json` in the folder before you connect it, and the journal uses your own lists.

### Install as a desktop app (optional)

In Chrome, open the menu (three dots, top right), choose **Cast, save and share** and then **Install page as app...**. The journal then opens in its own window, like any other program.

## Your data

Everything is saved in the folder you connected:

| File | What it holds |
| --- | --- |
| `vwap-journal.json` | All your trades |
| `settings.json` | Your lists, enabled sections and preferences |
| `img/` | The screenshots of your trades |

Your trades never leave your computer. To make a backup, copy the folder. To move to another computer, copy the folder there and connect it.

## Keyboard shortcuts

| Action | Mac | Windows |
| --- | --- | --- |
| New trade | Option + N | Alt + N |
| Dark / light mode | Option + M | Alt + M |
| Show all shortcuts | ? | ? |
| Close a popup | Esc | Esc |
| Jump to today | Option + T | Alt + T |
| Previous / next day | Arrow Left / Right | Arrow Left / Right |
| Previous / next week (same weekday) | Shift + Arrow Left / Right | Shift + Arrow Left / Right |
| Save trade (in the trade popup) | Option + S | Alt + S |
| Close the trade popup | Option + C | Alt + C |
| Delete trade (in the trade popup) | Option + Backspace | Alt + Backspace |
| Mark rule 1 to 9 (Rules tab of the trade popup, when Rules are on) | 1 – 9 | 1 – 9 |
| Auto-Capture the chart window (trade popup) | Option + A | Alt + A |
| Quick trade: Long / Short | Arrow Up / Down | Arrow Up / Down |
| Quick trade: setup 1 to 9 (in the order of Settings) | 1 – 9 | 1 – 9 |
| Quick trade: Auto-Capture | C | C |
| Quick trade: Win / Loss / Break-even | W / L / B | W / L / B |
| Quick trade: save and start the next trade / save and close | Enter / Shift + Enter | Enter / Shift + Enter |

Day and week shortcuts work on the dashboard when you are not typing in a field. Press ? anywhere in the app to see all shortcuts, or click the keyboard button in the sidebar.

## Project structure

The journal is a static web app: plain HTML, CSS and JavaScript, hosted on GitHub Pages. There is no build step and nothing is loaded from other websites at runtime, apart from privacy-friendly Cloudflare Web Analytics and, only when you click to play one, a release video from YouTube (privacy-enhanced mode).

| File | Purpose |
| --- | --- |
| `index.html` | The app: layout, pages and popups |
| `styles.css` | All styling, including dark and light theme |
| `globals.js` | Shared state and helpers, and `FEATURES`: which releases are switched on |
| `storage.js` | Reading and writing the journal folder: one save at a time, save errors, changes from outside, one window per journal |
| `gate.js` | The start screen: connecting a folder, unsupported browsers and devices |
| `tradeform.js` | The Add Trade form |
| `ui.js` | Dashboard, weekly calendar, trade cards, popups and messages |
| `ui-settings.js` | The Settings page |
| `share.js` | Share for review |
| `charts.js` | Statistics page |
| `customcharts.js` | Custom charts |
| `rules.js` | Rules per setup and the grade: Add Trade, trade cards, setup codes |
| `rules-settings.js` | Settings › Rules |
| `rules-stats.js` | Stats › Rules and the rules charts |
| `system.js` | VWS Journal system or your own system |
| `backup.js` | Automatic daily backups, restore, and protection against a damaged journal file |
| `scalp.js` | Scalping mode (Quick trade, Complete trade), the day bar and the max losses per day |
| `shots.js` | Multiple screenshots per trade: the latest next to the form, the thumbnails in the form, the carousel viewer (released with scalping mode) |
| `releases.js` | What's new (the bell, top right) |
| `app.js` | Start-up, navigation and keyboard shortcuts |
| `settings.json` | Default settings |
| `vendor/` | Chart.js 4.5.1 and Flatpickr 4.6.13, stored in the repo at a fixed version |

The script and style links in `index.html` (and `review/index.html`) end in `?v=…`. That number goes up with every update, so browsers load the new files at once instead of mixing cached old files with new ones.

## Support

Questions, ideas or a bug? Mail **hello.ordercraft@gmail.com**.

## Made by Order Craft

Order Craft makes tools for traders who want to get better at their trading system, including [Stream Deck icons for DOM scalping](https://marketplace.elgato.com/@ordercraft).
