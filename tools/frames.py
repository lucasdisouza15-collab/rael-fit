#!/usr/bin/env python3
"""Auditoria e normalização dos quadros de animação (ex/*_Gemini-N.jpg).
Mede por código, por quadro: linha do chão, altura da figura e raio da cabeça
(maior círculo inscrito numa janela ao redor da semente da cabeça), compara entre
os quadros de cada sequência e FALHA se não baterem.
Uso:  python3 tools/frames.py check            # confere (saída 0 = ok)
      python3 tools/frames.py build <pasta-origem> # normaliza originais 1024px -> ex/ 512px
Requer Pillow + scipy. Manifesto: tools/frames.json
"""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

AQUI = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(AQUI, 'frames.json')))
TOL_CHAO = 2      # px (na escala do arquivo)
TOL_CABECA = 0.08 # 8% no raio da cabeça

def chao(im):
    rows = (im < 120).sum(1)
    ys = [y for y in range(len(rows)) if rows[y] > im.shape[1] * 0.58]
    return max(ys) if ys else None

def raio_cabeca(im, seed, g, k=None):
    x, y = seed
    k = k or im.shape[1] / 1024.0
    dark = im < 170
    dark[int(g - 4 * k):, :] = False
    out = ndi.binary_closing(dark, iterations=9)
    lab, _ = ndi.label(~out)
    fig = ~(lab == lab[0, 0])
    dt = ndi.distance_transform_edt(fig)
    r = int(80 * k)
    w = dt[max(0, y - r):y + r, max(0, x - r):x + r]
    cy = np.unravel_index(w.argmax(), w.shape)[0] + max(0, y - r)
    return float(w.max()), int(cy)

def raio_cabeca_g(im, seed, g):
    return raio_cabeca(im, seed, g, k=1.0)

def medir(path, seed):
    img = Image.open(path).convert('L')
    if img.size[0] != 1024:  # mede sempre na escala 1024
        f = 1024 / img.size[0]; img = img.resize((1024, 1024), Image.LANCZOS); seed = [int(seed[0] * f), int(seed[1] * f)]
    im = np.array(img).astype(int)
    g = chao(im)
    d = im < 120
    d[g - 4:g + 5, :] = False
    ys = np.where(d.any(1))[0]
    rc, cy = raio_cabeca(im, seed, g)
    return dict(chao=g, altura=int(g - ys.min()), cabeca=rc, corpo=int(ys.max() - seed[1]), topo=int(ys.min()))

def check():
    falhas = 0
    for nome, s in M['sequencias'].items():
        res = []
        for q in s['quadros']:
            r = medir(os.path.join(AQUI, '..', 'ex', q['arq']), q['semente'])
            res.append((q['arq'], r))
        base = np.median([r['cabeca'] for (a, r), q in zip(res, s['quadros']) if not q.get('cabeca_ocluida')])
        em_pe = [r['corpo'] for (a, r), q in zip(res, s['quadros']) if q.get('em_pe')]
        corpo0 = em_pe[0] if em_pe else None  # referência = 1º quadro em pé
        g0 = res[0][1]['chao']
        for arq, r in res:
            ok_g = abs(r['chao'] - g0) <= TOL_CHAO
            q0 = next(q for q in s['quadros'] if q['arq'] == arq)
            ok_c = q0.get('cabeca_ocluida') or abs(r['cabeca'] - base) / base <= TOL_CABECA
            ok_t = r['topo'] >= 8  # figura inteira dentro da imagem (sem corte no topo)
            q = next(q for q in s['quadros'] if q['arq'] == arq)
            ok_b = True
            if q.get('em_pe') and corpo0:  # quadros em pé/salto: cabeça-até-pé igual (8%)
                ok_b = abs(r['corpo'] - corpo0) / corpo0 <= TOL_CABECA
            st = 'ok' if ok_g and ok_c and ok_b and ok_t else 'FALHOU'
            if st != 'ok' and q.get('pendente') and ok_g and ok_c: st = 'AVISO (pendente: quadro a refazer no Gemini)'
            elif st != 'ok': falhas += 1
            print(f"[{nome}] {arq}: chão {r['chao']} altura {r['altura']} cabeça r={r['cabeca']:.1f} (ref {base:.1f}) corpo {r['corpo']} {st}")
    print('quadros fora do padrão:', falhas)
    return falhas

