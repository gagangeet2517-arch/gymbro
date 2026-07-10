# gymbro 💪

A personal workout + nutrition tracker for iPhone. Log workouts from ready-made plans (your last weights are pre-filled), snap photos of meals to count calories with AI, speak your sets out loud ("sixty by eight"), and watch your strength grow on charts. Everything stays on your phone — no account, no cloud, no subscription.

## 📲 Want the app on your phone?

- **iPhone → read [SETUP.pdf](SETUP.pdf).** Written for complete beginners: no programming knowledge needed, every click spelled out, from an empty Mac to the app running on your phone in about an hour. (Needs a Mac + free Apple ID; free installs last 7 days, then a two-minute refresh. Your data always survives.)
- **Android → read [SETUP-ANDROID.pdf](SETUP-ANDROID.pdf).** Even easier: install a single `gymbro.apk` file in two minutes, straight on the phone — no computer, no expiry. The guide also covers how one person builds that .apk for everyone (free Expo cloud build, any OS).

## What's inside

- **Workouts** — goal-tuned starter templates (Push/Pull/Legs/Upper), cross-session prefill, add/remove exercises mid-workout, auto-generated warm-up & cool-down
- **Guided mode** — one set at a time with a rest timer, like having a coach
- **Voice logging** — on-device speech, works offline, zero API cost
- **Nutrition** — AI photo scanning, barcode scanner, late-night meal handling, daily macro targets computed from your goal
- **Progress** — strength/bodyweight/body-fat charts, research-cited insights (plateau detection, volume management, muscle-neglect warnings)
- **Reminders** — daily + long-term goal notifications with your own message

AI features (photo scanning, nutrition coach) use Google Gemini with a **bring-your-own free key** ([get one here](https://aistudio.google.com/apikey), paste it in Profile) — see SETUP.pdf §10.

## For developers

Standard Expo / React Native (SDK 54, React 19, Expo Router) project. All state is local via AsyncStorage — no backend.

```bash
npm install
npx expo prebuild -p ios   # generates the ios/ project (not checked in)
npx expo run:ios --device  # or open ios/gymbro.xcworkspace and hit ▶
```

Architecture notes live in [CLAUDE.md](CLAUDE.md). The install guide is generated from [scripts/make_setup_pdf.py](scripts/make_setup_pdf.py) — edit that and re-run, don't hand-edit the PDF.
