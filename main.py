from datetime import datetime
from zoneinfo import ZoneInfo
from PIL import Image, ImageDraw, ImageFont, ImageOps
import shutil
import pathlib

# ================================
# CONFIGURAÇÕES
# ================================

LARGURA = 1080
ALTURA = 1350  # padrão Instagram 4:5

CAMPANHAS = {
    1: "fundos/janeiro_branco.png",
    2: "fundos/fevereiro_roxo.png",
    3: "fundos/marco_azul_marinho.png",
    4: "fundos/abril_verde.png",
    5: "fundos/maio_amarelo.png",
    6: "fundos/junho_vermelho.png",
    7: "fundos/julho_amarelo.png",
    8: "fundos/agosto_dourado.png",
    9: "fundos/setembro_amarelo.png",
    10: "fundos/outubro_rosa.png",
    11: "fundos/novembro_azul.png",
    12: "fundos/dezembro_vermelho.png",
}

# ================================
# FUNÇÃO TROCA FUNDO DO MÊS
# ================================

def atualizar_fundo():
    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    mes = agora.month

    base_dir = pathlib.Path(__file__).parent.resolve()
    origem = base_dir / CAMPANHAS.get(mes, "fundos/padrao.png")

    if not origem.exists():
        raise FileNotFoundError(f"Fundo não encontrado: {origem}")

    destino = base_dir / "fundo.png"
    shutil.copyfile(origem, destino)

    print(f"[DEBUG] Fundo atualizado para: {origem}")

# ================================
# FUNÇÃO GERA IMAGEM
# ================================

def gerar_imagem():
    atualizar_fundo()

    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    hoje = agora.strftime("%d/%m/%Y")

    base_dir = pathlib.Path(__file__).parent.resolve()
    fundo_path = base_dir / "fundo.png"

    img = Image.open(fundo_path).convert("RGB")

    # 🔥 força proporção Instagram
    img = ImageOps.fit(img, (LARGURA, ALTURA), Image.LANCZOS)

    draw = ImageDraw.Draw(img)

    texto_topo = f"Tendencia {hoje}"
    texto_sub = "Lotof@cil"

    try:
        font_titulo = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            80
        )
    except:
        font_titulo = ImageFont.load_default()

    draw.text(
        (LARGURA / 2, ALTURA * 0.55),
        texto_topo,
        fill="white",
        font=font_titulo,
        anchor="ms"
    )

    draw.text(
        (LARGURA / 2, ALTURA * 0.65),
        texto_sub,
        fill="black",
        font=font_titulo,
        anchor="ms"
    )

    img.save("lotofacil.jpg", "JPEG", quality=90, optimize=True)

    print("[DEBUG] Imagem 1080x1350 gerada com sucesso")

# ================================

if __name__ == "__main__":
    gerar_imagem()
