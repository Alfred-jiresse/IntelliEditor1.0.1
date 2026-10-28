#!/usr/bin/env python3
# Draws the black-and-white figures of the worked example (the norm recommends black and
# white "pour réduire le coût d'impression"). Reproducible: run `python3 make-figures.py`.
# Requires Pillow and the DejaVu fonts.

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
FONT = "/usr/share/fonts/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"
W, H = 1600, 900
LINE = 4


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def canvas(height=H):
    image = Image.new("RGB", (W, height), "white")
    return image, ImageDraw.Draw(image)


def box(d, x, y, w, h, label, size=30, bold=False, radius=0, dashed=False):
    if radius:
        d.rounded_rectangle((x, y, x + w, y + h), radius=radius, outline="black", width=LINE)
    else:
        d.rectangle((x, y, x + w, y + h), outline="black", width=LINE)
    lines = label.split("\n")
    f = font(size, bold)
    total = len(lines) * (size + 8)
    for i, line in enumerate(lines):
        tw = d.textlength(line, font=f)
        d.text((x + (w - tw) / 2, y + (h - total) / 2 + i * (size + 8)), line, fill="black", font=f)


def arrow(d, x1, y1, x2, y2, label=None):
    d.line((x1, y1, x2, y2), fill="black", width=LINE)
    import math

    a = math.atan2(y2 - y1, x2 - x1)
    s = 22
    d.polygon(
        [(x2, y2), (x2 - s * math.cos(a - 0.4), y2 - s * math.sin(a - 0.4)), (x2 - s * math.cos(a + 0.4), y2 - s * math.sin(a + 0.4))],
        fill="black",
    )
    if label:
        f = font(24)
        tw = d.textlength(label, font=f)
        d.text(((x1 + x2) / 2 - tw / 2, (y1 + y2) / 2 - 36), label, fill="black", font=f)


def actor(d, x, y, label):
    d.ellipse((x - 28, y, x + 28, y + 56), outline="black", width=LINE)
    d.line((x, y + 56, x, y + 150), fill="black", width=LINE)
    d.line((x - 55, y + 90, x + 55, y + 90), fill="black", width=LINE)
    d.line((x, y + 150, x - 45, y + 220), fill="black", width=LINE)
    d.line((x, y + 150, x + 45, y + 220), fill="black", width=LINE)
    f = font(28, True)
    tw = d.textlength(label, font=f)
    d.text((x - tw / 2, y + 232), label, fill="black", font=f)


def usecase(d, cx, cy, label, w=380, h=90):
    d.ellipse((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), outline="black", width=LINE)
    f = font(26)
    tw = d.textlength(label, font=f)
    d.text((cx - tw / 2, cy - 16), label, fill="black", font=f)


def existing_process():
    image, d = canvas(700)
    steps = ["Dépôt de la\ndemande (papier)", "Validation\npar le secrétariat", "Affectation\nd'un encadreur", "Suivi par\nmessages", "Évaluation\net archivage"]
    w, gap = 250, 62
    for i, label in enumerate(steps):
        x = 40 + i * (w + gap)
        box(d, x, 250, w, 180, label, size=27)
        if i < len(steps) - 1:
            arrow(d, x + w, 340, x + w + gap, 340)
    f = font(26)
    for i, note in enumerate(["délai : 3 à 5 jours", "risque de perte", "aucune trace", "relances manuelles", "dossiers dispersés"]):
        x = 40 + i * (w + gap)
        tw = d.textlength(note, font=f)
        d.text((x + (w - tw) / 2, 460), note, fill="black", font=f)
    image.save(OUT / "figure-processus.png")


def use_cases():
    image, d = canvas(1000)
    d.rectangle((420, 40, 1180, 960), outline="black", width=LINE)
    f = font(30, True)
    d.text((440, 55), "Système de gestion des stages", fill="black", font=f)
    actor(d, 190, 200, "Étudiant")
    actor(d, 190, 560, "Encadreur")
    actor(d, 1410, 380, "Secrétariat")
    cases = [(800, 180, "Déposer une demande"), (800, 320, "Consulter son dossier"), (800, 460, "Déposer un rapport"),
             (800, 600, "Évaluer un rapport"), (800, 740, "Valider une demande"), (800, 870, "Publier les statistiques")]
    for cx, cy, label in cases:
        usecase(d, cx, cy, label)
    for cy in (180, 320, 460):
        d.line((245, 300, 610, cy), fill="black", width=3)
    d.line((245, 660, 610, 600), fill="black", width=3)
    d.line((245, 660, 610, 320), fill="black", width=3)
    for cy in (740, 870, 320):
        d.line((1355, 480, 990, cy), fill="black", width=3)
    image.save(OUT / "figure-cas-utilisation.png")


