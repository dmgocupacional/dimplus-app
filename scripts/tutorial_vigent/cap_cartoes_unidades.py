import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from robo import Robo, W
async def cartoes():
    async with Robo('cartoes') as r:
        await r.login(); await r.espera(1500); await r.foto('cartao-dimplus')
        # desliza o carrossel para o cartão de farmácia
        await r.pg.mouse.move(W // 2, 260)
        for _ in range(6): await r.pg.mouse.wheel(90, 0); await r.espera(120)
        await r.espera(1500); await r.foto('cartao-farmacia')
        for _ in range(6): await r.pg.mouse.wheel(-90, 0); await r.espera(120)
        await r.espera(1200)
        await r.rola(300, vezes=1, pausa=1800); await r.foto('inclusos')
async def unidades():
    async with Robo('unidades') as r:
        await r.login(); await r.espera(800)
        await r.toca('Rede', exato=True, espera=2500); await r.foto('clinicas')
        await r.rola(350, vezes=3, pausa=900); await r.foto('clinicas-mais')
asyncio.run(cartoes() if sys.argv[1] == 'cartoes' else unidades())
