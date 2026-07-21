#!/usr/bin/env python3
"""Generate SETUP.pdf — the gymbro install guide for complete beginners.

Written for someone who has never opened Terminal or heard of Xcode:
every click and every typed line is spelled out, in order, with what to
expect at each step. Edit the content here and re-run
`python3 scripts/make_setup_pdf.py` to regenerate SETUP.pdf.
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

# ── Palette ────────────────────────────────────────────────────────────────────
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


def steps(items):
    return ListFlowable(
        [ListItem(Paragraph(i, bullet), leftIndent=14) for i in items],
        bulletType='1', leftIndent=12, spaceAfter=8,
    )


def heading(text):
    return Paragraph(text, h1)


def sub(text):
    return Paragraph(text, h2)


def para(text):
    return Paragraph(text, body)


def later_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFont('Helvetica', 8.5)
    canvas.setFillColor(GRAY)
    canvas.drawString(20 * mm, h - 14 * mm, 'gymbro — Install Guide')
    canvas.drawRightString(w - 20 * mm, h - 14 * mm, f'Page {doc.page}')
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, h - 16 * mm, w - 20 * mm, h - 16 * mm)
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MUTE)
    canvas.drawCentredString(w / 2, 12 * mm, REPO)
    canvas.restoreState()


def first_page(canvas, doc):
    pass


def build():
    doc = BaseDocTemplate(
        'SETUP.pdf', pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=22 * mm, bottomMargin=20 * mm,
        title='gymbro — Install Guide', author='gymbro',
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='main')
    doc.addPageTemplates([
        PageTemplate(id='first', frames=[frame], onPage=first_page),
        PageTemplate(id='later', frames=[frame], onPage=later_page),
    ])

    s = []

    # ── Title page ──
    s.append(Spacer(1, 130))
    s.append(Paragraph('gymbro', t_big))
    s.append(Paragraph('Install Guide', t_sub))
    s.append(Spacer(1, 18))
    s.append(Paragraph('Get the workout tracker onto your own iPhone —', t_desc))
    s.append(Paragraph('written for complete beginners. Every click is spelled out.', t_desc))
    s.append(Spacer(1, 230))
    s.append(Paragraph('Repository:', t_repo))
    s.append(Paragraph(REPO_URL, t_link))
    s.append(Spacer(1, 8))
    s.append(Paragraph('Free to install with any Apple ID · no programming knowledge needed', t_repo))
    s.append(NextPageTemplate('later'))
    s.append(PageBreak())

    # ── 1 ──
    s.append(heading('1. What is gymbro, and what are we about to do?'))
    s.append(para('gymbro is a personal workout and nutrition tracker: log workouts from ready-made '
                  'plans, snap photos of meals to count calories with AI, speak your sets out loud, '
                  'and watch your strength grow on charts. Everything stays on your phone — no '
                  'account, no cloud.'))
    s.append(para('Because gymbro is not on the App Store, you install it yourself using a Mac. '
                  'Don\'t worry if you have never done anything like this: this guide assumes zero '
                  'experience and walks through every single click. The one-time setup takes about '
                  'an hour (mostly waiting for downloads). After that, keeping the app running takes '
                  'two minutes a week.'))

    # ── 2 ──
    s.append(heading('2. What you need'))
    s.append(bullets([
        '<b>A Mac</b> (any reasonably recent MacBook or iMac).',
        '<b>Your iPhone</b> and its <b>charging cable</b> (it must connect to the Mac).',
        '<b>An Apple ID</b> — the normal, free one you already use for the App Store.',
        '<b>About 15 GB of free disk space</b> on the Mac (the Apple developer tools are big).',
        'About <b>an hour</b>, most of it waiting for downloads.',
    ]))
    s.append(callout('You do NOT need: a paid developer account, programming knowledge, or an '
                     'Android phone (this guide is iPhone-only).'))

    # ── 3 ──
    s.append(heading('3. Sixty seconds of background (worth reading)'))
    s.append(sub('3.1  What is "Terminal"?'))
    s.append(para('Terminal is an app that comes with every Mac. Instead of clicking buttons, you '
                  'type a line of text and press <b>Enter</b> (Return), and the Mac carries out that '
                  'instruction. That\'s the whole idea. You type a line — exactly as written in this '
                  'guide — press Enter, and wait until new text stops appearing and you see the '
                  'blinking cursor again. Then you type the next line.'))
    s.append(para('To open it: press <b>⌘ (Command) + Spacebar</b>, type <b>terminal</b>, press Enter.'))
    s.append(sub('3.2  What does "cd" mean?'))
    s.append(para('Terminal is always "standing inside" one folder, and commands act on that folder. '
                  '<font face="Courier">cd</font> (change directory) is how you walk into a folder. So '
                  '<font face="Courier">cd ~/Desktop/gymbro-main</font> means: "go into the gymbro-main '
                  'folder on my Desktop". A trick that avoids typos: type '
                  '<font face="Courier">cd&nbsp;</font> (with a space), then drag the folder from Finder '
                  'into the Terminal window — the path fills itself in — then press Enter.'))
    s.append(sub('3.3  What are Xcode, Node, and the rest?'))
    s.append(bullets([
        '<b>Xcode</b> — Apple\'s free app for building iPhone apps. We use it to sign and install gymbro.',
        '<b>Node.js</b> — a free program that runs the app\'s build tools.',
        '<b>Homebrew &amp; CocoaPods</b> — two small helper tools the build needs. Installed with one '
        'pasted line each.',
    ]))

    # ── 4 ──
    s.append(heading('4. One-time: install the tools (≈45 min, mostly waiting)'))
    s.append(sub('4.1  Install Xcode'))
    s.append(steps([
        'Open the <b>App Store</b> app on the Mac.',
        'Search for <b>Xcode</b>, click <b>Get</b>, then <b>Install</b>. It is a very large download '
        '(often 30–60 minutes) — start it and move on to step 4.2 while it downloads.',
        'When it finishes, <b>open Xcode once</b>. Click <b>Agree</b> on the licence, let it '
        '"install components" if it asks, then you can close it.',
    ]))
    s.append(sub('4.2  Install Node.js'))
    s.append(steps([
        'In a web browser, go to <b>nodejs.org</b>.',
        'Click the big green <b>LTS</b> download button (the version number doesn\'t matter).',
        'Open the downloaded <font face="Courier">.pkg</font> file and click '
        '<b>Continue → Continue → Agree → Install</b>. Enter your Mac password when asked.',
    ]))
    s.append(sub('4.3  Install Homebrew, then CocoaPods'))
    s.append(para('Open Terminal (⌘+Space → "terminal" → Enter). Copy-paste this whole line, press '
                  'Enter, type your Mac password when asked (the password stays invisible while you '
                  'type — that\'s normal), and follow any "press RETURN to continue" prompts:'))
    s.append(code('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'))
    s.append(para('When Homebrew finishes it may print a box saying <b>"Next steps"</b> with two '
                  'commands to run — copy-paste those two lines too (they connect Homebrew to your '
                  'Terminal). Then install CocoaPods:'))
    s.append(code('brew install cocoapods'))
    s.append(callout('If a command replies "command not found: brew", you skipped the "Next steps" '
                     'lines above — scroll up in Terminal, find them, and run them. Then close '
                     'Terminal, reopen it, and try again.'))

    # ── 5 ──
    s.append(heading('5. Get the app\'s code (2 minutes)'))
    s.append(para('The easiest way — no extra tools needed:'))
    s.append(steps([
        f'In a browser, go to <b>{REPO_URL}</b>.',
        'Click the green <b>&lt;&gt; Code</b> button, then <b>Download ZIP</b>.',
        'Open your <b>Downloads</b> folder and double-click <font face="Courier">gymbro-main.zip</font> '
        '— it unzips into a folder called <b>gymbro-main</b>.',
        'Drag the <b>gymbro-main</b> folder onto your <b>Desktop</b>.',
    ]))
    s.append(callout('That folder IS the app. Don\'t rename it or move things around inside it. '
                     '(If a techie friend set you up with "git clone" instead, your folder is called '
                     '<b>gymbro</b>, not gymbro-main — use that name in the commands below.)'))

    # ── 6 ──
    s.append(heading('6. Prepare the project (10 minutes, two commands)'))
    s.append(para('In Terminal, go into the app folder:'))
    s.append(code('cd ~/Desktop/gymbro-main'))
    s.append(para('Now run these two commands, <b>one at a time</b>, waiting for each to finish. The '
                  'first downloads the app\'s building blocks (2–5 minutes, prints a lot of text — '
                  'warnings are normal). The second generates the iPhone project (a few more minutes):'))
    s.append(code('npm install\nnpx expo prebuild -p ios'))
    s.append(para('You\'re done when the cursor is blinking again with no error in red. A new '
                  '<b>ios</b> folder now exists inside gymbro-main.'))

    # ── 7 ──
    s.append(heading('7. Connect your Apple ID (5 minutes, one time)'))
    s.append(para('Apple requires every iPhone app to be "signed" by someone. You\'ll sign it with '
                  'your own free Apple ID. In Terminal:'))
    s.append(code('open ios/gymbro.xcworkspace'))
    s.append(para('Xcode opens. Then:'))
    s.append(steps([
        'Menu bar → <b>Xcode → Settings</b> (or Preferences) → <b>Accounts</b> tab.',
        'Click the <b>+</b> in the bottom-left → <b>Apple ID</b> → sign in. Close Settings.',
        'In the left sidebar, click the blue <b>gymbro</b> icon at the very top.',
        'In the middle of the window, click the <b>Signing &amp; Capabilities</b> tab.',
        'Tick <b>Automatically manage signing</b>, and under <b>Team</b> choose your own name '
        '("Personal Team").',
        'If a red error says the bundle identifier is <b>"not available"</b>: click in the '
        '<b>Bundle Identifier</b> box just above and change it to something personal, e.g. '
        '<font face="Courier">com.yourfirstname.gymbro</font>. The error disappears.',
    ]))

    # ── 8 ──
    s.append(heading('8. Put gymbro on your iPhone'))
    s.append(sub('8.1  Prepare the phone (one time)'))
    s.append(steps([
        'Plug the iPhone into the Mac with the cable and <b>unlock it</b>.',
        'If the phone shows <b>"Trust This Computer?"</b> → tap <b>Trust</b>, enter your passcode.',
        'On the phone: <b>Settings → Privacy &amp; Security</b> → scroll to the very bottom → '
        '<b>Developer Mode</b> → turn it <b>On</b> → the phone restarts → unlock it and confirm.',
    ]))
    s.append(callout('Can\'t find Developer Mode? It sometimes only appears AFTER the first install '
                     'attempt. Do step 8.2 once, let it fail, then check Settings again — it will be there.'))
    s.append(sub('8.2  Install'))
    s.append(steps([
        'In Xcode, look at the toolbar at the top. Next to the play button there is a device menu — '
        'click it and choose <b>your iPhone</b> (it\'s listed by name, above the simulators).',
        'Press the <b>▶ (play) button</b> in the top-left.',
        'The first build takes 5–10 minutes. When it finishes, <b>gymbro appears on your iPhone</b>.',
        'First open only: if the phone says <b>"Untrusted Developer"</b> → on the phone go to '
        '<b>Settings → General → VPN &amp; Device Management</b> → tap your Apple ID → <b>Trust</b>. '
        'Open the app again.',
    ]))
    s.append(para('That\'s it. The app greets you with a short welcome tour, and small green cards '
                  'explain each feature the first time you reach it.'))

    # ── 9 ──
    s.append(heading('9. The 7-day rule (read this!)'))
    s.append(para('Apps signed with a free Apple ID stop opening after <b>7 days</b>. This is an '
                  'Apple restriction, not a bug. When gymbro suddenly won\'t open:'))
    s.append(steps([
        'Plug the iPhone into the Mac and unlock it.',
        'Open Xcode (your project reopens via <b>File → Recent</b>), make sure your iPhone is '
        'selected in the device menu, and press <b>▶</b> again.',
    ]))
    s.append(para('Two minutes, and the app runs for another 7 days. <b>Your workouts, meals, and '
                  'settings are never lost</b> — reinstalling on top keeps all data.'))

    # ── 10 ──
    s.append(heading('10. Optional: let everyone refresh it themselves with AltStore'))
    s.append(para('Right now, only the Mac that has Xcode set up (yours, from sections 1–8) can '
                  'refresh gymbro every 7 days. If friends installed it from your Mac too, they need '
                  '<b>you</b> every week. <b>AltStore</b> fixes that: each friend does a short '
                  'one-time setup on their own computer, and after that their phone refreshes itself '
                  'automatically — forever, for free, with no Apple Developer Program and no more '
                  'asking you.'))
    s.append(callout('This does not remove Apple\'s 7-day rule — nothing free can, that\'s Apple\'s '
                     'own policy. AltStore just automates <i>who</i> does the refreshing: instead of '
                     'you doing it for everyone, each person\'s own computer does it for them.'))

    s.append(sub('10.1  What you need first: a shared .ipa file'))
    s.append(para('AltStore installs a single file called an <font face="Courier">.ipa</font> — '
                  'think of it like the Android <font face="Courier">.apk</font> from the other '
                  'guide, but for iPhone. Someone who already has gymbro building in Xcode (section '
                  '8) needs to export this file <b>once</b> and share it (e.g. upload it to the '
                  'project\'s GitHub Releases, or send it directly). See section 10.5 below for '
                  'exactly how.'))

    s.append(sub('10.2  Part 1 — Each friend sets up AltStore (≈15 minutes, one time)'))
    s.append(para('This needs a Windows or Mac computer — it does not have to be the same Mac used '
                  'to build gymbro.'))
    s.append(steps([
        'On the computer, go to <b>altstore.io</b> and download <b>AltServer</b> for Windows or Mac.',
        'Mac: drag <font face="Courier">AltServer.app</font> into the <b>Applications</b> folder, '
        'then open it — a small icon appears in the menu bar at the top of the screen. '
        'Windows: unzip the download, run <b>Setup.exe</b>, then also install <b>iTunes and iCloud '
        'from Apple\'s own website</b> (not the Microsoft Store) if not already installed — '
        'AltServer needs them to talk to the iPhone.',
        'Plug the iPhone into that computer with a cable and <b>unlock it</b>. Tap <b>Trust</b> if asked.',
        'Mac: open Finder, click the iPhone in the sidebar, tick <b>"Show this iPhone when on '
        'Wi-Fi"</b>. Windows: open iTunes, sign in, and enable <b>Wi-Fi sync</b> for the device.',
        'Click the AltServer icon (menu bar on Mac, system tray on Windows) → <b>Install AltStore</b> '
        '→ choose the iPhone from the list.',
        'A box appears asking for an Apple ID — type in your <b>own free Apple ID</b> (the normal '
        'one used for the App Store). This only goes to Apple, never anywhere else.',
        'On the iPhone: <b>Settings → General → VPN &amp; Device Management</b> → tap the new '
        'profile → <b>Trust</b>.',
        'Still on the iPhone: <b>Settings → Privacy &amp; Security</b> → scroll to the bottom → '
        '<b>Developer Mode</b> → turn it <b>On</b> → the phone restarts, unlock it and confirm.',
    ]))
    s.append(para('AltStore is now on the phone — you\'ll see its icon like any other app.'))

    s.append(sub('10.3  Installing gymbro through AltStore'))
    s.append(steps([
        f'On the iPhone, get the <font face="Courier">gymbro.ipa</font> file onto it — easiest way: '
        f'open the link to it (e.g. from {REPO}/releases) in Safari and tap Download, or AirDrop it '
        'from another Apple device.',
        'Open the <b>Files</b> app, find the downloaded .ipa, tap and hold it, and choose '
        '<b>Share → AltStore</b>. (If AltStore doesn\'t appear in the list, open AltStore first, go '
        'to the <b>My Apps</b> tab, tap <b>+</b> in the top-left, and browse to the file instead.)',
        'AltStore installs it exactly like the Install step in section 8 — the same "Untrusted '
        'Developer" trust step appears if needed (Settings → General → VPN &amp; Device Management '
        '→ Trust).',
    ]))

    s.append(sub('10.4  Keeping it alive — no more asking anyone'))
    s.append(para('AltStore automatically tries to refresh gymbro in the background whenever the '
                  'phone is on the <b>same Wi-Fi network</b> as the computer running AltServer — so '
                  'leave AltServer open (it can just sit in the menu bar / system tray) and it takes '
                  'care of itself. To refresh right away instead: open AltStore, go to <b>My '
                  'Apps</b>, and tap <b>Refresh All</b>.'))
    s.append(callout('AltServer genuinely needs to be running on that computer for a refresh to '
                     'work — the phone can\'t re-sign itself alone. If a week goes by with the '
                     'computer never turned on, gymbro will still expire; just open AltServer, get '
                     'on the same Wi-Fi as the phone, and refresh. Also: a free Apple ID can only '
                     'keep <b>3 apps</b> signed at once on one device — if AltStore refuses to '
                     'install, that limit is the usual reason.'))

    s.append(sub('10.5  Part 2 — Exporting the .ipa (for whoever already has gymbro in Xcode)'))
    s.append(para('Once you\'ve completed section 8 and gymbro runs on your own phone, you can '
                  'export a shareable file for everyone else to sideload with AltStore:'))
    s.append(steps([
        'In Xcode (open via <font face="Courier">open ios/gymbro.xcworkspace</font> if it isn\'t '
        'already open), pick <b>Any iOS Device</b> from the device menu at the top — not your own '
        'phone this time.',
        'Menu bar → <b>Product → Archive</b>. This takes a few minutes — it\'s building a release copy.',
        'When it finishes, the <b>Organizer</b> window opens automatically with your archive '
        'selected. Click <b>Distribute App</b>.',
        'Choose <b>Development</b> (the only option available with a free Apple ID) → <b>Next</b> '
        'through the remaining screens, leaving the defaults, until you reach <b>Export</b>.',
        'Pick a folder to save into. Xcode creates a folder there containing '
        '<font face="Courier">gymbro.ipa</font> — that\'s the file everyone else needs.',
        f'Share it: upload it to a <b>Release</b> on {REPO} (same place as the Android .apk), or '
        'send it directly via AirDrop, Drive, or email.',
    ]))
    s.append(callout('This .ipa still "expires" 7 days from whenever it was exported — that\'s fine. '
                     'AltStore resigns it fresh with each friend\'s own Apple ID the moment they '
                     'install it, so the original export date doesn\'t matter to them.'))

    # ── 11 (was 10) ──
    s.append(heading('11. Turn on the AI features (optional, free)'))
    s.append(para('Photo food scanning and the nutrition coach use Google Gemini and need a free key:'))
    s.append(steps([
        'On any device, go to <b>aistudio.google.com/apikey</b>, sign in with a Google account, '
        'click <b>Create API key</b>, and copy it.',
        'In gymbro: <b>Home tab → Profile → AI features · Gemini key</b> → paste → <b>Save profile</b>.',
        'The status line says <b>"Using your key"</b> — done. The key never leaves your phone.',
    ]))

    # ── 12 (was 11) ──
    s.append(heading('12. Quick tour — what the app can do'))
    s.append(bullets([
        '<b>Workouts tab</b> — start from a ready-made plan; your weights and reps from last time are '
        'pre-filled so you just try to beat them. Add/remove exercises mid-workout; a warm-up and '
        'cool-down checklist is generated for every session.',
        '<b>Guide me</b> — a coach mode that walks you through one set at a time with a rest timer.',
        '<b>Voice logging</b> — tap the mic and say "sixty by eight"; the set logs itself. Works '
        'offline, costs nothing.',
        '<b>Nutrition tab</b> — photograph your plate or scan a barcode; the AI counts calories and '
        'protein. Late-night meals ask whether they belong to yesterday or today.',
        '<b>Progress tab</b> — bodyweight, body fat %, and strength charts fill in automatically, with '
        'research-based insights (plateaus, volume spikes, neglected muscles).',
        '<b>Profile (Home tab)</b> — pick a training goal (it tunes plans and calorie targets), habit '
        'goals, and daily / long-term reminders with your own message.',
    ]))
    s.append(callout('The app explains itself as you go: the first time you reach a feature, a small '
                     'dismissible card describes it. It shows once and disappears after you use the '
                     'feature or tap ✕.'))

    # ── 13 (was 12) ──
    s.append(heading('13. When something goes wrong'))
    s.append(sub('13.1  Terminal says "command not found: npm" (or brew, or npx)'))
    s.append(para('The tool from section 4 isn\'t installed or Terminal hasn\'t noticed it yet. '
                  'Close Terminal completely (⌘Q), reopen it, try again. Still failing → redo the '
                  'relevant part of section 4.'))
    s.append(sub('13.2  Terminal says "permission denied" or "no such file or directory"'))
    s.append(para('Almost always a path problem. Use the drag-trick: type '
                  '<font face="Courier">cd&nbsp;</font> (with a space), drag the gymbro-main folder from '
                  'Finder into the Terminal window, press Enter. Never run a folder path on its own '
                  'without <font face="Courier">cd</font> in front.'))
    s.append(sub('13.3  Xcode: "bundle identifier not available" / signing errors'))
    s.append(para('Section 7, last step — change the Bundle Identifier to '
                  '<font face="Courier">com.yourname.gymbro</font> and re-pick your Team.'))
    s.append(sub('13.4  Xcode can\'t see my iPhone'))
    s.append(bullets([
        'Unlock the phone and keep it unlocked; check the cable is properly in.',
        'Tap <b>Trust</b> if the phone asks (again — iOS updates re-ask).',
        'Check <b>Developer Mode</b> is On (section 8.1) — iOS updates sometimes switch it off.',
        'Still nothing → unplug, replug, wait 30 seconds.',
    ]))
    s.append(sub('13.5  The app icon suddenly does nothing'))
    s.append(para('The 7-day signature expired — completely normal. Section 9 (or 10.4 if you\'re on '
                  'AltStore). Your data is safe.'))
    s.append(sub('13.6  "Untrusted Developer" when opening the app'))
    s.append(para('Phone → Settings → General → VPN &amp; Device Management → your Apple ID → Trust.'))
    s.append(sub('13.7  AI says a key is missing'))
    s.append(para('Section 11 — add your free Gemini key in Profile.'))
    s.append(sub('13.8  AltStore won\'t install gymbro, or "maximum app limit reached"'))
    s.append(bullets([
        'A free Apple ID can only keep <b>3 apps</b> signed at once per device — remove another '
        'sideloaded app in AltStore\'s My Apps tab, or use a different Apple ID.',
        'Make sure <b>AltServer</b> is actually running on the computer and both devices are on the '
        'same Wi-Fi network — AltStore can\'t sign anything without it.',
        'Re-do the Trust step: Settings → General → VPN &amp; Device Management → your Apple ID → Trust.',
    ]))

    # ── 14 (was 13) ──
    s.append(heading('14. Where to get help'))
    s.append(bullets([
        f'Open an issue at <b>{REPO}/issues</b> — describe what you clicked and copy the exact error text.',
        'Google AI Studio (free Gemini keys) — aistudio.google.com',
        'AltStore setup problems — faq.altstore.io',
        'Developers who want to modify the app: it\'s a standard Expo / React Native project — '
        f'see the README at {REPO}.',
    ]))
    s.append(Spacer(1, 10))
    s.append(Paragraph('<i>This PDF is generated from scripts/make_setup_pdf.py — edit that file and '
                       're-run it to update the guide.</i>',
                       ParagraphStyle('end', parent=body, textColor=GRAY, fontSize=9.5)))

    doc.build(s)
    print('Wrote SETUP.pdf')


if __name__ == '__main__':
    build()
