import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from robo import Robo
async def main():
    async with Robo('agendar') as r:
        await r.login(); await r.espera(1500); await r.foto('home')
        await r.toca('Agendar', espera=2000); await r.foto('menu-agendar')
        await r.toca('Novo agendamento', espera=500)
        await r.aguarda('Cardiologia', exato=True); await r.foto('especialidades')
        await r.rola(250, vezes=1, pausa=700)
        await r.toca('Cardiologia', exato=True, espera=300)
        await r.aguarda('Próxima data'); await r.espera(800); await r.foto('medicos')
        await r.toca('Dr. Alberto Antonio Ivo De Medeiros Filho', espera=300)
        await r.aguarda('Toque em um dia com vaga', maximo=70000); await r.espera(800); await r.foto('calendario')
        await r.toca('30', exato=True, espera=300)
        await r.aguarda('09:45', maximo=40000); await r.espera(900); await r.foto('horarios')
        await r.toca('14:45', exato=True, espera=2200)
asyncio.run(main())
