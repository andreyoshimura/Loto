from PIL import Image, ImageDraw, ImageFont
from datetime import datetime
from zoneinfo import ZoneInfo
import shutil
import pathlib

# ================================
# CONFIGURAÇÕES
# ================================

LARGURA = 1080
ALTURA = 1350

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
# FUNÇÃO: Atualiza fundo do mês
# ================================

def atualizar_fundo():
    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    mes = agora.month

    print(f"[DEBUG] Mês detectado (Brasil): {mes}")

    base_dir = pathlib.Path(__file__).parent.resolve()

    caminho_relativo = CAMPANHAS.get(mes, "fundos/padrao.png")
    origem = base_dir / caminho_relativo

    if not origem.exists():
        raise FileNotFoundError(f"Fundo não encontrado: {origem}")

    destino = base_dir / "fundo.png"

    shutil.copyfile(origem, destino)

    print(f"[DEBUG] Fundo atualizado para: {origem}")


# ================================
# FUNÇÃO: Gera imagem final
# ================================

def gerar_imagem():
    atualizar_fundo()

    base_dir = pathlib.Path(__file__).parent.resolve()
    fundo_path = base_dir / "fundo.png"

    fundo = Image.open(fundo_path).convert("RGB")

    # Padroniza tamanho Instagram 4:5
    fundo = fundo.resize((LARGURA, ALTURA))

    draw = ImageDraw.Draw(fundo)

    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))
    data_str = agora.strftime("%d/%m/%Y")

    texto = f"Tendência {data_str}"

    try:
        fonte = ImageFont.truetype("arial.ttf", 80)
    except:
        fonte = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), texto, font=fonte)
    largura_texto = bbox[2] - bbox[0]
    altura_texto = bbox[3] - bbox[1]

    x = (LARGURA - largura_texto) / 2
    y = ALTURA * 0.60

    draw.text((x, y), texto, font=fonte, fill="white")

    saida = base_dir / "lotofacil.jpg"
    fundo.save(saida, quality=95)

    print("[DEBUG] Imagem final gerada com sucesso")


# ================================
# EXECUÇÃO
# ================================

if __name__ == "__main__":
    gerar_imagem()
