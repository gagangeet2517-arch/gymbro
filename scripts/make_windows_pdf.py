#!/usr/bin/env python3
"""Generate SETUP-WINDOWS.pdf — installing gymbro with no Mac, via AltStore.

For anyone whose only computer is Windows (or who just doesn't want to
touch Xcode). Uses AltStore/AltServer to sideload a shared .ipa file and
keep it refreshed automatically — no Apple Developer Program needed.
Edit here and re-run `python3 scripts/make_windows_pdf.py` to regenerate.
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

PURPLE = HexColor('#7C3AED')
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
                       fontSize=52, leading=58, textColor=PURPLE, alignment=TA_CENTER)
t_sub = ParagraphStyle('t_sub', parent=styles['Title'], fontName='Helvetica-Bold',
                       fontSize=24, leading=28, textColor=INK, alignment=TA_CENTER)
t_desc = ParagraphStyle('t_desc', parent=body, fontSize=12, leading=18,
                        textColor=GRAY, alignment=TA_CENTER)
t_repo = ParagraphStyle('t_repo', parent=body, fontSize=11, textColor=GRAY, alignment=TA_CENTER)
t_link = ParagraphStyle('t_link', parent=body, fontName='Helvetica-Bold',
                        fontSize=11, textColor=PURPLE, alignment=TA_CENTER)


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
    canvas.drawString(20 * mm, h - 14 * mm, 'gymbro — No-Mac (AltStore) Install Guide')
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
        'SETUP-WINDOWS.pdf', pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=22 * mm, bottomMargin=20 * mm,
        title='gymbro — No-Mac Install Guide', author='gymbro',
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
    s.append(Paragraph('No-Mac Install Guide', t_sub))
    s.append(Spacer(1, 18))
    s.append(Paragraph('Get gymbro onto your iPhone using Windows (or any computer) —', t_desc))
    s.append(Paragraph('no Mac, no Xcode, no Apple Developer Program.', t_desc))
    s.append(Spacer(1, 230))
    s.append(Paragraph('Repository:', t_repo))
    s.append(Paragraph(REPO_URL, t_link))
    s.append(Spacer(1, 8))
    s.append(Paragraph('Works on Windows and Mac alike · uses the free tool AltStore', t_repo))
    s.append(NextPageTemplate('later'))
    s.append(PageBreak())

    # ── 1 ──
    s.append(heading('1. What is this, and what do you need?'))
    s.append(para('gymbro isn\'t on the App Store, so getting it onto an iPhone normally means '
                  'using a Mac with Xcode (see SETUP.pdf). If your only computer runs Windows, or '
                  'you just don\'t want to install Apple\'s developer tools, there\'s a free '
                  'alternative: <b>AltStore</b>. It installs a single shared app file (a '
                  '<font face="Courier">.ipa</font> — the iPhone equivalent of the Android '
                  '<font face="Courier">.apk</font>) onto your phone, signed with your own free '
                  'Apple ID, and can keep it refreshed automatically after that.'))
    s.append(bullets([
        '<b>A Windows or Mac computer</b> (any reasonably recent one — this does not need to be a '
        'powerful machine).',
        '<b>Your iPhone</b> and its <b>charging cable</b>, for the one-time setup only.',
        '<b>An Apple ID</b> — the normal, free one you already use for the App Store.',
        f'<b>The <font face="Courier">gymbro.ipa</font> file</b> — get it from {REPO}/releases, or '
        'from whoever shared gymbro with you.',
        'About <b>15 minutes</b> for the one-time setup.',
    ]))
    s.append(callout('You do NOT need: a Mac, Xcode, a paid Apple Developer account, or programming '
                     'knowledge. This guide assumes zero experience.'))

    # ── 2 ──
    s.append(heading('2. Part 1 — Set up AltStore (≈15 minutes, one time)'))
    s.append(steps([
        'On the computer, go to <b>altstore.io</b> and download <b>AltServer</b> for Windows or Mac.',
        'Mac: drag <font face="Courier">AltServer.app</font> into the <b>Applications</b> folder, '
        'then open it — a small icon appears in the menu bar at the top of the screen. '
        'Windows: unzip the download, run <b>Setup.exe</b>, then also install <b>iTunes and iCloud '
        'from Apple\'s own website</b> (not the Microsoft Store) if not already installed — '
        'AltServer needs them to talk to the iPhone.',
        'Plug the iPhone into the computer with a cable and <b>unlock it</b>. Tap <b>Trust</b> if asked.',
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

    # ── 3 ──
    s.append(heading('3. Part 2 — Install gymbro through AltStore'))
    s.append(steps([
        f'On the iPhone, get the <font face="Courier">gymbro.ipa</font> file onto it — open the '
        f'link to it (e.g. from {REPO}/releases) in Safari and tap Download, or AirDrop it from '
        'another Apple device.',
        'Open the <b>Files</b> app, find the downloaded .ipa, tap and hold it, and choose '
        '<b>Share → AltStore</b>. (If AltStore doesn\'t appear in the list, open AltStore first, go '
        'to the <b>My Apps</b> tab, tap <b>+</b> in the top-left, and browse to the file instead.)',
        'Wait for the install to finish — a progress ring shows on the AltStore icon.',
        'First open only: if the phone says <b>"Untrusted Developer"</b> → on the phone go to '
        '<b>Settings → General → VPN &amp; Device Management</b> → tap your Apple ID → <b>Trust</b>. '
        'Open gymbro again.',
    ]))
    s.append(para('That\'s it. The app greets you with a short welcome tour, and small green cards '
                  'explain each feature the first time you reach it.'))

    # ── 4 ──
    s.append(heading('4. Keeping it alive — no more re-downloading'))
    s.append(para('Apps installed this way stop opening after <b>7 days</b> — an Apple restriction '
                  'on free Apple IDs, not a bug, and identical to the Mac path. AltStore '
                  'automatically tries to refresh gymbro in the background whenever the phone is on '
                  'the <b>same Wi-Fi network</b> as the computer running AltServer — so leave '
                  'AltServer open (it can just sit in the menu bar / system tray) and it takes care '
                  'of itself. To refresh right away instead: open AltStore, go to <b>My Apps</b>, '
                  'and tap <b>Refresh All</b>.'))
    s.append(callout('AltServer genuinely needs to be running on that computer for a refresh to '
                     'work — the phone can\'t re-sign itself alone. If a week goes by with the '
                     'computer never turned on, gymbro will still expire; just open AltServer, get '
                     'on the same Wi-Fi as the phone, and refresh. <b>Your workouts, meals, and '
                     'settings are never lost</b> either way.'))

    # ── 5 ──
    s.append(heading('5. Part 3 — Exporting the .ipa (for whoever has a Mac + Xcode)'))
    s.append(para('This part is for the one person who has already followed SETUP.pdf and has '
                  'gymbro running from Xcode on their own Mac. Everyone else installing via AltStore '
                  'can skip straight to section 6.'))
    s.append(steps([
        'In Xcode (open via <font face="Courier">open ios/gymbro.xcworkspace</font> if it isn\'t '
        'already open), pick <b>Any iOS Device</b> from the device menu at the top — not a specific '
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
                     'AltStore resigns it fresh with each person\'s own Apple ID the moment they '
                     'install it, so the original export date doesn\'t matter to them.'))

    # ── 6 ──
    s.append(heading('6. When something goes wrong'))
    s.append(sub('6.1  AltStore won\'t install gymbro, or "maximum app limit reached"'))
    s.append(bullets([
        'A free Apple ID can only keep <b>3 apps</b> signed at once per device — remove another '
        'sideloaded app in AltStore\'s My Apps tab, or use a different Apple ID.',
        'Make sure <b>AltServer</b> is actually running on the computer and both devices are on the '
        'same Wi-Fi network — AltStore can\'t sign anything without it.',
        'Re-do the Trust step: Settings → General → VPN &amp; Device Management → your Apple ID → Trust.',
    ]))
    s.append(sub('6.2  Windows: AltServer can\'t find my iPhone'))
    s.append(bullets([
        'Confirm iTunes and iCloud are installed from Apple\'s website, not the Microsoft Store — '
        'the store versions don\'t include the drivers AltServer needs.',
        'Unlock the phone and keep it unlocked; check the cable is properly in.',
        'Open iTunes once and make sure it can see the phone before trying AltServer again.',
    ]))
    s.append(sub('6.3  The app icon suddenly does nothing'))
    s.append(para('The 7-day signature expired — completely normal. Section 4. Your data is safe.'))
    s.append(sub('6.4  "Untrusted Developer" when opening the app'))
    s.append(para('Phone → Settings → General → VPN &amp; Device Management → your Apple ID → Trust.'))
    s.append(sub('6.5  AI says a key is missing'))
    s.append(para('Photo food scanning and the nutrition coach need a free Google Gemini key: go to '
                  '<b>aistudio.google.com/apikey</b>, sign in, click <b>Create API key</b>, then in '
                  'gymbro go to <b>Home tab → Profile → AI features · Gemini key</b> → paste → '
                  '<b>Save profile</b>. The key never leaves your phone.'))

    # ── 7 ──
    s.append(heading('7. Where to get help'))
    s.append(bullets([
        f'Open an issue at <b>{REPO}/issues</b> — describe what you clicked and copy the exact error text.',
        'AltStore\'s own setup problems — faq.altstore.io',
        'Google AI Studio (free Gemini keys) — aistudio.google.com',
        'Mac users / whoever exports the .ipa — see SETUP.pdf for the full Xcode-based path.',
    ]))
    s.append(Spacer(1, 10))
    s.append(Paragraph('<i>This PDF is generated from scripts/make_windows_pdf.py — edit that file '
                       'and re-run it to update the guide.</i>',
                       ParagraphStyle('end', parent=body, textColor=GRAY, fontSize=9.5)))

    doc.build(s)
    print('Wrote SETUP-WINDOWS.pdf')


if __name__ == '__main__':
    build()
