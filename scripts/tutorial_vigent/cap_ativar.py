import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from robo import Robo
async def main():
    async with Robo('ativar') as r:
        await r.abrir_login(); await r.foto('login')
        await r.login(devagar=True)
        await r.foto('termo')
        # lê o termo até o fim (a tela só libera o aceite no fim)
        await r.rola(700, vezes=14, y=380, pausa=280)
        await r.espera(800); await r.foto('termo-fim')
        await r.toca('Autorizo o uso dos meus dados de saúde', exato=False, espera=1200)
        await r.foto('consentimento')
        await r.toca('Li e aceito o termo', espera=6000)
        await r.foto('apos-aceite')
        t = await r.texto(); print('TELA APOS ACEITE:', t[:300].replace('\n',' | '))
        if 'Gerar meu cartão' in t:
            if 'Masculino' in t: await r.toca('Masculino', espera=900)
            await r.toca('Gerar meu cartão', espera=15000)
            await r.foto('cartao-gerado')
            t = await r.texto(); print('TELA APOS CARTAO:', t[:300].replace('\n',' | '))
        await r.espera(3000); await r.foto('final')
        print('URL FINAL', r.pg.url)
asyncio.run(main())
