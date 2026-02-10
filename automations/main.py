import datetime
import random
from PIL import Image, ImageDraw, ImageFont

def gerar_imagem():
    # 1. Configurações de Data
    hoje = datetime.datetime.now().strftime("%d/%m/%Y")
    
    # 2. Abrir o fundo fixo (deve estar na mesma pasta)
    try:
        img = Image.open("fundo.jpg").convert("RGB")
    except:
        # Cria um fundo verde caso o ficheiro não exista para teste
        img = Image.new('RGB', (1080, 1080), color = (0, 102, 51))
    
    draw = ImageDraw.Draw(img)
    
    # 3. Textos
    texto_topo = f"🍀 Tendencia {hoje} 🍀"
    texto_sub = "Lotofácil 👇"
    
    # Dicas Aleatórias (Podes trocar por uma lógica de análise real)
    dicas_pool = [
        "Equilibre: 7 Pares e 8 Ímpares",
        "Repita 9 dezenas do anterior",
        "Foque nas bordas do volante",
        "Números quentes: 01, 10, 14, 25",
        "Evite sequências maiores que 4"
    ]
    dica_do_dia = random.choice(dicas_pool)
    sugestao_numeros = ", ".join(map(str, sorted(random.sample(range(1, 26), 15))))

    # 4. Escrever na Imagem
    # Nota: No GitHub Actions, usa o caminho padrão para fontes ou suba uma .ttf
    try:
        font_titulo = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
        font_corpo = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
    except:
        font_titulo = ImageFont.load_default()
        font_corpo = ImageFont.load_default()

    # Desenhar (Ajusta as coordenadas x, y conforme o teu fundo)
    draw.text((540, 200), texto_topo, fill="white", font=font_titulo, anchor="ms")
    draw.text((540, 300), texto_sub, fill="yellow", font=font_titulo, anchor="ms")
    
    draw.text((540, 600), f"DICA: {dica_do_dia}", fill="white", font=font_corpo, anchor="ms")
    draw.text((540, 750), "SUGESTÃO:", fill="white", font=font_corpo, anchor="ms")
    draw.text((540, 820), sugestao_numeros, fill="#00FF00", font=font_corpo, anchor="ms")

    # 5. Guardar o resultado final
    img.save("lotofacil.jpg", "JPEG", quality=95)

if __name__ == "__main__":
    gerar_imagem()
