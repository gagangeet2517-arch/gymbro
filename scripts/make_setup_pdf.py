#!/usr/bin/env python3
"""Generate SETUP.pdf — the gymbro install guide for users.

This guide is written for people who want to USE the app on their own
iPhone (install it, live with the 7-day free-signing cycle, reinstall),
not for developers. Edit the content here and re-run
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


# ── Page furniture (header rule + footer URL + page number) ─────────────────────
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
    s.append(Paragraph('Get the workout tracker onto your own iPhone', t_desc))
    s.append(Paragraph('and keep it running — no App Store needed.', t_desc))
    s.append(Spacer(1, 230))
    s.append(Paragraph('Repository:', t_repo))
    s.append(Paragraph(REPO_URL, t_link))
    s.append(Spacer(1, 8))
    s.append(Paragraph('Free to install with any Apple ID · your data stays on your phone', t_repo))
    s.append(NextPageTemplate('later'))
    s.append(PageBreak())

    # ── 1. What is gymbro? ──
    s.append(heading('1. What is gymbro?'))
    s.append(para('gymbro is a personal workout and nutrition tracker. You log workouts from '
                  'ready-made templates, snap photos of meals to count calories with AI, and watch '
                  'your strength and bodyweight trends on charts. Everything is stored on your phone — '
                  'no account, no sign-up, no cloud.'))
    s.append(para('Because gymbro is not on the App Store, you install it yourself from a Mac using a '
                  'free Apple ID. The install lasts <b>7 days</b>, then the app stops opening until you '
                  're-run one command to refresh it (your data is never lost). This guide covers the '
                  'one-time setup, the install, and the weekly refresh.'))

    # ── 2. What you need ──
    s.append(heading('2. What you need'))
    s.append(bullets([
        '<b>A Mac</b> — any Apple-silicon or recent Intel Mac.',
        '<b>Xcode</b> — free, from the Mac App Store (large download, ~1 hour first time).',
        '<b>Node.js</b> — free, from nodejs.org (choose the LTS installer).',
        '<b>Your iPhone + a USB cable</b>.',
        '<b>An Apple ID</b> — the free one you already have is enough. No paid developer account.',
        'About <b>30–40 minutes</b> for the one-time setup. After that, reinstalls take ~3 minutes.',
    ]))

    # ── 3. One-time: get the app onto your Mac ──
    s.append(heading('3. One-time setup — get the code onto your Mac'))
    s.append(steps([
        'Install <b>Xcode</b> from the Mac App Store, open it once, and accept the licence.',
        'Install <b>Node.js</b> (LTS) from nodejs.org.',
        'Open the <b>Terminal</b> app (press ⌘-Space, type "Terminal", press Enter).',
        'Copy-paste these three lines one at a time, pressing Enter after each:',
    ]))
    s.append(code('git clone https://github.com/gagangeet2517-arch/gymbro.git\n'
                  'cd gymbro\n'
                  'npm install'))
    s.append(callout('Type or paste each line exactly. The most common beginner mistake is running a '
                     'folder path on its own (for example dragging the folder into Terminal and pressing '
                     'Enter) — that gives <font face="Courier">permission denied</font>. Always start '
                     'with <font face="Courier">cd</font> followed by a space to move into a folder.'))

    # ── 4. One-time: signing ──
    s.append(heading('4. One-time setup — connect your Apple ID and iPhone'))
    s.append(para('Apple requires every app on a real iPhone to be "signed". You do this once in Xcode:'))
    s.append(steps([
        'In Terminal, run <font face="Courier">open ios/gymbro.xcworkspace</font> — Xcode opens the project.',
        'Xcode menu → <b>Settings → Accounts</b> → "+" → sign in with your Apple ID.',
        'Click the blue <b>gymbro</b> icon in the left sidebar, open the '
        '<b>Signing &amp; Capabilities</b> tab, tick <b>Automatically manage signing</b>, and pick '
        'your name under <b>Team</b>.',
        'Plug in your iPhone with the cable, unlock it, and tap <b>Trust</b> when the phone asks.',
        'On the iPhone, turn on <b>Settings → Privacy &amp; Security → Developer Mode</b> '
        '(the phone restarts once).',
    ]))
    s.append(para('Then find your phone\'s device id — run this in Terminal:'))
    s.append(code('xcrun devicectl list devices'))
    s.append(para('Copy the long <b>Identifier</b> shown for your phone. Open the file '
                  '<font face="Courier">package.json</font> in the gymbro folder (double-click opens '
                  'TextEdit), find the <font face="Courier">deploy:iphone</font> line, and replace the '
                  'device id (the long code after <font face="Courier">id=</font>, it appears twice) with '
                  'yours. Replace the <font face="Courier">DEVELOPMENT_TEAM</font> value with your own '
                  'team id — Xcode shows it under Signing &amp; Capabilities after you pick your team.'))

    # ── 5. Install ──
    s.append(heading('5. Install the app on your iPhone'))
    s.append(para('Phone plugged in and unlocked? This is the whole thing:'))
    s.append(code('cd ~/Desktop/gymbro        # or wherever you cloned it\nnpm run deploy:iphone'))
    s.append(para('The first build takes several minutes. When it finishes you will see '
                  '<b>"App installed"</b> and gymbro appears on your home screen. Open it, swipe through '
                  'the welcome tour, and you are in.'))
    s.append(callout('First launch only: if the icon shows an "Untrusted Developer" message, go to '
                     'iPhone <b>Settings → General → VPN &amp; Device Management</b>, tap your Apple ID '
                     'and tap <b>Trust</b>. Then open the app again.'))

    # ── 6. The 7-day rule ──
    s.append(heading('6. The 7-day rule (important!)'))
    s.append(para('Apps signed with a free Apple ID stop launching after <b>7 days</b>. This is an Apple '
                  'restriction, not a bug. When gymbro suddenly refuses to open:'))
    s.append(steps([
        'Plug the iPhone into the Mac and unlock it.',
        'Open Terminal and run the same two lines as always:',
    ]))
    s.append(code('cd ~/Desktop/gymbro\nnpm run deploy:iphone'))
    s.append(para('That refreshes the app for another 7 days. <b>All your workouts, meals, and settings '
                  'survive every reinstall</b> — the data lives in the app\'s own storage on the phone '
                  'and reinstalling on top never wipes it.'))

    # ── 7. After an iPhone or Mac update ──
    s.append(heading('7. After an iPhone (or Mac) software update'))
    s.append(para('System updates can break the developer connection between phone and Mac. Symptoms: '
                  'the app stops opening early, or the install command fails saying the device is '
                  '<b>unavailable</b>. Fix, in order:'))
    s.append(steps([
        'Plug the phone in with the cable and keep it <b>unlocked</b>.',
        'Tap <b>Trust</b> if the phone asks again after the update.',
        'Check <b>Settings → Privacy &amp; Security → Developer Mode</b> is still ON '
        '(updates sometimes switch it off; the phone reboots when you re-enable it).',
        'Run <font face="Courier">xcrun devicectl list devices</font> — your phone should say '
        '<b>available (paired)</b>. Then run the usual '
        '<font face="Courier">npm run deploy:iphone</font>.',
    ]))

    # ── 8. AI features ──
    s.append(heading('8. Turn on the AI features (optional, free)'))
    s.append(para('Photo food scanning, voice meal logging, and the nutrition coach use Google Gemini. '
                  'They need a free key — one minute to set up:'))
    s.append(steps([
        'On any device, go to <b>aistudio.google.com/apikey</b>, sign in with a Google account, and '
        'create an API key. Copy it.',
        'In gymbro: <b>Home tab → tap your Profile</b>.',
        'Scroll to <b>AI features · Gemini key</b>, paste the key, tap <b>Save profile</b>.',
        'The status line changes to <b>"Using your key"</b> — AI features are now on.',
    ]))
    s.append(callout('If photo scan or the coach say "Add your Google Gemini API key in Profile", this '
                     'step has not been done yet. The key is stored only on your phone.'))

    # ── 9. Using the app ──
    s.append(heading('9. Quick tour — getting the most out of gymbro'))
    s.append(bullets([
        '<b>Workouts tab</b> — start from a template (Push / Pull / Legs / Upper). gymbro pre-fills '
        'the weights and reps from your last session so you can focus on beating them. You can add or '
        'remove exercises mid-workout, and a warm-up / cool-down checklist is built in for every session.',
        '<b>Guided mode</b> — tap <b>Guide me</b> during a workout for a one-set-at-a-time view with a '
        'built-in rest timer between sets.',
        '<b>Voice logging</b> — tap the mic on any exercise (or in guided mode) and say your set, e.g. '
        '"sixty by eight" — it fills in the weight and reps for you. Runs on your phone\'s own speech '
        'engine, not the AI key, so it works offline and costs nothing.',
        '<b>Nutrition tab</b> — photograph your plate, speak your meal, or scan a barcode. Late-night '
        'meals (after midnight) ask whether they count toward yesterday or today.',
        '<b>Progress tab</b> — log bodyweight and body fat %; charts for strength, volume, and body '
        'trends fill in automatically. Finishing a workout shows calories burned.',
        '<b>Home tab → Profile</b> — set your <b>Training goal</b> (fat loss / lean bulk / maintenance / '
        'recomp: it tunes templates and nutrition targets), pick habit goals, and set <b>reminders</b>: '
        'a daily one and a long-term one with your own goal text (for example "Lose 5 kg by August 1st").',
    ]))
    s.append(callout('Reminders ask for notification permission the first time you enable one — tap '
                     'Allow. If reminders never appear, check iPhone Settings → gymbro → Notifications.'))
    s.append(callout('The app explains itself as you go: the first time you reach a feature like guided '
                     'mode, voice logging, or reminders, a small dismissible card appears describing what '
                     'it does. It only shows once per feature and disappears for good once you try it or '
                     'tap the ✕.'))

    # ── 10. Troubleshooting ──
    s.append(heading('10. Troubleshooting'))
    s.append(sub('10.1  Terminal says "permission denied"'))
    s.append(bullets([
        'You probably ran a folder path as a command (for example by dragging the folder into '
        'Terminal). Use <font face="Courier">cd&nbsp;</font> + the folder, then the npm command, as two '
        'separate lines.',
        'If it says "Operation not permitted" instead: System Settings → Privacy &amp; Security → '
        '<b>Files and Folders → Terminal</b> → allow <b>Desktop Folder</b>, then quit and reopen Terminal.',
    ]))
    s.append(sub('10.2  The app icon does nothing / app will not open'))
    s.append(para('The 7-day signature has expired. Reinstall (section 6). Your data is safe.'))
    s.append(sub('10.3  "Untrusted Developer" when opening the app'))
    s.append(para('iPhone Settings → General → VPN &amp; Device Management → tap your Apple ID → Trust.'))
    s.append(sub('10.4  Install fails / device "unavailable"'))
    s.append(para('The phone-to-Mac developer link dropped (common after updates). Follow section 7.'))
    s.append(sub('10.5  Build fails with a signing error'))
    s.append(para('Open <font face="Courier">ios/gymbro.xcworkspace</font> in Xcode and re-check '
                  'Signing &amp; Capabilities (section 4) — your free signing certificate may have '
                  'expired; picking the team again renews it.'))
    s.append(sub('10.6  AI features say a key is missing'))
    s.append(para('Add your free Gemini key in Profile (section 8).'))

    # ── 11. Help ──
    s.append(heading('11. Where to get help'))
    s.append(bullets([
        f'Open an issue at {REPO}/issues — describe what you tapped and what happened.',
        'Google AI Studio (free Gemini keys) — aistudio.google.com',
        'For developers who want to modify the app: the project is a standard Expo / React Native '
        f'codebase — see the README at {REPO}.',
    ]))
    s.append(Spacer(1, 10))
    s.append(Paragraph('<i>This PDF is generated from scripts/make_setup_pdf.py — edit that file and '
                       're-run it to update the guide.</i>',
                       ParagraphStyle('end', parent=body, textColor=GRAY, fontSize=9.5)))

    doc.build(s)
    print('Wrote SETUP.pdf')


if __name__ == '__main__':
    build()
