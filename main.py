import datetime
import random
from PIL import Image, ImageDraw, ImageFont

def gerar_imagem():
    hoje = datetime.datetime.now().strftime("%d/%m/%Y")
    
    # 1. Tentar abrir o arquivo exato que está no seu GitHub
    # Se o seu arquivo for .png, mude aqui para "fundo.png"
    try:
        img = Image.open("fundo.png").convert("RGB")
    except:
        # Se falhar, tenta .jpg antes de desistir
        try:
            img = Image.open("fundo.jpg").convert("RGB")
        except:
            print("Erro crítico: Nenhum arquivo de fundo encontrado!")
            return
    
    draw = ImageDraw.Draw(img)
    
    # 2. Gerar sugestão de 15 números
    numeros = sorted(random.sample(range(1, 26), 15))
    sugestao = " - ".join(map(lambda x: f"{x:02d}", numeros))

    # 3. Configurar Fontes
    try:
        font_data = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
        font_titulo = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
        font_numeros = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 45)
    except:
        font_data = font_titulo = font_numeros = ImageFont.load_default()

    # 4. Escrever na imagem (Coordenadas ajustadas para o centro inferior)
    # Ajuste o número 700 e 850 para subir ou descer o texto na sua imagem
    draw.text((540, 700), f"Dicas do dia {hoje}", fill="white", font=font_data, anchor="ms")
    draw.text((540, 780), "SUGESTÃO DA SORTE:", fill="#FFD700", font=font_titulo, anchor="ms")
    draw.text((540, 880), sugestao, fill="white", font=font_numeros, anchor="ms")

    # 5. Salvar o resultado final
    img.save("lotofacil.jpg", "JPEG", quality=95)

if __name__ == "__main__":
    gerar_imagem()
