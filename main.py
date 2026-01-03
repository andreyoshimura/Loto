"""
Script para gerar automaticamente uma imagem JPG a partir de um arquivo de fundo (PNG ou JPG),
inserindo textos centralizados com a data atual e um título fixo relacionado à Lotofácil.
O resultado final é salvo como 'lotofacil.jpg' para uso em publicações ou automações diárias.
Imagem de entrada : fundo.png
Imagem de saida : lotofacil.jpg
Local: Diretorio Raiz
"""

import datetime
from PIL import Image, ImageDraw, ImageFont

def gerar_imagem():
    # 1. Configurações de Data
    hoje = datetime.datetime.now().strftime("%d/%m/%Y")
    
    # 2. Abrir o fundo que está na raiz
    try:
        img = Image.open("fundo.png").convert("RGB")
    except:
        try:
            img = Image.open("fundo.jpg").convert("RGB")
        except:
            print("Erro: Arquivo de fundo não encontrado!")
            return
    
    draw = ImageDraw.Draw(img)
    
    # 3. Textos (Mantendo apenas o que você pediu)
    texto_topo = f" Dicas do dia {hoje} "
    texto_sub = " ⇩ Lotofácil ⇩ "
    
    # 4. Configurar Fontes
    try:
        font_titulo = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 65)
    except:
        font_titulo = ImageFont.load_default()

    # 5. Escrever na Imagem
    # Posicionado no centro do espaço verde
    draw.text((540, 700), texto_topo, fill="yellow", font=font_titulo, anchor="ms")
    draw.text((540, 820), texto_sub, fill="white", font=font_titulo, anchor="ms")

    # 6. Guardar o resultado final
    img.save("lotofacil.jpg", "JPEG", quality=95)
    print("Sucesso: lotofacil.jpg gerada apenas com data e título.")

if __name__ == "__main__":
    gerar_imagem()
