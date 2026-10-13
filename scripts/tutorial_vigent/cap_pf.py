"""Capítulos só do site do cliente PF (bem-vindo.dimmsaude.com.br, DEMO_SLUG=dimplus).
13/10/2026. ativar: tela de entrada (sem login) + Início já logado. financeiro: aba Financeiro.
Uso: python cap_pf.py ativar | financeiro"""
import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from robo import Robo, URL


async def ativar():
    async with Robo('ativar') as r:
        # Sem ?demo: o app abre na tela de entrada, como o cliente vê depois de baixar.
        await r.pg.goto(URL, wait_until='networkidle', timeout=90000); await r.espera(2500)
        await r.foto('login')
        await r.login(); await r.espera(1500); await r.foto('inicio')


async def financeiro():
    async with Robo('financeiro') as r:
        await r.login(); await r.espera(800)
        await r.toca('Financeiro', exato=True, espera=3000); await r.foto('financeiro')


asyncio.run(ativar() if sys.argv[1] == 'ativar' else financeiro())
