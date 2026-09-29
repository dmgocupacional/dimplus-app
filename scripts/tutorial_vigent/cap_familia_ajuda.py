import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from robo import Robo
async def familia():
    async with Robo('familia') as r:
        await r.login(); await r.espera(800)
        await r.toca('Família', exato=True, espera=3500); await r.foto('familia')
        await r.rola(350, vezes=2, pausa=1200); await r.foto('incluir')
async def ajuda():
    async with Robo('ajuda') as r:
        await r.login(); await r.espera(800)
        await r.rola(300, vezes=2, pausa=700)
        await r.toca('Ajuda', exato=True, espera=3500); await r.foto('ajuda')
        print('AJUDA:', (await r.texto())[-700:].replace('\n',' | '))
        await r.rola(350, vezes=2, pausa=1100); await r.foto('ajuda-mais')
async def clube():
    async with Robo('clube') as r:
        await r.login(); await r.espera(800)
        await r.rola(250, vezes=1, pausa=600)
        await r.toca('Clube de descontos', exato=True, espera=9000); await r.foto('clube')
        print('CLUBE url', r.pg.url, '|', (await r.texto())[-400:].replace('\n',' | '))
        await r.rola(400, vezes=2, pausa=1500); await r.foto('clube-mais')
asyncio.run({'familia': familia, 'ajuda': ajuda, 'clube': clube}[sys.argv[1]]())
