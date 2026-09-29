"""Robô do tutorial Vigent — grava o APP REAL (versão web) logado na conta de demonstração Vigent.
Cada capítulo vira um vídeo vertical 1080x1920 + fotos dos passos. O "dedo" (círculo) mostra
onde se toca. Credenciais: DEMO_VIGENT_CPF / DEMO_VIGENT_SENHA (ambiente), nunca no código."""
import asyncio, os, shutil, subprocess
from pathlib import Path
from playwright.async_api import async_playwright

URL = os.environ.get('APP_WEB_URL', 'https://dimplus-web.vercel.app')
CPF = os.environ['DEMO_VIGENT_CPF']
SENHA = os.environ['DEMO_VIGENT_SENHA']
SAIDA = Path(os.environ.get('SAIDA', '/home/claude/tutorial'))
W, H = 360, 640  # 1080x1920 com escala 3

DEDO = """
(() => {
  const css = document.createElement('style');
  css.textContent = `.dedo{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
    background:rgba(62,238,146,.45);border:3px solid rgba(32,39,69,.55);pointer-events:none;z-index:2147483647;
    transform:scale(.4);opacity:0;transition:transform .25s ease,opacity .25s ease}
    .dedo.on{transform:scale(1);opacity:1}`;
  const pronto = () => document.head.appendChild(css);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', pronto) : pronto();
  window.addEventListener('pointerdown', (e) => {
    const d = document.createElement('div'); d.className = 'dedo';
    d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px';
    document.body.appendChild(d); requestAnimationFrame(() => d.classList.add('on'));
    setTimeout(() => { d.classList.remove('on'); setTimeout(() => d.remove(), 300); }, 650);
  }, true);
})();
"""

class Robo:
    def __init__(self, capitulo: str):
        self.cap = capitulo; self.n = 0
        (SAIDA / 'fotos' / capitulo).mkdir(parents=True, exist_ok=True)
        (SAIDA / 'videos').mkdir(parents=True, exist_ok=True)

    async def __aenter__(self):
        self.p = await async_playwright().start()
        px = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
        self.b = await self.p.chromium.launch(proxy={'server': px} if px else None)
        self.tmp = SAIDA / 'tmp' / self.cap
        shutil.rmtree(self.tmp, ignore_errors=True); self.tmp.mkdir(parents=True)
        self.ctx = await self.b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=3,
            ignore_https_errors=True, record_video_dir=str(self.tmp), record_video_size={'width': W, 'height': H},  # grava no tamanho da tela; amplia no ffmpeg
            locale='pt-BR', timezone_id='America/Sao_Paulo')
        await self.ctx.add_init_script(DEDO)
        self.pg = await self.ctx.new_page()
        import time
        self.t0 = time.monotonic(); self.cortes = []
        return self

    async def __aexit__(self, *a):
        video = self.pg.video
        await self.ctx.close(); await self.b.close(); await self.p.stop()
        if video:
            bruto = await video.path()
            destino = SAIDA / 'videos' / f'dimplus-vigent-{self.cap}.mp4'
            filtro = 'scale=720:1280:flags=lanczos,fps=30'
            if self.cortes:
                # remove os trechos de espera e refaz a linha do tempo
                cond = '+'.join(f'between(t,{a:.2f},{b:.2f})' for a, b in self.cortes)
                filtro = f"select='not({cond})',setpts=N/FRAME_RATE/TB,scale=720:1280:flags=lanczos,fps=30"
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(bruto), '-vf', filtro,
                            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'medium',
                            '-movflags', '+faststart', '-an', str(destino)], check=True)

    async def espera(self, ms: int): await self.pg.wait_for_timeout(ms)

    async def foto(self, nome: str):
        self.n += 1
        await self.pg.screenshot(path=str(SAIDA / 'fotos' / self.cap / f'{self.n:02d}-{nome}.png'))

    async def toca(self, texto: str, exato: bool = True, espera: int = 1800, botao: bool = False):
        # botao=True mira o elemento com papel de botão (o título da tela pode ter o mesmo texto)
        alvo = (self.pg.get_by_role('button', name=texto) if botao else self.pg.get_by_text(texto, exact=exato)).first
        await alvo.scroll_into_view_if_needed()
        caixa = await alvo.bounding_box()
        await self.pg.mouse.click(caixa['x'] + caixa['width'] / 2, caixa['y'] + caixa['height'] / 2)
        await self.espera(espera)

    async def abrir_login(self):
        await self.pg.goto(URL, wait_until='networkidle', timeout=90000); await self.espera(2500)

    async def login(self, devagar: bool = False):
        await self.abrir_login()
        campos = await self.pg.query_selector_all('input')
        if devagar:
            await campos[0].click(); await self.pg.keyboard.type(CPF, delay=90); await self.espera(400)
            await campos[1].click(); await self.pg.keyboard.type(SENHA, delay=60); await self.espera(500)
        else:
            await campos[0].fill(CPF); await campos[1].fill(SENHA)
        await self.toca('Entrar', botao=True, espera=300)
        await self.aguarda('Olá,', maximo=40000)  # a espera do login também sai do vídeo

    async def rola(self, dy: int, vezes: int = 1, x: int = W // 2, y: int = H // 2, pausa: int = 450):
        await self.pg.mouse.move(x, y)
        for _ in range(vezes):
            await self.pg.mouse.wheel(0, dy); await self.espera(pausa)

    async def texto(self) -> str: return await self.pg.inner_text('body')

    async def aguarda(self, texto: str, maximo: int = 60000, exato: bool = False) -> bool:
        """Espera um texto aparecer. O tempo de espera (carregando) é CORTADO do vídeo depois,
        mantendo ~0,8 s do spinner, para o tutorial não arrastar."""
        import time
        ini = time.monotonic()
        try:
            await self.pg.get_by_text(texto, exact=exato).first.wait_for(state='visible', timeout=maximo)
            ok = True
        except Exception:
            ok = False
        fim = time.monotonic()
        if fim - ini > 1.6:
            self.cortes.append((ini - self.t0 + 0.8, fim - self.t0))
        await self.espera(900)
        return ok
