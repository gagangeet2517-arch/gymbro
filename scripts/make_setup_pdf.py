#!/usr/bin/env python3
"""Generate SETUP.pdf — the gymbro setup manual.

This is the source-of-truth generator for the PDF. Edit the content here and
re-run `python3 scripts/make_setup_pdf.py` to regenerate SETUP.pdf.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
    TableStyle, Preformatted, ListFlowable, ListItem, NextPageTemplate,
    PageBreak,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# ── Palette (matches the original manual) ──────────────────────────────────────
BLUE = HexColor('#2563EB')
INK = HexColor('#111111')
GRAY = HexColor('#555555')
MUTE = HexColor('#888888')
RULE = HexColor('#cccccc')
CODE_BG = HexColor('#f4f4f5')
NOTE_BG = HexColor('#fff8e1')
NOTE_BD = HexColor('#f0d98c')

REPO = 'github.com/gagangeet2517-arch/gymbro'
REPO_URL = 'https://github.com/gagangeet2517-arch/gymbro'

styles = getSampleStyleSheet()

body = ParagraphStyle('body', parent=styles['Normal'], fontName='Helvetica',
                      fontSize=10.5, leading=15, textColor=INK, spaceAfter=8)
h1 = ParagraphStyle('h1', parent=styles['Heading1'], fontName='Helvetica-Bold',
                    fontSize=18, leading=22, textColor=INK, spaceBefore=14, spaceAfter=2)
h2 = ParagraphStyle('h2', parent=styles['Heading2'], fontName='Helvetica-Bold',
                    fontSize=12.5, leading=16, textColor=INK, spaceBefore=12, spaceAfter=4)
note = ParagraphStyle('note', parent=body, fontSize=9.5, leading=13, textColor=HexColor('#6b5d20'))
bullet = ParagraphStyle('bullet', parent=body, spaceAfter=4)

# Title-page styles
t_big = ParagraphStyle('t_big', parent=styles['Title'], fontName='Helvetica-Bold',
                       fontSize=52, leading=58, textColor=BLUE, alignment=TA_CENTER)
t_sub = ParagraphStyle('t_sub', parent=styles['Title'], fontName='Helvetica-Bold',
                       fontSize=24, leading=28, textColor=INK, alignment=TA_CENTER)
t_desc = ParagraphStyle('t_desc', parent=body, fontSize=12, leading=18,
                        textColor=GRAY, alignment=TA_CENTER)
t_repo = ParagraphStyle('t_repo', parent=body, fontSize=11, textColor=GRAY, alignment=TA_CENTER)
t_link = ParagraphStyle('t_link', parent=body, fontName='Helvetica-Bold',
                        fontSize=11, textColor=BLUE, alignment=TA_CENTER)


def code(text):
    p = Preformatted(text, ParagraphStyle('code', fontName='Courier', fontSize=9.5,
                                          leading=13, textColor=HexColor('#222222')))
    t = Table([[p]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CODE_BG),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return t


def callout(text):
    p = Paragraph('<b>Note:</b> ' + text, note)
    t = Table([[p]], colWidths=[165 * mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NOTE_BG),
        ('BOX', (0, 0), (-1, -1), 0.75, NOTE_BD),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return t


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, bullet), leftIndent=14, value='•') for i in items],
        bulletType='bullet', start='•', leftIndent=12, spaceAfter=8,
    )


def heading(text):
    return Paragraph(text, h1)


def sub(text):
    return Paragraph(text, h2)


def para(text):
    return Paragraph(text, body)


# ── Page furniture (header rule + footer URL + page number) ─────────────────────
def later_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Header
    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(GRAY)
    canvas.drawString(20 * mm, h - 14 * mm, 'gymbro — Setup Manual')
    canvas.drawRightString(w - 20 * mm, h - 14 * mm, f'Page {doc.page}')
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, h - 16 * mm, w - 20 * mm, h - 16 * mm)
    # Footer
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTE)
    canvas.drawCentredString(w / 2, 12 * mm, REPO)
    canvas.restoreState()


def first_page(canvas, doc):
    # Title page: no header/footer.
    pass


def build():
    doc = BaseDocTemplate(
        'SETUP.pdf', pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=22 * mm, bottomMargin=20 * mm,
        title='gymbro — Setup Manual', author='gymbro',
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin,
                  doc.width, doc.height, id='main')
    doc.addPageTemplates([
        PageTemplate(id='first', frames=[frame], onPage=first_page),
        PageTemplate(id='later', frames=[frame], onPage=later_page),
    ])

    s = []  # story

    # ── Title page ──
    s.append(Spacer(1, 130))
    s.append(Paragraph('gymbro', t_big))
    s.append(Paragraph('Setup Manual', t_sub))
    s.append(Spacer(1, 18))
    s.append(Paragraph('A step-by-step guide to running the React Native workout tracker', t_desc))
    s.append(Paragraph('on your own device.', t_desc))
    s.append(Spacer(1, 230))
    s.append(Paragraph('Repository:', t_repo))
    s.append(Paragraph(REPO_URL, t_link))
    s.append(Spacer(1, 8))
    s.append(Paragraph('Built with Expo, React Native, and Expo Router', t_repo))
    s.append(NextPageTemplate('later'))
    s.append(PageBreak())

    # ── 1. What is gymbro? ──
    s.append(heading('1. What is gymbro?'))
    s.append(para('gymbro is a workout-tracking mobile app written with React Native, Expo, and Expo '
                  'Router. It runs on iOS, Android, and the web from a single codebase. Your workout, '
                  'nutrition, and body-metric data is stored locally on-device using AsyncStorage — '
                  'there is no backend and no account system.'))
    s.append(para('Core tracking (workouts, templates, history, progress charts) works fully offline. '
                  'The optional AI features — food-photo scanning, voice meal logging, and the nutrition '
                  'coach — call Google Gemini, so they need an internet connection and a Gemini API key '
                  '(see section 6). Everything else runs without a network.'))
    s.append(para('This manual walks through every step required to clone the project, install its '
                  'dependencies, run it on a simulator, emulator, or physical device, and enable the '
                  'optional AI features. On first launch the app shows a short onboarding walkthrough; '
                  'you can configure goals and reminders later from your Profile (see section 14).'))

    # ── 2. Prerequisites ──
    s.append(heading('2. Prerequisites'))
    s.append(para('Before you start, make sure the following are installed on your machine.'))
    s.append(sub('2.1  Node.js (v20.19 or newer)'))
    s.append(para('Expo SDK 54 requires Node 20.19+ or Node 22+. Verify your version:'))
    s.append(code('node --version'))
    s.append(para('If it is missing or too old, download the LTS installer from nodejs.org, or use a '
                  'version manager such as nvm or fnm:'))
    s.append(code('# Using nvm\nnvm install 22\nnvm use 22'))
    s.append(sub('2.2  Git'))
    s.append(para('Required for cloning the repository.'))
    s.append(code('git --version'))
    s.append(para('On macOS, install via Xcode Command Line Tools:'))
    s.append(code('xcode-select --install'))
    s.append(para('On Windows, download from git-scm.com. On Linux, use your package manager '
                  '(e.g. sudo apt install git).'))
    s.append(sub('2.3  A package manager'))
    s.append(para('npm ships with Node, so nothing extra to install. If you prefer yarn or pnpm, they '
                  'will work too — the examples in this guide use npm.'))
    s.append(sub('2.4  Platform tooling (pick at least one)'))
    s.append(para('You need a way to actually see the app running. Pick whichever option fits your '
                  'operating system and target platform:'))
    s.append(bullets([
        '<b>iOS Simulator (macOS only)</b> — install Xcode from the Mac App Store, then open it once '
        'to accept the license. After that run <font face="Courier">xcode-select --install</font> if you have not already.',
        '<b>Android Emulator (any OS)</b> — install Android Studio, open it, and use the AVD Manager '
        'to create a virtual device (Pixel 7, API 34 is a safe default). Make sure ANDROID_HOME points to your SDK folder.',
        '<b>Physical phone with Expo Go</b> — the fastest way to test on a real device. Install the free '
        '"Expo Go" app and scan the QR code Expo prints when you start the dev server. Phone and computer must share a Wi-Fi network.',
        '<b>Physical iPhone, native build</b> — to install a full standalone build on your own iPhone '
        '(required for camera-based food scanning), see section 7.',
        '<b>Web browser</b> — no extra tools needed; some native features fall back gracefully.',
    ]))
    s.append(callout('On macOS the recommended combo is the iOS Simulator (built in) plus Expo Go on '
                     'your phone. On Windows or Linux, use the Android Emulator and/or Expo Go.'))

    # ── 3. Cloning ──
    s.append(heading('3. Cloning the repository'))
    s.append(para('Open a terminal in the folder where you want the project to live, then run:'))
    s.append(code('git clone https://github.com/gagangeet2517-arch/gymbro.git\ncd gymbro'))
    s.append(para('If you already have a local copy and just want to pull the latest changes:'))
    s.append(code('cd gymbro\ngit pull origin main'))

    # ── 4. Installing dependencies ──
    s.append(heading('4. Installing dependencies'))
    s.append(para('From the project root, install everything listed in package.json:'))
    s.append(code('npm install'))
    s.append(para('This pulls down React, React Native, Expo, the navigation libraries, AsyncStorage, '
                  'react-native-svg (progress charts), expo-notifications (goal reminders), and the rest '
                  'of the dependencies. The first install can take a few minutes.'))
    s.append(callout('If the install fails with a peer-dependency error, try '
                     '<font face="Courier">npm install --legacy-peer-deps</font>. If it fails with a permissions '
                     'error, never use sudo — fix the npm prefix instead (see troubleshooting).'))

    # ── 5. Running the app ──
    s.append(heading('5. Running the app'))
    s.append(para('All run commands start with <font face="Courier">npx expo</font> so you do not need to '
                  'install the Expo CLI globally.'))
    s.append(sub('5.1  Start the dev server'))
    s.append(code('npx expo start'))
    s.append(para('This launches the Metro bundler and shows a menu in your terminal along with a QR '
                  'code. From here you can press a key to open the app:'))
    s.append(bullets([
        'Press <b>i</b> to open the iOS Simulator (macOS).',
        'Press <b>a</b> to open the Android Emulator (or a connected device).',
        'Press <b>w</b> to open the web build in your default browser.',
        'Or scan the QR code with your phone (Camera app on iOS, the Expo Go app on Android).',
    ]))
    s.append(sub('5.2  Open a specific platform directly'))
    s.append(code('npx expo start --ios\nnpx expo start --android\nnpx expo start --web'))
    s.append(sub('5.3  Reload after code changes'))
    s.append(para('Saving a file triggers Fast Refresh automatically. If state gets stuck, press '
                  '<b>r</b> in the dev-server terminal to force a full reload, or shake the device to open '
                  'the developer menu.'))

    # ── 6. AI features (Gemini key) ── NEW
    s.append(heading('6. Enabling AI features (optional)'))
    s.append(para('Food-photo scanning, voice meal logging, and the nutrition coach run on Google '
                  'Gemini. They are entirely optional — the rest of the app works without them — but to '
                  'use them you need a free Gemini API key.'))
    s.append(sub('6.1  Get a free key'))
    s.append(para('Sign in at aistudio.google.com/apikey and create an API key. It is free for the usage '
                  'limits this app needs and takes about a minute.'))
    s.append(sub('6.2  Add the key in Profile'))
    s.append(para('The key lives in your in-app Profile. Step by step:'))
    s.append(bullets([
        'Open the app and tap the <b>Home</b> tab.',
        'Tap the profile / avatar icon to open <b>Your Profile</b>.',
        'Scroll to <b>AI features · Gemini key</b> and paste your key into the field.',
        'Tap <b>Save profile</b>. A "Using your key" status confirms it is active.',
    ]))
    s.append(callout('No key, no AI: if the photo scan, voice logging, or coach show '
                     '"Add your Google Gemini API key in Profile", it means this step has not been done. '
                     'The key is stored locally on the device and is used in preference to any shared key.'))
    s.append(sub('6.3  Optional environment fallback (developers)'))
    s.append(para('For local development you can instead provide keys via a <font face="Courier">.env.local</font> '
                  'file at the project root. A key entered in Profile always takes priority over these:'))
    s.append(code('EXPO_PUBLIC_GOOGLE_AI_KEY=your_key_here\n'
                  '# optional extra keys, tried in order if the first is rate-limited\n'
                  'EXPO_PUBLIC_GOOGLE_AI_KEY_2=...\n'
                  'EXPO_PUBLIC_GOOGLE_AI_KEY_3=...'))
    s.append(callout('Never commit real API keys. <font face="Courier">.env.local</font> is git-ignored; '
                     'the in-app Profile key never leaves the device.'))

    # ── 7. Physical iPhone ── NEW
    s.append(heading('7. Installing on a physical iPhone'))
    s.append(para('To run a full native build on your own iPhone (needed for the camera-based food '
                  'scanner), build and install it over USB. A convenience script is wired up in '
                  'package.json:'))
    s.append(code('npm run deploy:iphone'))
    s.append(para('This runs a Release xcodebuild and installs the resulting .app onto the connected '
                  'device with <font face="Courier">xcrun devicectl</font>. Before the first run:'))
    s.append(bullets([
        'Connect the iPhone over USB and trust the computer.',
        'Open <font face="Courier">ios/gymbro.xcworkspace</font> in Xcode once, sign in with your Apple '
        'ID under Signing &amp; Capabilities, and pick your team so provisioning is set up.',
        'Update the device id and DEVELOPMENT_TEAM in the deploy:iphone script to match your device '
        'and Apple ID (find the device id with <font face="Courier">xcrun devicectl list devices</font>).',
    ]))
    s.append(callout('Builds signed with a free (non-paid) Apple ID expire after 7 days. When the app '
                     'stops launching, plug the phone back in and re-run '
                     '<font face="Courier">npm run deploy:iphone</font> to refresh it. Reinstalling keeps your '
                     'existing on-device data.'))

    # ── 8. Verifying ──
    s.append(heading('8. Verifying your setup'))
    s.append(para('Once the app loads you should see the Home tab. To confirm everything is wired up:'))
    s.append(bullets([
        'Navigate between the bottom tabs — none should crash.',
        'Open Workouts — starter templates are seeded automatically on first launch.',
        'Start a workout, log a set, and finish it. Check the History tab to confirm it saved.',
        'Force-quit and reopen the app. Your data should persist because it lives in AsyncStorage.',
        '(If you added a Gemini key) open Nutrition and try the photo scan to confirm AI features work.',
    ]))

    # ── 9. Project structure ──
    s.append(heading('9. Project structure (high level)'))
    s.append(para('Knowing where things live helps when you start making changes:'))
    s.append(bullets([
        '<b>app/</b> — file-based routes (Expo Router). <font face="Courier">_layout.tsx</font> wraps the '
        'tree in the context providers. <font face="Courier">(tabs)/</font> holds the bottom-tab screens.',
        '<b>context/</b> — six providers, each persisting to AsyncStorage with a hasHydrated guard: '
        'ExerciseContext, TemplateContext, WorkoutContext, NutritionContext, UserProfileContext, and BodyMetricsContext.',
        '<b>data/exerciseCatalog.ts</b> — the static catalog of built-in exercises and the goal-based starter templates.',
        '<b>utils/</b> — helpers such as foodVision (Gemini), calorieBurn, nutritionGoals, and userApiKey.',
        '<b>components/ui/</b> — shared primitives like AppButton and AppCard.',
        '<b>assets/</b> — icons, splash screens, fonts.',
    ]))

    # ── 10. Useful scripts ──
    s.append(heading('10. Useful scripts'))
    s.append(para('Defined in package.json:'))
    s.append(code('npm run start          # alias for `expo start`\n'
                  'npm run ios            # `expo run:ios` (full native build)\n'
                  'npm run android        # `expo run:android`\n'
                  'npm run web            # `expo start --web`\n'
                  'npm run lint           # ESLint\n'
                  'npm run deploy:iphone  # Release build + install to a connected iPhone'))
    s.append(para('Type-check the project without compiling:'))
    s.append(code('npx tsc --noEmit'))

    # ── 11. Troubleshooting ──
    s.append(heading('11. Troubleshooting'))
    s.append(sub('11.1  Metro is serving stale code'))
    s.append(code('npx expo start -c'))
    s.append(sub('11.2  Weird native errors after pulling new code'))
    s.append(code('rm -rf node_modules\nnpm install\ncd ios && pod install && cd ..'))
    s.append(sub('11.3  iOS Simulator never opens'))
    s.append(para('Open Xcode once, accept the license, and point the command-line tools at the full Xcode:'))
    s.append(code('sudo xcode-select -s /Applications/Xcode.app/Contents/Developer'))
    s.append(sub('11.4  AI features say "Add your Gemini key"'))
    s.append(para('No key is configured. Add one under Home → Profile → "AI features · Gemini key" '
                  '(section 6), or set EXPO_PUBLIC_GOOGLE_AI_KEY in .env.local for local dev.'))
    s.append(sub('11.5  QR code scan fails on a real phone'))
    s.append(bullets([
        'Confirm the phone and computer are on the same Wi-Fi.',
        'Some networks block the required ports; try a hotspot or tunnel mode: '
        '<font face="Courier">npx expo start --tunnel</font>.',
        'If Expo Go cannot load a JS bundle, fully close Expo Go and rescan.',
    ]))
    s.append(sub('11.6  npm permission errors during install'))
    s.append(para('Do not run npm with sudo. Instead, point the npm prefix at a folder you own:'))
    s.append(code("mkdir -p ~/.npm-global\n"
                  "npm config set prefix '~/.npm-global'\n"
                  "export PATH=~/.npm-global/bin:$PATH   # add to ~/.zshrc"))

    # ── 12. Pulling updates ──
    s.append(heading('12. Pulling in updates'))
    s.append(para('To grab the latest changes from GitHub:'))
    s.append(code('git pull origin main\nnpm install        # in case new dependencies were added'))
    s.append(para('If the Expo SDK version changes between pulls, also run:'))
    s.append(code('npx expo install --check'))

    # ── 13. Pushing changes ──
    s.append(heading('13. Pushing your own changes'))
    s.append(para('Make a feature branch, commit, and push:'))
    s.append(code('git checkout -b my-feature\n# ... make changes ...\ngit add .\n'
                  'git commit -m "Describe what you changed"\ngit push -u origin my-feature'))
    s.append(para('Then open a pull request on GitHub to merge your branch into main.'))

    # ── 14. Goals, onboarding & reminders ──
    s.append(heading('14. Goals, onboarding & reminders'))
    s.append(para('First-time users see a short swipeable onboarding walkthrough explaining workouts, '
                  'AI nutrition, progress, and goals. It only appears once (a flag is stored in '
                  'AsyncStorage); reinstalling or clearing app data shows it again.'))
    s.append(para('Everything below lives in Home → Profile:'))
    s.append(bullets([
        '<b>Training goal</b> — a dropdown to pick Fat loss / Lean bulk / Maintenance / Recomp. '
        'Drives the goal-based starter templates and computed nutrition targets.',
        '<b>Other goals</b> — a dropdown holding habit goals (hydration, steps, sleep, consistency) '
        'plus your reminders.',
        '<b>Daily reminder</b> — a notification at a time you choose, every day. Add an optional '
        'custom message (e.g. "Hit 180g protein today") that appears in the notification.',
        '<b>Long-term reminder</b> — a notification at a time you choose, repeating on a custom '
        'interval (daily / weekly / monthly). Type your goal (e.g. "Lose 5 kg by August 1st") and '
        'it becomes the notification text so you are reminded of the specific goal.',
    ]))
    s.append(callout('Reminders use local notifications, so the app asks for notification permission '
                     'the first time you enable one. They require the native build (expo-notifications), '
                     'not Expo Go. If reminders never fire, check notification permission in your phone settings.'))

    # ── 15. Help ──
    s.append(heading('15. Where to get help'))
    s.append(bullets([
        'Expo documentation — docs.expo.dev',
        'React Native documentation — reactnative.dev',
        'Expo Router — docs.expo.dev/router/introduction',
        'Google AI Studio (Gemini keys) — aistudio.google.com',
        f'Open an issue at {REPO}/issues for anything specific to this project.',
    ]))
    s.append(Spacer(1, 10))
    s.append(Paragraph('<i>End of manual. This PDF is generated from '
                       'scripts/make_setup_pdf.py — edit that file and re-run it to update the guide.</i>',
                       ParagraphStyle('end', parent=body, textColor=GRAY, fontSize=9.5)))

    doc.build(s)
    print('Wrote SETUP.pdf')


if __name__ == '__main__':
    build()
