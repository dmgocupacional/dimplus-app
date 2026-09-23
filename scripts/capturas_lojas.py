"""Gera as capturas de tela das lojas a partir do app REAL (versão web), logado na conta demo.

A Apple e o Google exigem imagens do app de verdade — nada montado. Este script abre o
preview web do app, entra com a conta de demonstração e fotografa cada tela no tamanho que
cada loja pede, gravando direto nas pastas que o fastlane lê.

Credenciais vêm do ambiente (DEMO_CPF, DEMO_SENHA): nunca no repositório.

Limites conhecidos (23/09/2026):
- SOS fica de fora: no navegador não há GPS e a tela mostraria "atualize o aplicativo".
- No web a sessão vive só na memória: recarregar desloga. Por isso a navegação volta pelo
  histórico (go_back), nunca com page.goto.
- Google Play recusa proporção acima de 2:1, então o Android tem tamanho próprio (1080x1920).
"""
import asyncio
import os
import shutil
from pathlib import Path

from playwright.async_api import async_playwright

URL = os.environ.get("APP_WEB_URL", "https://dimplus-web.vercel.app")
CPF = os.environ["DEMO_CPF"]
SENHA = os.environ["DEMO_SENHA"]
RAIZ = Path(__file__).resolve().parent.parent / "fastlane"

# (nome da tela, texto do atalho na home — None = a própria home)
TELAS = [
    ("01-inicio", None),
    ("02-clube", "Clube de descontos"),
    ("03-agendar", "Agendar"),
    ("04-financeiro", "Financeiro"),
]

# destino, largura, altura e escala: o produto dá o tamanho exato de cada loja
APARELHOS = [
    (RAIZ / "screenshots" / "pt-BR", "iphone69", 440, 956, 3),   # 1320x2868 — iPhone 6,9"
    (RAIZ / "screenshots" / "pt-BR", "ipad13", 1032, 1376, 2),    # 2064x2752 — iPad 13"
    (RAIZ / "metadata" / "android" / "pt-BR" / "images" / "phoneScreenshots", "android", 360, 640, 3),  # 1080x1920
]


async def fotografar(p, destino: Path, prefixo: str, w: int, h: int, escala: int) -> int:
    b = await p.chromium.launch()
    pg = await b.new_page(viewport={"width": w, "height": h}, device_scale_factor=escala)
    await pg.goto(URL, wait_until="networkidle", timeout=90000)
    await pg.wait_for_timeout(2500)
    campos = await pg.query_selector_all("input")
    await campos[0].fill(CPF)
    await campos[1].fill(SENHA)
    await pg.get_by_role("button", name="Entrar").click()
    await pg.wait_for_timeout(9000)
    if "/login" in pg.url:
        raise RuntimeError("login da conta demo falhou — conferir DEMO_CPF/DEMO_SENHA")

    feitas = 0
    for nome, atalho in TELAS:
        if atalho:
            await pg.get_by_text(atalho, exact=True).first.click()
            await pg.wait_for_timeout(5000)
        await pg.screenshot(path=str(destino / f"{prefixo}-{nome}.png"))
        feitas += 1
        if atalho:
            await pg.go_back()
            await pg.wait_for_timeout(3500)
    await b.close()
    return feitas


async def main() -> None:
    # Limpa só as capturas geradas por este script, para não empilhar versões antigas.
    for destino, prefixo, *_ in APARELHOS:
        destino.mkdir(parents=True, exist_ok=True)
        for f in destino.glob(f"{prefixo}-*.png"):
            f.unlink()
    async with async_playwright() as p:
        for destino, prefixo, w, h, escala in APARELHOS:
            n = await fotografar(p, destino, prefixo, w, h, escala)
            print(f"{prefixo}: {n} capturas em {destino}")


if __name__ == "__main__":
    asyncio.run(main())
