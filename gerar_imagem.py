# imagem mensal
import datetime
import shutil
from PIL import Image, ImageDraw, ImageFont

CAMPANHAS = {
    1:  "fundos/janeiro_branco.png",        # Janeiro Branco
    2:  "fundos/fevereiro_roxo.png",        # (ex.: Lúpus/Alzheimer etc. se você usar)
    3:  "fundos/marco_azul_marinho.png",    # (ex. campanha de combate ao câncer de intestino)
    4:  "fundos/abril_verde.png",           # (ex. conscientização sobre segurança e saúde no trabalho)
    5:  "fundos/maio_amarelo.png",          # (ex. segurança no trânsito)
    6:  "fundos/junho_vermelho.png",        # (ex. doar sangue)
    7:  "fundos/julho_amarelo.png",         # (ex. hepatites virais)
    8:  "fundos/agosto_dourado.png",        # (ex. amamentação)
    9:  "fundos/setembro_amarelo.png",      # Setembro Amarelo
    10: "fundos/outubro_rosa.png",          # Outubro Rosa
    11: "fundos/novembro_azul.png",         # Novembro Azul
    12: "fundos/dezembro_vermelho.png",     # Dezembro Vermelho
}

def atualizar_fundo():
    mes = datetime.datetime.now().month
    origem = CAMPANHAS.get(mes, "fundos/padrao.png")
    shutil.copyfile(origem, "fundo.png")

def gerar_imagem():
    atualizar_fundo()

    hoje = datetime.datetime.now().strftime("%d/%m/%Y")

    img = Image.open("fundo.png").convert("RGB")
    draw = ImageDraw.Draw(img)

    font = ImageFont.truetype(
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 65
    )

    draw.text(
        (540, 700),
        f"Tendência {hoje}",
        fill="white",
        font=font,
        anchor="ms",
    )

    img.save("lotofacil.jpg", "JPEG", quality=95)

if __name__ == "__main__":
    gerar_imagem()