def build(src):
    ALVO_R = M['alvo_raio_cabeca']; G = M['chao_y']; N = 1024; PAD = 250
    for nome, s in M['sequencias'].items():
        if s.get('so_check'): continue
        for q in s['quadros']:
            im = Image.open(os.path.join(src, q['origem'])).convert('RGB')
            a = np.array(im)
            gl = chao(np.array(im.convert('L')).astype(int))
            bg = np.median(a[5:40, 5:40].reshape(-1, 3), axis=0).astype(np.uint8)
            cor_linha = tuple(int(v) for v in a[gl, N // 2])
            ALVO_BG = np.array(M.get('fundo', [247, 247, 242]))  # mesmo fundo em todos os quadros (sem piscar)
            a = np.clip(a.astype(int) + (ALVO_BG - bg.astype(int)), 0, 255).astype(np.uint8); bg = ALVO_BG.astype(np.uint8)
            a[gl - 4:gl + 5, :] = bg   # apaga a linha original (redesenhada depois)
            sx, sy = q['semente_origem']
            # margem em volta (para girar sem cortar) ; (x, y) passam a ser + PAD
            big0 = Image.new('RGB', (N + 2 * PAD, N + 2 * PAD), tuple(int(v) for v in bg))
            big0.paste(Image.fromarray(a), (PAD, PAD))
            sx += PAD; sy += PAD; glp = gl + PAD
            L0 = (np.array(Image.fromarray(a).convert('L')) < 120)[:gl - 4]
            ys, xs = np.where(L0)
            px, py = xs[ys.argmax()] + PAD, ys.max() + PAD  # ponto mais baixo (pivô do giro)
            ang = q.get('girar', 0)
            if ang:  # gira em torno do pé (graus, anti-horário), mantendo a distância do chão
                big0 = big0.rotate(ang, resample=Image.BICUBIC, center=(px, py), fillcolor=tuple(int(v) for v in bg))
                import math
                t = math.radians(ang); dx, dy = sx - px, sy - py
                sx = px + dx * math.cos(t) + dy * math.sin(t); sy = py - dx * math.sin(t) + dy * math.cos(t)
                L1 = (np.array(big0.convert('L')) < 120)
                L1[glp - 4:, :] = False
                ys, xs = np.where(L1); xs = xs - PAD
            sx = int(round(sx)); sy = int(round(sy))
            g = np.array(big0.convert('L')).astype(int)
            r, _ = raio_cabeca_g(g, (sx, sy), glp)
            sc = q['escala_fixa'] if q.get('escala_fixa') else ALVO_R / r * q.get('escala_extra', 1.0)
            cx = (xs.min() + xs.max()) / 2 + PAD
            w = int(round(big0.size[0] * sc))
            big = big0.resize((w, w), Image.LANCZOS)
            canvas = Image.new('RGB', (N, N), tuple(int(v) for v in bg))
            canvas.paste(big, (int(round(N / 2 - cx * sc)), int(round(G - glp * sc))))
            ImageDraw.Draw(canvas).line([(58, G), (965, G)], fill=cor_linha, width=3)
            q['semente'] = [int(round((N / 2 + (sx - cx) * sc) / 2)), int(round((G + (sy - glp) * sc) / 2))]
            canvas = canvas.resize((512, 512), Image.LANCZOS)
            canvas.save(os.path.join(AQUI, '..', 'ex', q['arq']), quality=88)
            print(q['arq'], 'escala', round(sc, 3))
    json.dump(M, open(os.path.join(AQUI, 'frames.json'), 'w'), indent=1, ensure_ascii=False)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'build': build(sys.argv[2])
    else: sys.exit(1 if check() else 0)
