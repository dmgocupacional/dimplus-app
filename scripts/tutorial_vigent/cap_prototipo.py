"""Percorre o app REAL e grava cada tela + a posição exata dos pontos de toque (protótipo do site)."""
import asyncio, json, os
from playwright.async_api import async_playwright
URL='https://dimplus-web.vercel.app'; CPF=os.environ['DEMO_VIGENT_CPF']; SENHA=os.environ['DEMO_VIGENT_SENHA']
OUT=os.environ.get('SAIDA_PROTO', '/tmp/tutorial/proto'); W,H=360,640
telas={}
async def caixa(pg, texto, exato=True, papel=None):
    loc = pg.get_by_role(papel, name=texto) if papel else pg.get_by_text(texto, exact=exato)
    n = await loc.count()
    for k in range(n):
        el = loc.nth(k)
        if await el.is_visible():
            b = await el.bounding_box()
            if b and b['y'] >= 0 and b['y'] + b['height'] <= H + 2: return b
    return None
def pct(b, pad=6):
    x=max(0,b['x']-pad); y=max(0,b['y']-pad); w=min(W-x,b['width']+2*pad); h=min(H-y,b['height']+2*pad)
    return [round(100*x/W,2), round(100*y/H,2), round(100*w/W,2), round(100*h/H,2)]
async def foto(pg, id, hots, abas=True):
    await pg.wait_for_timeout(700)
    await pg.screenshot(path=f'{OUT}/{id}.png')
    telas[id]={'abas':abas,'hots':hots}
async def alvo(pg, texto, destino, exato=True, papel=None, rotulo=None, **kw):
    b = await caixa(pg, texto, exato, papel)
    if not b: print('  ⚠ sem alvo', texto); return None
    d={'r':pct(b),'rotulo':rotulo or texto}; d.update({'ir':destino} if destino else {}); d.update(kw); return d
async def clique(pg, texto, exato=True):
    b = await caixa(pg, texto, exato)
    if not b: raise RuntimeError('não achei visível: ' + texto)
    await pg.mouse.click(b['x'] + b['width']/2, b['y'] + b['height']/2)
async def espera_texto(pg, t, ms=60000):
    try: await pg.get_by_text(t, exact=False).first.wait_for(state='visible', timeout=ms)
    except Exception: print('  ⚠ timeout', t)
