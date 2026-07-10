#!/usr/bin/env python3
"""Generate SETUP-ANDROID.pdf — the gymbro install guide for Android.

Two audiences: Part 1 is for the person who just wants the app (they only
need the .apk file and their phone — no computer). Part 2 is for whoever
builds that .apk once. Edit here and re-run
`python3 scripts/make_android_pdf.py` to regenerate.
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

GREEN = HexColor('#16A34A')
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
                       fontSize=52, leading=58, textColor=GREEN, alignment=TA_CENTER)
t_sub = ParagraphStyle('t_sub', parent=styles['Title'], fontName='Helvetica-Bold',
                       fontSize=24, leading=28, textColor=INK, alignment=TA_CENTER)
t_desc = ParagraphStyle('t_desc', parent=body, fontSize=12, leading=18,
                        textColor=GRAY, alignment=TA_CENTER)
t_repo = ParagraphStyle('t_repo', parent=body, fontSize=11, textColor=GRAY, alignment=TA_CENTER)
t_link = ParagraphStyle('t_link', parent=body, fontName='Helvetica-Bold',
                        fontSize=11, textColor=GREEN, alignment=TA_CENTER)


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
    canvas.drawString(20 * mm, h - 14 * mm, 'gymbro — Android Install Guide')
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
        'SETUP-ANDROID.pdf', pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=22 * mm, bottomMargin=20 * mm,
        title='gymbro — Android Install Guide', author='gymbro',
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
    s.append(Paragraph('Android Install Guide', t_sub))
    s.append(Spacer(1, 18))
    s.append(Paragraph('For app users: all you need is the .apk file and your phone.', t_desc))
    s.append(Paragraph('No computer, no expiry, installed in two minutes.', t_desc))
    s.append(Spacer(1, 230))
    s.append(Paragraph('Repository:', t_repo))
    s.append(Paragraph(REPO_URL, t_link))
    s.append(Spacer(1, 8))
    s.append(Paragraph('Part 1 — install the app · Part 2 — build the .apk file (one person, once)', t_repo))
    s.append(NextPageTemplate('later'))
    s.append(PageBreak())

    # ── 1 ──
    s.append(heading('1. How Android installs work (30 seconds)'))
    s.append(para('gymbro is not on the Play Store. On Android that\'s no problem: the app can be '
                  'shared as a single file — <font face="Courier">gymbro.apk</font> — and installed by '
                  'simply opening that file on the phone. Unlike iPhone, there is <b>no 7-day expiry</b> '
                  'and <b>no computer needed</b> to install: once someone has built the .apk (Part 2, '
                  'one person does this once), everyone else just needs the file.'))
    s.append(callout('Honesty note: gymbro is developed and tested primarily on iPhone. The Android '
                     'version is fully functional but has had less real-world testing — if something '
                     f'looks off, report it at {REPO}/issues.'))

    # ── 2 ──
    s.append(heading('2. Part 1 — Install gymbro on your Android phone'))
    s.append(para('You need: the <font face="Courier">gymbro.apk</font> file (from a friend via '
                  'WhatsApp/Drive/email, or from the project\'s Releases page on GitHub) and two minutes.'))
    s.append(steps([
        'On the phone, <b>download / open the .apk file</b>. From WhatsApp or a browser: tap the '
        'file, then tap <b>Install</b> if offered. If nothing happens, open the <b>Files</b> app → '
        '<b>Downloads</b> → tap <font face="Courier">gymbro.apk</font>.',
        'The first time, Android will likely say <b>"For your security, your phone is not allowed '
        'to install unknown apps from this source"</b>. Tap <b>Settings</b> on that popup, switch on '
        '<b>Allow from this source</b>, and go back — the install screen reappears.',
        'Tap <b>Install</b> and wait a few seconds.',
        'If <b>Google Play Protect</b> shows a warning ("app from unknown developer"), tap '
        '<b>More details → Install anyway</b>. This appears for ANY app outside the Play Store — '
        'it does not mean something is wrong.',
        'Tap <b>Open</b>. gymbro greets you with a short welcome tour, and small green cards explain '
        'each feature the first time you reach it. Done — the app is yours permanently.',
    ]))
    s.append(sub('2.1  Turn on the AI features (optional, free)'))
    s.append(steps([
        'Go to <b>aistudio.google.com/apikey</b> in a browser, sign in with a Google account, tap '
        '<b>Create API key</b>, copy it.',
        'In gymbro: <b>Home tab → Profile → AI features · Gemini key</b> → paste → <b>Save profile</b>.',
    ]))
    s.append(sub('2.2  Updating the app later'))
    s.append(para('Get the newer .apk file and open it — it installs over the old version and '
                  '<b>keeps all your workouts and meals</b>. Never "uninstall first"; that would '
                  'erase your data.'))

    # ── 3 ──
    s.append(heading('3. Part 2 — Build the .apk (one person does this once)'))
    s.append(para('Someone has to produce the .apk file that everyone else installs. There are two '
                  'ways — the cloud way is far easier and works from any computer (Windows, Mac, or '
                  'Linux), because Expo\'s servers do the heavy lifting.'))

    s.append(sub('3.1  The easy way — cloud build with EAS (≈20 min, no Android tools needed)'))
    s.append(steps([
        'Install <b>Node.js</b> (nodejs.org → the green LTS button → run the installer).',
        f'Get the code: {REPO_URL} → green <b>&lt;&gt; Code</b> button → <b>Download ZIP</b> → unzip → '
        'put the <b>gymbro-main</b> folder on your Desktop.',
        'Create a free account at <b>expo.dev</b> (Sign Up — free tier is plenty).',
        'Open Terminal (Mac: ⌘+Space → "terminal"; Windows: Start → "PowerShell") and run, one line '
        'at a time:',
    ]))
    s.append(code('cd ~/Desktop/gymbro-main\nnpm install\nnpx eas-cli build -p android --profile preview'))
    s.append(para('The last command asks you to log in (use the expo.dev account), then uploads the '
                  'project and builds it on Expo\'s servers — you can watch the progress link it '
                  'prints. After ~15 minutes it prints a <b>download link to the finished .apk</b>. '
                  'Download it, send the file to your friends, and point them at Part 1.'))
    s.append(callout('The free EAS tier includes a limited number of builds per month and the build '
                     'may sit in a queue — fine for sharing with friends, not for daily rebuilds.'))

    s.append(sub('3.2  The offline way — local build (for developers)'))
    s.append(para('Requires Android Studio (for the Android SDK) and Java 17. Then:'))
    s.append(code('npm install\nnpx expo prebuild -p android\ncd android && ./gradlew assembleRelease'))
    s.append(para('The finished file appears at '
                  '<font face="Courier">android/app/build/outputs/apk/release/app-release.apk</font>. '
                  'Rename it to gymbro.apk and share.'))

    s.append(sub('3.3  Sharing tip — GitHub Releases'))
    s.append(para(f'Instead of re-sending files, upload the .apk once to a <b>Release</b> on '
                  f'{REPO} (Releases → Draft a new release → attach the .apk). Then anyone can '
                  'download it straight to their phone from the Releases page, and Part 1 is the '
                  'only guide they ever need.'))

    # ── 4 ──
    s.append(heading('4. When something goes wrong'))
    s.append(sub('4.1  "App not installed" error'))
    s.append(bullets([
        'Free up storage space and try again.',
        'If an older gymbro with a different signature exists, Android refuses to install over it — '
        'only then: back up via Profile → Migrate Data → Export, uninstall, install fresh, Import.',
    ]))
    s.append(sub('4.2  Can\'t find the downloaded .apk'))
    s.append(para('Files app → Downloads. Or pull down the notification shade — the download '
                  'notification opens it.'))
    s.append(sub('4.3  Play Protect keeps blocking'))
    s.append(para('Tap <b>More details</b> on the warning, then <b>Install anyway</b>. If there is no '
                  'such option: Play Store → profile picture → Play Protect → ⚙ → temporarily switch '
                  'off "Scan apps", install, switch it back on.'))
    s.append(sub('4.4  Voice logging asks for permissions'))
    s.append(para('Allow <b>Microphone</b> when prompted (and Camera for food photos). '
                  'Missed it? Settings → Apps → gymbro → Permissions.'))
    s.append(sub('4.5  AI says a key is missing'))
    s.append(para('Section 2.1 — add your free Gemini key in Profile.'))

    # ── 5 ──
    s.append(heading('5. Where to get help'))
    s.append(bullets([
        f'Open an issue at <b>{REPO}/issues</b> — say what you tapped and copy the exact error.',
        'iPhone user? Read <b>SETUP.pdf</b> instead — the iPhone process is different.',
    ]))
    s.append(Spacer(1, 10))
    s.append(Paragraph('<i>This PDF is generated from scripts/make_android_pdf.py — edit that file '
                       'and re-run it to update the guide.</i>',
                       ParagraphStyle('end', parent=body, textColor=GRAY, fontSize=9.5)))

    doc.build(s)
    print('Wrote SETUP-ANDROID.pdf')


if __name__ == '__main__':
    build()