def domain_model():
    image, d = canvas(820)

    def klass(x, y, name, attrs):
        w, head = 360, 60
        h = head + 24 + len(attrs) * 40
        d.rectangle((x, y, x + w, y + h), outline="black", width=LINE)
        d.line((x, y + head, x + w, y + head), fill="black", width=LINE)
        f = font(30, True)
        tw = d.textlength(name, font=f)
        d.text((x + (w - tw) / 2, y + 12), name, fill="black", font=f)
        for i, attr in enumerate(attrs):
            d.text((x + 18, y + head + 12 + i * 40), attr, fill="black", font=font(26))
        return (x, y, w, h)

    e = klass(60, 80, "Étudiant", ["matricule", "nom", "filière", "promotion"])
    s = klass(620, 80, "Stage", ["intitulé", "entreprise", "dateDébut", "dateFin", "état"])
    c = klass(1180, 80, "Encadreur", ["nom", "grade", "département"])
    r = klass(620, 500, "Rapport", ["version", "dateDépôt", "note"])
    f = font(26)
    d.line((420, 200, 620, 200), fill="black", width=LINE)
    d.text((430, 165), "1", fill="black", font=f); d.text((590, 165), "0..*", fill="black", font=f)
    d.line((980, 200, 1180, 200), fill="black", width=LINE)
    d.text((990, 165), "0..*", fill="black", font=f); d.text((1160, 165), "1", fill="black", font=f)
    d.line((800, 344, 800, 500), fill="black", width=LINE)
    d.text((815, 360), "1", fill="black", font=f); d.text((815, 460), "1..*", fill="black", font=f)
    image.save(OUT / "figure-modele-domaine.png")


def architecture():
    image, d = canvas(900)
    box(d, 80, 120, 360, 180, "Navigateur\n(étudiant, encadreur)", size=30)
    box(d, 80, 560, 360, 180, "Application mobile\n(notifications)", size=30)
    d.rectangle((560, 60, 1120, 840), outline="black", width=LINE)
    d.text((585, 75), "Serveur d'application", fill="black", font=font(30, True))
    box(d, 620, 160, 440, 140, "Contrôleurs (API REST)", size=30, radius=18)
    box(d, 620, 380, 440, 140, "Services métier", size=30, radius=18)
    box(d, 620, 600, 440, 140, "Accès aux données (ORM)", size=30, radius=18)
    box(d, 1240, 560, 300, 180, "Base de\ndonnées", size=32, bold=True)
    box(d, 1240, 140, 300, 180, "Serveur\nde courrier", size=30)
    arrow(d, 440, 210, 620, 230, "HTTPS")
    arrow(d, 440, 650, 620, 250)
    arrow(d, 840, 300, 840, 380)
    arrow(d, 840, 520, 840, 600)
    arrow(d, 1060, 670, 1240, 650, "SQL")
    arrow(d, 1060, 440, 1240, 260, "SMTP")
    image.save(OUT / "figure-architecture.png")


def interface():
    image, d = canvas(900)
    d.rectangle((40, 40, 1560, 860), outline="black", width=LINE)
    d.rectangle((40, 40, 1560, 130), outline="black", width=LINE)
    d.text((70, 68), "Gestion des stages — Tableau de bord", fill="black", font=font(34, True))
    d.rectangle((40, 130, 360, 860), outline="black", width=LINE)
    for i, item in enumerate(["Mes demandes", "Mon stage", "Rapports", "Messages", "Profil"]):
        d.text((75, 175 + i * 80), item, fill="black", font=font(30))
    for i, (title, value) in enumerate([("Demandes", "12"), ("En cours", "7"), ("Rapports", "5")]):
        x = 420 + i * 380
        d.rectangle((x, 180, x + 330, 340), outline="black", width=LINE)
        d.text((x + 25, 200), title, fill="black", font=font(28))
        d.text((x + 25, 250), value, fill="black", font=font(56, True))
    d.rectangle((420, 400, 1500, 800), outline="black", width=LINE)
    headers = ["Étudiant", "Entreprise", "État"]
    for j, h in enumerate(headers):
        d.text((450 + j * 360, 420), h, fill="black", font=font(28, True))
    d.line((420, 470, 1500, 470), fill="black", width=3)
    rows = [("Étudiant A", "Entreprise X", "Validé"), ("Étudiant B", "Entreprise Y", "En attente"), ("Étudiant C", "Entreprise Z", "Évalué")]
    for i, row in enumerate(rows):
        for j, cell in enumerate(row):
            d.text((450 + j * 360, 500 + i * 90), cell, fill="black", font=font(28))
        d.line((420, 570 + i * 90, 1500, 570 + i * 90), fill="black", width=1)
    image.save(OUT / "figure-interface.png")


if __name__ == "__main__":
    existing_process()
    use_cases()
    domain_model()
    architecture()
    interface()
    print("figures written to", OUT)
