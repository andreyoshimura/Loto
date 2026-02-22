import datetime
from PIL import Image, ImageDraw, ImageFont

def gerar_imagem():
    hoje = datetime.datetime.now().strftime("%d/%m/%Y")

    # Abrir imagem de fundo
    try:
        img = Image.open("fundo.png").convert("RGB")
    except:
        try:
            img = Image.open("fundo.jpg").convert("RGB")
        except:
            print("Erro: Arquivo de fundo não encontrado!")
            return

    draw = ImageDraw.Draw(img)

    texto_topo = f"Tendencia {hoje}"
    texto_sub = "Lotof@cil"

    # Fonte (segura para Ubuntu runner)
    try:
        font_titulo = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            80
        )
    except:
        font_titulo = ImageFont.load_default()

    largura, altura = img.size
    print("Tamanho da imagem:", largura, "x", altura)

    # Centralização automática (não depende de tamanho fixo)
    draw.text(
        (largura / 2, altura * 0.55),
        texto_topo,
        fill="white",
        font=font_titulo,
        anchor="ms"
    )

    draw.text(
        (largura / 2, altura * 0.65),
        texto_sub,
        fill="black",
        font=font_titulo,
        anchor="ms"
    )

    img.save("lotofacil.jpg", "JPEG", quality=95)
    print("Sucesso: lotofacil.jpg gerada.")

if __name__ == "__main__":
    gerar_imagem()
