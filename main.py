from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Dict

from PIL import Image, ImageDraw, ImageFont, ImageOps

# ============================================================
# CONFIG
# ============================================================

# Padrão Instagram feed (4:5)
OUT_W = 1080
OUT_H = 1350

# Pasta de fundos por campanha do mês
FUNDOS_DIR = Path(__file__).resolve().parent / "fundos"

# Arquivo fallback
PADRAO = FUNDOS_DIR / "padrao.png"

# Mapeamento mês -> arquivo (nomes devem bater com a pasta fundos/)
CAMPANHAS: Dict[int, str] = {
    1: "janeiro_branco.png",
    2: "fevereiro_roxo.png",
    3: "marco_azul_marinho.png",
    4: "abril_verde.png",
    5: "maio_amarelo.png",
    6: "junho_vermelho.png",
    7: "julho_amarelo.png",
    8: "agosto_dourado.png",
    9: "setembro_amarelo.png",
    10: "outubro_rosa.png",
    11: "novembro_azul.png",
    12: "dezembro_vermelho.png",
}

# Fonte segura no runner Ubuntu (GitHub Actions)
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


# ============================================================
# FUNÇÕES
# ============================================================

def _resample_lanczos():
    """Compatível com Pillow antigo/novo."""
    try:
        # Pillow >= 10
        return Image.Resampling.LANCZOS
    except Exception:
        return Image.LANCZOS


def escolher_fundo(mes: int) -> Path:
    """
    Escolhe o fundo do mês. Se o arquivo esperado não existir,
    tenta encontrar automaticamente variações do mesmo nome (ex: dupla extensão).
    """
    nome = CAMPANHAS.get(mes, PADRAO.name)
    candidato = FUNDOS_DIR / nome

    if candidato.exists():
        return candidato

    # Correção comum: arquivo com dois pontos antes do .png (ex: marco_azul_marinho..png)
    if nome.endswith(".png"):
        candidato2 = FUNDOS_DIR / (nome.replace(".png", "..png"))
        if candidato2.exists():
            return candidato2

    # Último recurso: procurar por arquivo que comece com o nome-base
    base = Path(nome).stem  # sem extensão
    matches = sorted(FUNDOS_DIR.glob(f"{base}*.png"))
    if len(matches) == 1:
        return matches[0]

    # Fallback final
    if PADRAO.exists():
        return PADRAO

    raise FileNotFoundError(
        f"Fundo do mês não encontrado. Esperado: {candidato} | "
        f"Encontrados: {[p.name for p in matches]} | "
        f"Também não existe padrao.png em {FUNDOS_DIR}"
    )


def carregar_fonte(tamanho: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(FONT_PATH, tamanho)
    except Exception:
        return ImageFont.load_default()


def gerar_imagem():
    # Data no fuso do Brasil (para virar o mês corretamente)
    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    hoje_str = agora.strftime("%d/%m/%Y")
    mes = agora.month

    fundo = escolher_fundo(mes)

    # Debug útil no log do workflow
    print(f"[DEBUG] Data (America/Sao_Paulo): {agora.isoformat()}")
    print(f"[DEBUG] Mês detectado: {mes}")
    print(f"[DEBUG] Fundo selecionado: {fundo}")

    img = Image.open(fundo).convert("RGB")

    # Padroniza SEMPRE para 1080x1350 (4:5), independente do fundo original
    img = ImageOps.fit(img, (OUT_W, OUT_H), method=_resample_lanczos())

    draw = ImageDraw.Draw(img)

    texto_topo = f"Tendencia {hoje_str}"
    texto_sub = "Lotof@cil"

    font_titulo = carregar_fonte(80)

    # Centralização por âncora (ms = middle/center)
    draw.text((OUT_W / 2, OUT_H * 0.55), texto_topo, fill="white", font=font_titulo, anchor="ms")
    draw.text((OUT_W / 2, OUT_H * 0.65), texto_sub, fill="black", font=font_titulo, anchor="ms")

    out_path = Path(__file__).resolve().parent / "lotofacil.jpg"
    img.save(out_path, "JPEG", quality=90, optimize=True)

    print(f"[DEBUG] Imagem gerada: {out_path} ({OUT_W}x{OUT_H})")


if __name__ == "__main__":
    gerar_imagem()
