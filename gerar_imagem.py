// imagem mensal
import datetime
import shutil
from PIL import Image, ImageDraw, ImageFont

CAMPANHAS = {
    1:  "fundos/janeiro_branco.png",
    9:  "fundos/setembro_amarelo.png",
    10: "fundos/outubro_rosa.png",
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

    draw.text((540, 700), f"Dicas do dia {hoje}",
              fill="black", font=font, anchor="ms")

    img.save("lotofacil.jpg", "JPEG", quality=95)

if __name__ == "__main__":
    gerar_imagem()
