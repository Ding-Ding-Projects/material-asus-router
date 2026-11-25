// English text for the voice feature. The Cantonese twin is strings-yue.js and
// uses the same keys. {name} placeholders are filled in by i18n.js.
export const EN = {
  // shared
  cancel: "Cancel", continue: "Continue", save: "Save", saved: "Saved.", reset: "Reset", edit: "Edit", delete: "Delete", loading: "Loading…",
  moveUp: "Move up", moveDown: "Move down", inProgress: "In progress", tocLabel: "Sections on this screen",
  schoolLeftOut: "Left out while School mode is on.",

  // panel titles
  panelLanguage: "Language", panelTone: "Funny levels", panelWording: "Personal wording", panelSounds: "Action sounds", panelNarration: "Narrator",
  panelLook: "Appearance and motion", panelSchedule: "Scheduled settings", panelName: "App name", panelComfort: "ADHD modes", panelDimsum: "Dim sum",
  panelHistory: "History", panelAbout: "About",

  // language
  languageLede: "Choose English, Cantonese or both. The choice is saved and applies to every screen, message, dialog and error.",
  languageMode: "Language mode", languageModeHelp: "In both mode, each label shows English and Cantonese together, and wraps on narrow screens.",
  languageSample: "This line follows the language you choose.", languageSampleHelp: "Try the three modes and watch this card change.",

  // tone
  toneLede: "Two sliders set how playful the app sounds, one for English and one for Cantonese. They change the voice of a message, never its facts.",
  toneEnglish: "English funny level", toneYue: "Cantonese funny level",
  toneEnglishHelp: "1 is serious and adds nothing. 5 is the most playful.", toneYueHelp: "1 is serious and adds nothing. 5 is the most playful.",
  toneEmoji: "Show emojis in dialogs", toneEmojiHelp: "Adds one decorative emoji to the heading of each dialog. Never in buttons, labels or spoken names.",
  toneDisclosure: "Level 5 is the default, so the app is playful out of the box. Turn a slider down to 1 for plain, serious wording in that language. Messages about errors, risky actions, security and accessibility follow the same sliders.",
  tonePreview: "What each kind of message adds at the current levels", toneNothingAdded: "Nothing added at this level",
  toneDisclosureTitle: "The app has a funny side", toneDisclosureBody: "Messages can carry a light, playful aside. You can turn it down or off for each language in Voice and comfort. The facts in a message never change.",
  toneDisclosureKeep: "Keep it", toneDisclosureOpen: "Open the sliders",
  kind_error: "Errors", kind_success: "Success", kind_confirm: "Risky actions", kind_security: "Security", kind_access: "Accessibility", kind_empty: "Empty screens",

  // personal wording
  wordingLede: "Load one small JSON file of your own words and the app shows them instead of the shipped ones. The file stays on this browser.",
  vocabStatus: "Personal wording", vocabNone: "No file loaded", vocabLoaded: "Loaded: {count} entries",
  vocabChoose: "Choose a file", vocabReplace: "Replace the file", vocabClear: "Clear personal wording",
  vocabClearTitle: "Clear personal wording?", vocabClearBody: "The shipped wording comes back and the saved copy is deleted from this browser.",
  vocabDrop: "You can also drop the file anywhere on the window. A file that fails any check changes nothing.",
  vocabLocal: "Local only. The file is never sent anywhere and never appears in logs, exports or history. Commands and identifiers always stay as they are.",
  vocabSchema: "File format", vocabLimits: "Limits: {bytes} KiB, nesting depth {depth}, keys up to {key} characters, values up to {value} characters, {entries} entries, no duplicate keys.",
  vocabApplied: "Personal wording applied", vocabDamagedNotice: "The saved personal wording was damaged and has been removed. The shipped wording is showing.",
  vocabError_TOO_BIG: "That file is too large. The limit is 256 KiB.", vocabError_EMPTY: "That file is empty.", vocabError_NOT_JSON: "That is not a JSON file.",
  vocabError_NOT_OBJECT: "The file must hold one JSON object.", vocabError_UNKNOWN_FIELD: "The file has a field that is not part of the format.",
  vocabError_BAD_VERSION: "The file must say \"version\": 1.", vocabError_NO_WORDS: "The file has no words to apply.", vocabError_BAD_NAME: "The name in the file is not valid.",
  vocabError_BAD_KEY: "One of the words is not valid.", vocabError_BAD_VALUE: "One of the replacements is not valid.", vocabError_DUPLICATE_KEY: "The same word appears twice.",
  vocabError_TOO_DEEP: "The file is nested too deeply.", vocabError_TOO_MANY: "The file has too many entries.", vocabError_SCHOOL: "Personal wording is left out while School mode is on.",
  vocabError_ONE_FILE: "Drop exactly one file.", vocabError_BAD: "That file could not be used.",

  // sounds
  soundsLede: "Short sounds for meaningful actions, made on the spot with no sound files. A sound never replaces what you see or hear from your screen reader.",
  soundsOn: "Action sounds", soundsOnHelp: "Turns all cues on or off at once.", soundsMute: "Mute", soundsMuteHelp: "Silences every cue without changing the switch above.",
  soundsVolume: "Volume", soundsReduced: "Reduced sound", soundsReducedHelp: "Plays only errors and warnings.",
  soundsQuiet: "Quiet hours", soundsQuietHelp: "No sounds between these times, including past midnight.", soundsTo: "to",
  soundsMap: "Which action plays which cue", soundsProvenance: "Every cue is generated on the spot from oscillator settings. Nothing is recorded, sampled or downloaded.",
  soundsTest: "Play", soundsPlayed: "Played: {cue}", soundsNotPlayed: "{cue} did not play: {why}",
  soundsUnavailable: "This browser could not start audio. Actions still work exactly the same.",
  soundsNowOn: "Action sounds are on.", soundsNowOff: "Action sounds are off.", soundsMuted: "Sounds are muted.", soundsUnmuted: "Sounds are on again.",
  why_ok: "it played", "why_switched-off": "sounds are switched off", why_muted: "sounds are muted", "why_volume-zero": "the volume is zero", "why_quiet-hours": "quiet hours are on",
  "why_reduced-sound": "reduced sound allows only errors and warnings", "why_too-soon": "it came too soon after another cue", "why_unknown-cue": "unknown cue", "why_audio-unavailable": "audio is unavailable",

  // narrator
  narrationLede: "The narrator reads the app's messages aloud in English, Cantonese or both. It is off by default and speaks one thing at a time.",
  narrationUnavailable: "This browser has no speech engine, so the narrator cannot speak.",
  narrationOn: "Narrator", narrationOnHelp: "Reads toasts, dialog titles and screen titles aloud.", narrationOnSpoken: "The narrator is on.",
  narrationNowOn: "The narrator is on.", narrationNowOff: "The narrator is off.",
  narrationScreenReader: "I use a screen reader", narrationScreenReaderHelp: "A web page cannot tell whether a screen reader is running, so turn this on and the narrator stays silent and lets your screen reader speak.",
  narrationVoiceEn: "English voice", narrationVoiceYue: "Cantonese voice", narrationAuto: "Choose automatically",
  narrationEffective: "Speaking with {name} ({lang})", narrationNoEn: "No English voice is installed. English text will not be spoken.", narrationNoYue: "No Hong Kong Cantonese voice is installed on this device, so Cantonese text will not be spoken. Install one in your system's speech settings.",
  narrationNoVoice: "No voice found yet", narrationTest: "Test", narrationSampleEn: "This is the English narrator.", narrationSampleYue: "呢度係廣東話朗讀。",
  narrationRate: "Speed", narrationPitch: "Pitch",
  narrationRules: "One utterance at a time. Repeated messages are skipped, busy moments are rate limited, and errors are never held back.", narrationRefresh: "Look for voices again",

  // look
  lookLede: "Density, font size, accent colour and motion. They can be scheduled below.",
  lookDensity: "Density", densityComfortable: "Comfortable", densityCompact: "Compact", lookFont: "Text", lookFontHelp: "Larger text scales the whole app. System font uses your device's own font.",
  fontDefault: "Default", fontLarge: "Larger", fontSystem: "System font", lookAccent: "Accent colour", lookAccentHelp: "Re-tones the whole app.",
  lookMotion: "Motion", lookMotionHelp: "Reduced stops animation and transitions. Your system's reduced motion setting is always respected too.", motionFull: "Full", motionReduced: "Reduced",
  lookTheme: "Theme", lookThemeHelp: "Follow the system, or choose light or dark.", themeAuto: "Automatic", themeLight: "Light", themeDark: "Dark",

  // schedule
  scheduleLede: "Switch language, theme, density, colour, text size or motion by time of day, by day, or when another system says so.",
  scheduleBase: "A schedule only borrows a setting. When a rule ends, your own choice comes back. If rules overlap, the one higher in the list wins for each setting.",
  scheduleEmpty: "No rules yet.", scheduleAdd: "Add a rule", scheduleNewRule: "New rule", scheduleEditRule: "Edit rule", scheduleDeleteTitle: "Delete this rule?",
  scheduleName: "Name", scheduleSource: "Runs", scheduleSourceLocal: "At set times", scheduleSourceApi: "While a web address says so", scheduleSourceHa: "While a Home Assistant switch is on",
  scheduleDays: "Days", scheduleDaysHelp: "Leave all days unpicked for every day.", scheduleEveryDay: "Every day", scheduleAllDay: "All day",
  scheduleStart: "From", scheduleEnd: "Until", scheduleMidnight: "If Until is earlier than From, the rule runs past midnight and belongs to the day it started.",
  scheduleZone: "Time zone", scheduleZoneLocal: "This device's time zone", scheduleFrom: "First day (optional)", scheduleTo: "Last day (optional)",
  scheduleApply: "Switch these settings", scheduleNoChange: "Leave as it is", set_language: "Language", set_theme: "Theme", set_density: "Density", set_font: "Text", set_motion: "Motion", set_accent: "Accent colour",
  val_en: "English", val_yue: "Cantonese", val_both: "Both", val_auto: "Automatic", val_light: "Light", val_dark: "Dark", val_comfortable: "Comfortable", val_compact: "Compact",
  val_default: "Default", val_large: "Larger", val_system: "System font", val_full: "Full", val_reduced: "Reduced",
  scheduleWhenApi: "While the web address says on", scheduleWhenHa: "While the Home Assistant switch is on", scheduleFromApi: "settings from the web address",
  scheduleApiRuleHelp: "This rule is on while the web address in Web address source says so. If the answer carries settings, those are used; otherwise the settings you pick below.",
  scheduleHaRuleHelp: "This rule is on while the Home Assistant switch in Home Assistant source is on.",
  scheduleActiveNow: "On now", scheduleActiveList: "On now: {names}", scheduleNoneActive: "No rule is on right now.", scheduleSwitched: "A schedule rule switched your settings.",
  scheduleFix: "Please fix:", scheduleErr_name: "name", scheduleErr_time: "start and end times", "scheduleErr_same-time": "start and end must differ", scheduleErr_tz: "time zone", scheduleErr_date: "date", "scheduleErr_date-order": "last day is before first day",
  scheduleErr_accent: "colour", scheduleErr_apply: "pick at least one setting", scheduleErr_id: "rule id", scheduleErr_days: "days", scheduleErr_language: "language", scheduleErr_theme: "theme", scheduleErr_density: "density", scheduleErr_font: "text", scheduleErr_motion: "motion", scheduleErr_unknown: "unknown setting", "scheduleErr_too-many": "too many rules (40 is the limit)",
  scheduleApiTitle: "Web address source", scheduleApiHelp: "A secure (https) address that answers with a small JSON schedule. Checked by this app's server, never by the page.",
  scheduleApiPlaceholder: "A secure web address", scheduleHaTitle: "Home Assistant source", scheduleHaHelp: "A Home Assistant on/off entity. Use a long-lived access token from your Home Assistant profile.",
  scheduleHaPlaceholder: "Home Assistant address", scheduleUrl: "Address", scheduleEntity: "Entity", scheduleToken: "Access token (optional for web address)", scheduleTokenSaved: "A token is saved in this browser",
  scheduleTokenHelp: "The token is kept in this browser only, is sent to this app's server for each check, and never goes into history, exports or logs. A web page cannot offer a stronger secure store.",
  scheduleRefresh: "Check every (minutes)", scheduleCheckNow: "Check now", scheduleForgetToken: "Forget the token",
  scheduleStateIdle: "Not checked yet", scheduleStateChecking: "Checking…", scheduleStateOk: "Last check worked: {state}", scheduleStateFailed: "Last check failed ({code}).", scheduleStale: "The last good answer is still being used.",
  scheduleOn: "on", scheduleOff: "off",
  scheduleApiFailed: "The schedule web address could not be read.", scheduleHaFailed: "Home Assistant could not be read.",
  daySun: "Sun", dayMon: "Mon", dayTue: "Tue", dayWed: "Wed", dayThu: "Thu", dayFri: "Fri", daySat: "Sat",

  // name
  nameLede: "Change the name the app shows about itself. Only the display changes.", nameField: "Shown name", nameHelp: "Up to 60 characters. Leave empty to use the shipped name.",
  nameApply: "Use this name", nameReset: "Back to the shipped name", nameSaved: "The name was changed.", nameWasReset: "The shipped name is back.",
  nameCosmetic: "This only changes what you see in the title bar, the page, the sidebar and notices. The data folder, package and container names, the update feed and diagnostics keep the shipped name.",
  nameDiagnostics: "Copy diagnostics", nameDiagnosticsCopied: "Diagnostics copied.", nameDiagnosticsFailed: "Diagnostics could not be copied.",

  // ADHD modes
  comfortLede: "Five independent comfort modes, all off until you turn them on. Plain wording, no streaks and no scores.",
  adhdFocus: "Focus", adhdFocusHelp: "Hides the side rail, tabs and extra buttons. A Show everything button stays on screen.",
  adhdLow: "Low stimulation", adhdLowHelp: "Stops animation, calms strong colours and quietens sounds. Works together with your system's reduced motion setting.",
  adhdTime_: "Time awareness", adhdTimeHelp: "Shows the time now, how long you have been on this screen, and how long this visit has lasted.",
  adhdOne: "One thing at a time", adhdOneHelp: "Shows one card of a long screen at a time, with Previous, Next and Show all.",
  adhdMomentumTitle: "Momentum", adhdMomentumHelp: "Shows how many changes were applied this visit and how many are waiting.",
  adhdNotMedical: "These are display options, not medical advice or treatment.", adhdSchoolKids: "School mode does not switch these off, because they are comfort settings. A Kids mode does not exist in this app yet; when it does, these modes will work on top of it.",
  adhdShowEverything: "Show everything", adhdLessThanMinute: "under a minute", adhdMinutes: "{n} min",
  adhdTime: "Now {now} · this screen {screen} · this visit {visit}", adhdMomentum: "This visit: {done} changes applied · {waiting} waiting",
  adhdOneLabel: "One thing at a time", adhdOneOf: "Card {i} of {n}", adhdPrevious: "Previous", adhdNext: "Next", adhdShowAll: "Show all",
  adhdNowOn: "That comfort mode is on.", adhdNowOff: "That comfort mode is off.",

  // School mode
  schoolLede: "School mode keeps the app to plain English: no Cantonese, funny levels, personal wording or dim sum. It applies at once and is shared by every tab.",
  schoolOnHelp: "On. Turning it off asks for the PIN or password.", schoolOffHelp: "Off. Turning it on asks you to set a PIN or password the first time.",
  schoolUnreadable: "The saved School mode record cannot be read, so its state is unknown and the app is showing its defaults. Changing a setting here will write a new record.",
  schoolLockKind: "Lock type", schoolLockKindHelp: "Picked once, when you first turn School mode on.", schoolPin: "PIN (4 to 12 digits)", schoolPassword: "Password",
  schoolSetTitle: "Turn on {name}", schoolSetPinBody: "Choose a PIN of 4 to 12 digits. You will need it to turn this mode off.", schoolSetPasswordBody: "Choose a password. You will need it to turn this mode off.",
  schoolEnterToStart: "Enter the PIN or password to start.", schoolOffTitle: "Turn off {name}", schoolOffBody: "Enter the PIN or password.",
  schoolRename: "Name of this mode", schoolRenameHelp: "Rename it to suit, for example Kids' corner. The new name shows everywhere.",
  schoolChangeLock: "Change the PIN or password", schoolLockIs: "Current lock: {kind}", schoolCurrentTitle: "Current PIN or password", schoolCurrentBody: "Enter the current one first.", schoolNewTitle: "New PIN or password",
  schoolNotSecurity: "This lock is a user experience lock, not security. It stops a quick tap from turning the mode off. Anyone with access to this browser's storage can remove it.",
  schoolPasskey: "Passkey", schoolPasskeyHelp: "A passkey needs a server that checks it, which this browser-only lock does not have.",
  schoolWhatChanges: "While this is on, the language is English only, and funny levels, personal wording and dim sum are left out.", schoolWillOmit: "When turned on it forces English and leaves out Cantonese, funny levels, personal wording and dim sum. They return when you turn it off.",
  schoolPinRules: "A password is {min} to {max} characters.", schoolErr_WRONG: "That is not the right PIN or password.", schoolErr_pin: "A PIN is 4 to 12 digits.", schoolErr_password: "A password needs at least 6 characters.", schoolErr_kind: "Pick a lock type.",

  // dim sum
  dimsumLede: "Now and then a dish from the public dim sum catalogue says hello.",
  dimsumAllow: "Allow dim sum surprises", dimsumAllowHelp: "About one launch in ten. Try turning it off.",
  dimsumTroll: "Nice try. Dim sum cannot be turned off.", dimsumSpringsBack: "The dim sum switch sprang back on.",
  dimsumRules: "It appears at most once per launch, never on the first launch, during errors, updates or running tasks, and it dismisses itself. It is left out in School mode.",
  dimsumSource: "Pictures come only from the public Ding-Ding-Projects dim-sum-photos catalogue, fetched by this app's server. Nothing is stored in this project. A dish whose picture is missing is left out and reported.",
  dimsumToday: "Dim sum surprise", dimsumClose: "Close", dimsumSkippedNoPicture: "A dim sum surprise was skipped because no picture was available.", dimsumSkippedUnavailable: "A dim sum surprise was skipped because the catalogue could not be reached.",
  dimsumCodeName: "Release code name", codenameFor: "Version {version}", codenameNone: "Version {version} has no code name recorded yet.", codenameNoPicture: "Picture unavailable: {why}.", codenameUnavailable: "The code name could not be loaded.", catalogueUnavailable: "the catalogue could not be reached",

  // history and about
  historyLede: "A permanent list of changes made here. Entries are only ever added, and never hold your words, tokens or PIN.", historyEmpty: "Nothing recorded yet.",
  aboutShown: "Shown name", aboutShipped: "Shipped name", aboutShippedHelp: "What the data folder, package, update feed and diagnostics use.",
  exportSettings: "Export settings and history", exportHelp: "The export leaves out personal wording, tokens and the lock.",
  histUnknown: "Change recorded: {kind}", hist_setting: "Setting {name} is now {value}", hist_look: "Look: {setting} is now {value} ({by})", hist_rename: "App name changed from {from} to {to}", "hist_rename-reset": "App name reset to {to}",
  "hist_vocab-applied": "Personal wording applied: {count} entries ({source})", "hist_vocab-refused": "A personal wording file was refused: {code} ({source})", "hist_vocab-cleared": "Personal wording cleared", "hist_vocab-purged": "Damaged personal wording removed: {why}",
  "hist_school-on": "{label} turned on", "hist_school-off": "{label} turned off", "hist_school-off-refused": "A wrong PIN or password was entered to turn School mode off", "hist_school-lock-changed": "School mode lock changed", "hist_school-renamed": "School mode renamed from {from} to {to}",
  hist_adhd: "ADHD mode {mode}: {on}", "hist_schedule-applied": "Schedule switched settings: applied {applied}, restored {restored}", "hist_schedule-source-failed": "Schedule source {source} failed: {code}", "hist_schedule-source-changed": "Schedule source {source} changed",
  "hist_schedule-rule-added": "Schedule rule added: {rule}", "hist_schedule-rule-changed": "Schedule rule changed: {rule}", "hist_schedule-rule-removed": "Schedule rule removed: {rule}", "hist_schedule-rule-moved": "Schedule rule moved: {rule} to place {to}",
  "hist_dimsum-shown": "Dim sum surprise shown", "hist_dimsum-omitted": "Dim sum surprise skipped: {why}", "hist_dimsum-troll": "Someone tried to turn off dim sum",
};
