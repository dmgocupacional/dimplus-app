import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cap_prototipo as cp
from playwright.async_api import async_playwright
async def run(qual):
    async with async_playwright() as p:
        px=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
        b=await p.chromium.launch(proxy={'server':px} if px else None)
        ctx=await b.new_context(viewport={'width':cp.W,'height':cp.H},device_scale_factor=3,ignore_https_errors=True,locale='pt-BR'); pg=await ctx.new_page()
        await pg.goto(cp.URL, wait_until='networkidle', timeout=90000); await pg.wait_for_timeout(2000)
        c=await pg.query_selector_all('input'); await c[0].fill(cp.CPF); await c[1].fill(cp.SENHA)
        await pg.get_by_role('button',name='Entrar').click(); await cp.espera_texto(pg,'Olá,'); await pg.wait_for_timeout(2000)
        await pg.mouse.move(cp.W//2, 380); await pg.mouse.wheel(0, 300); await pg.wait_for_timeout(900)
        dados=json.load(open(f'{cp.OUT}/prototipo.json'))
        if qual=='clube':
            await cp.clique(pg,'Clube de descontos'); await cp.espera_texto(pg,'Seu cartão de farmácia'); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=f'{cp.OUT}/clube.png')
            hots=[await cp.alvo(pg,'Farmácias próximas','far-lista'),await cp.alvo(pg,'Abrir o clube de descontos',None,aviso='No app, abre o clube de descontos com as ofertas das lojas parceiras, já com você conectado.'),await cp.alvo(pg,'Continuar para o app','inicio')]
            dados['telas']['clube']={'abas':False,'hots':[h for h in hots if h]}
        else:
            await cp.clique(pg,'Ajuda'); await pg.wait_for_timeout(3000)
            await pg.screenshot(path=f'{cp.OUT}/ajuda.png'); dados['telas']['ajuda']={'abas':False,'hots':[]}
        json.dump(dados,open(f'{cp.OUT}/prototipo.json','w'),ensure_ascii=False,indent=1); print(qual,'ok')
        await b.close()
asyncio.run(run(sys.argv[1]))
