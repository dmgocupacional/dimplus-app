import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from robo import Robo
async def main():
    async with Robo('farmacia') as r:
        await r.login(); await r.espera(1200)
        await r.toca('Rede', exato=True, espera=2500); await r.foto('rede')
        await r.toca('Farmácias Vidalink', exato=True, espera=500)
        await r.aguarda('farmácias conveniadas', maximo=60000); await r.espera(1200); await r.foto('lista')
        await r.rola(350, vezes=3, pausa=700); await r.foto('lista-rolada')
        await r.rola(-1200, vezes=1, pausa=600)
        await r.toca('Mapa', exato=True, espera=6000); await r.foto('mapa')
        await r.rola(420, vezes=1, pausa=1800); await r.foto('mapa-inteiro')
        fr = r.pg.frame_locator('iframe[title="Mapa das farmácias conveniadas"]')
        pins = fr.locator('.pin'); n = await pins.count(); print('pins', n)
        alvo = None
        for k in range(n):
            b = await pins.nth(k).bounding_box()
            if b and 120 < b['y'] < 520: alvo = b; break
        if alvo:
            await r.pg.mouse.click(alvo['x'] + alvo['width']/2, alvo['y'] + alvo['height']/2); await r.espera(2500)
            await r.foto('pin')
        await r.rola(380, vezes=1, pausa=1800); await r.foto('card')
        print((await r.texto())[-500:].replace('\n',' | '))
asyncio.run(main())