ABAS = {}
async def home(pg):
    # sem recarregar (na web, recarregar desconecta): volta pelo histórico e toca em Início
    for _ in range(10):
        if await caixa(pg, 'Seus inclusos'): break
        if ABAS and await caixa(pg, 'Início'):
            await aba(pg, 'inicio'); await pg.wait_for_timeout(1500); continue
        await pg.go_back(); await pg.wait_for_timeout(1500)
    await pg.mouse.move(W//2, 300); await pg.mouse.wheel(0, -2000); await pg.wait_for_timeout(1000)
async def rola_ate(pg, texto):
    await pg.mouse.move(W//2, 380)
    for _ in range(25):
        bb = await caixa(pg, texto)
        if bb and bb['y'] < H*0.75: return
        await pg.mouse.wheel(0, 140); await pg.wait_for_timeout(250)
async def aba(pg, nome):
    x, y, w, h = ABAS[nome]
    await pg.mouse.click((x + w/2) * W / 100, (y + h/2) * H / 100)
async def main():
    async with async_playwright() as p:
        px=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
        b=await p.chromium.launch(proxy={'server':px} if px else None)
        ctx=await b.new_context(viewport={'width':W,'height':H},device_scale_factor=3,ignore_https_errors=True,locale='pt-BR')
        pg=await ctx.new_page()
        await pg.goto(URL, wait_until='networkidle', timeout=90000); await pg.wait_for_timeout(2000)
        c=await pg.query_selector_all('input'); await c[0].fill(CPF); await c[1].fill(SENHA)
        await pg.get_by_role('button',name='Entrar').click(); await espera_texto(pg,'Olá,'); await pg.wait_for_timeout(1800)
        # abas (mesma posição em todas as telas com barra)
        abas={}
        for t,d in [('Início','inicio'),('Rede','rede'),('Família','familia'),('Perfil','perfil')]:
            bb=await caixa(pg,t); abas[d]=pct(bb,8) if bb else None
        ABAS.update(abas)
        topo=await caixa(pg,'PLANO'); base=await caixa(pg,'Cartão benefício by DIMEG')
        cartao={'x':16,'y':topo['y']-24,'width':W-32,'height':base['y']+base['height']-topo['y']+30}
        inclusos=await caixa(pg,'Seus inclusos')
        await foto(pg,'inicio',[{'r':pct(cartao,0),'rotulo':'Deslize o cartão','ir':'inicio-farmacia'},
                                {'r':pct(inclusos,10),'rotulo':'Ver mais','ir':'inicio-baixo'}])
        await pg.mouse.move(W//2, 260)
        for _ in range(6): await pg.mouse.wheel(90,0); await pg.wait_for_timeout(120)
        await pg.wait_for_timeout(1200)
        await foto(pg,'inicio-farmacia',[{'r':pct(cartao,0),'rotulo':'Voltar ao cartão DIM+','ir':'inicio'},
                                         {'r':pct(inclusos,10),'rotulo':'Ver mais','ir':'inicio-baixo'}])
        for _ in range(6): await pg.mouse.wheel(-90,0); await pg.wait_for_timeout(120)
        await pg.mouse.move(W//2, 400); await pg.mouse.wheel(0,420); await pg.wait_for_timeout(1500)
        hs=[]
        for t,d,extra in [('Agendar','ag-menu',{}),('Clube de descontos','clube',{}),('Ajuda','ajuda',{}),
                          ('Telemedicina',None,{'aviso':'No app, a Telemedicina confirma com você e abre uma consulta por vídeo com um médico. Na demonstração, nada é aberto.'}),
                          ('SOS',None,{'aviso':'No app, o SOS usa a sua localização para mostrar o pronto atendimento mais perto e o botão de ligar para o 192.'}),
                          ('Exames',None,{'aviso':'Resultados de exames chegam em breve no app.'})]:
            a=await alvo(pg,t,d,**extra)
            if a: hs.append(a)
        hs.append({'r':[4,12,92,20],'rotulo':'Voltar ao topo','ir':'inicio'})
        await foto(pg,'inicio-baixo',hs)
        # agendamento
        await clique(pg,'Agendar'); await espera_texto(pg,'Novo agendamento')
        await foto(pg,'ag-menu',[await alvo(pg,'Novo agendamento','ag-esp')],abas=False)
        await clique(pg,'Novo agendamento'); await espera_texto(pg,'Cardiologia')
        await foto(pg,'ag-esp',[await alvo(pg,'Cardiologia','ag-med')],abas=False)
        await clique(pg,'Cardiologia'); await espera_texto(pg,'Próxima data')
        await foto(pg,'ag-med',[await alvo(pg,'Dr. Alberto Antonio Ivo De Medeiros Filho','ag-cal',rotulo='Escolher o médico')],abas=False)
        await clique(pg,'Dr. Alberto Antonio Ivo De Medeiros Filho'); await espera_texto(pg,'Toque em um dia com vaga')
        await pg.wait_for_timeout(1500)
        dias=pg.get_by_text('30',exact=True); dia=None
        for k in range(await dias.count()):
            bb=await dias.nth(k).bounding_box()
            if bb and bb['y']>150: dia=bb
        await foto(pg,'ag-cal',[{'r':pct(dia,8),'rotulo':'Dia com vaga','ir':'ag-hora'}],abas=False)
        await pg.mouse.click(dia['x']+dia['width']/2, dia['y']+dia['height']/2); await espera_texto(pg,'Escolher horário'); await pg.wait_for_timeout(1500)
        hora=await caixa(pg,'14:45')
        await foto(pg,'ag-hora',[{'r':pct(hora,4),'rotulo':'Escolher o horário','aviso':'O app pergunta "Confirmar agendamento?" e, ao confirmar, a consulta aparece em Meus agendamentos, com o prazo para desmarcar sem perder. Na demonstração, nenhuma consulta é marcada.'}],abas=False)
        # rede e farmácias
        await home(pg); await aba(pg,'rede'); await pg.wait_for_timeout(2500)
        await foto(pg,'rede',[await alvo(pg,'Como chegar',None,aviso='"Como chegar" abre a rota no seu aplicativo de mapas.'),
                              {'r':[4,78,92,10],'rotulo':'Ver mais','ir':'rede-baixo'}])
        await pg.mouse.move(W//2,400)
        for _ in range(25):
            bb = await caixa(pg,'Farmácias Vidalink')
            if bb and bb['y'] < H*0.6: break
            await pg.mouse.wheel(0,150); await pg.wait_for_timeout(250)
        await pg.wait_for_timeout(1000)
        await foto(pg,'rede-baixo',[await alvo(pg,'Farmácias Vidalink','far-lista'),await alvo(pg,'Clube de descontos','clube'),
                                    {'r':[4,12,92,14],'rotulo':'Voltar ao topo','ir':'rede'}])
        await clique(pg,'Farmácias Vidalink'); await espera_texto(pg,'farmácias conveniadas'); await pg.wait_for_timeout(1500)
        await foto(pg,'far-lista',[await alvo(pg,'Mapa','far-mapa'),await alvo(pg,'Como chegar',None,aviso='"Como chegar" abre a rota até a farmácia no seu aplicativo de mapas.'),
                                   await alvo(pg,'Ver cartão','inicio-farmacia')],abas=False)
        await clique(pg,'Mapa'); await pg.wait_for_timeout(5000)
        await pg.mouse.move(W//2,400); await pg.mouse.wheel(0,420); await pg.wait_for_timeout(1800)
        fr=pg.frame_locator('iframe[title="Mapa das farmácias conveniadas"]'); pins=fr.locator('.pin'); pin=None
        for k in range(await pins.count()):
            bb=await pins.nth(k).bounding_box()
            if bb and 150<bb['y']<520: pin=bb; break
        await foto(pg,'far-mapa',[{'r':pct(pin,10),'rotulo':'Tocar no pin','ir':'far-card'},await alvo(pg,'Lista','far-lista')],abas=False)
        await pg.mouse.click(pin['x']+pin['width']/2,pin['y']+pin['height']/2); await pg.wait_for_timeout(2500)
        await pg.mouse.wheel(0,380); await pg.wait_for_timeout(1800)
        await foto(pg,'far-card',[await alvo(pg,'Como chegar',None,aviso='"Como chegar" abre a rota até a farmácia no seu aplicativo de mapas.')],abas=False)
        # família, perfil, clube, ajuda
        await home(pg); await aba(pg,'familia'); await pg.wait_for_timeout(3000)
        await foto(pg,'familia',[])
        await aba(pg,'perfil'); await pg.wait_for_timeout(3000)
        await foto(pg,'perfil',[await alvo(pg,'Família','familia',rotulo='Família')])
        for t in telas.values(): t['hots']=[h for h in t['hots'] if h]
        json.dump({'abas':abas,'telas':telas},open(f'{OUT}/prototipo.json','w'),ensure_ascii=False,indent=1)
        print('telas',len(telas),{k:len(v['hots']) for k,v in telas.items()})
        await b.close()
if __name__ == '__main__': asyncio.run(main())
