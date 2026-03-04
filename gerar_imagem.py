# gerar_imagem.py

from datetime import datetime
from zoneinfo import ZoneInfo
import shutil
import os
from PIL import Image, ImageDraw, ImageFont, ImageOps

# ==========================
# CONFIGURAÇÃO
# ==========================

LARGURA = 1080
ALTURA = 1350  # padrão Instagram 4:5

CAMPANHAS = {
    1:  "fundos/janeiro_branco.png",
    2:  "fundos/fevereiro_roxo.png",
    3:  "fundos/marco_azul_marinho.png",
    4:  "fundos/abril_verde.png",
    5:  "fundos/maio_amarelo.png",
    6:  "fundos/junho_vermelho.png",
    7:  "fundos/julho_amarelo.png",
    8:  "fundos/agosto_dourado.png",
    9:  "fundos/setembro_amarelo.png",
    10: "fundos/outubro_rosa.png",
    11: "fundos/novembro_azul.png",
    12: "fundos/dezembro_vermelho.png",
}

# ==========================
# FUNÇÃO TROCA FUNDO
# ==========================

def atualizar_fundo():
    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    mes = agora.month

    print(f"[DEBUG] Mês detectado (Brasil): {mes}")

    origem = CAMPANHAS.get(mes, "fundos/padrao.png")

    if not os.path.exists(origem):
        raise FileNotFoundError(f"Fundo não encontrado: {origem}")

    shutil.copyfile(origem, "fundo.png")
    print(f"[DEBUG] Fundo atualizado para: {origem}")

# ==========================
# FUNÇÃO GERA IMAGEM
# ==========================

def gerar_imagem():
    atualizar_fundo()

    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    hoje = agora.strftime("%d/%m/%Y")

    img = Image.open("fundo.png").convert("RGB")

    # 🔥 força proporção Instagram
    img = ImageOps.fit(img, (LARGURA, ALTURA), Image.LANCZOS)

    draw = ImageDraw.Draw(img)

    font = ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        70
    )

    draw.text(
        (LARGURA / 2, ALTURA * 0.60),
        f"Tendência {hoje}",
        fill="white",
        font=font,
        anchor="ms",
    )

    img.save(
        "lotofacil.jpg",
        "JPEG",
        quality=85,
        optimize=True
    )

    print("[DEBUG] Imagem gerada 1080x1350 padrão Instagram")

# ==========================

if __name__ == "__main__":
    gerar_imagem()
