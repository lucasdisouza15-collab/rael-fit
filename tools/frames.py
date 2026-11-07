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

def raio_cabeca(im, seed, g):
    x, y = seed
    k = im.shape[1] / 1024.0
    dark = im < 170
    dark[int(g - 4 * k):, :] = False
    out = ndi.binary_closing(dark, iterations=9)
    lab, _ = ndi.label(~out)
    fig = ~(lab == lab[0, 0])
    dt = ndi.distance_transform_edt(fig)
    r = int(80 * k)
    return float(dt[max(0, y - r):y + r, max(0, x - r):x + r].max())

def medir(path, seed):
    img = Image.open(path).convert('L')
    if img.size[0] != 1024:  # mede sempre na escala 1024
        f = 1024 / img.size[0]; img = img.resize((1024, 1024), Image.LANCZOS); seed = [int(seed[0] * f), int(seed[1] * f)]
    im = np.array(img).astype(int)
    g = chao(im)
    d = im < 120
    d[g - 4:g + 5, :] = False
    ys = np.where(d.any(1))[0]
    return dict(chao=g, altura=int(g - ys.min()), cabeca=raio_cabeca(im, seed, g))

def check():
    falhas = 0
    for nome, s in M['sequencias'].items():
        res = []
        for q in s['quadros']:
            r = medir(os.path.join(AQUI, '..', 'ex', q['arq']), q['semente'])
            res.append((q['arq'], r))
        base = np.median([r['cabeca'] for _, r in res])
        g0 = res[0][1]['chao']
        for arq, r in res:
            ok_g = abs(r['chao'] - g0) <= TOL_CHAO
            ok_c = abs(r['cabeca'] - base) / base <= TOL_CABECA
            st = 'ok' if ok_g and ok_c else 'FALHOU'
            if st != 'ok': falhas += 1
            print(f"[{nome}] {arq}: chão {r['chao']} altura {r['altura']} cabeça r={r['cabeca']:.1f} (ref {base:.1f}) {st}")
    print('quadros fora do padrão:', falhas)
    return falhas

def build(src):
    ALVO_R = M['alvo_raio_cabeca']; G = M['chao_y']; N = 1024  # alvo e chão na escala 1024
    for nome, s in M['sequencias'].items():
        if s.get('so_check'): continue
        for q in s['quadros']:
            im = Image.open(os.path.join(src, q['origem'])).convert('RGB')
            a = np.array(im)
            gl = chao(np.array(im.convert('L')).astype(int))
            bg = np.median(a[5:40, 5:40].reshape(-1, 3), axis=0).astype(np.uint8)
            cor_linha = tuple(int(v) for v in a[gl, N // 2])
            a[gl - 4:gl + 5, :] = bg   # apaga a linha original (redesenhada depois)
            r = raio_cabeca(np.array(Image.fromarray(a).convert('L')).astype(int), q['semente_origem'], gl)
            sc = ALVO_R / r
            ys, xs = np.where((np.array(Image.fromarray(a).convert('L')) < 120)[:gl - 4])
            cx = (xs.min() + xs.max()) / 2
            w = int(round(N * sc))
            big = Image.fromarray(a).resize((w, w), Image.LANCZOS)
            canvas = Image.new('RGB', (N, N), tuple(int(v) for v in bg))
            # ponto (cx, gl) vai para (N/2, G)
            canvas.paste(big, (int(round(N / 2 - cx * sc)), int(round(G - gl * sc))))
            ImageDraw.Draw(canvas).line([(58, G), (965, G)], fill=cor_linha, width=3)
            sx, sy = q['semente_origem']
            q['semente'] = [int(round(((N / 2 + (sx - cx) * sc)) / 2)), int(round((G + (sy - gl) * sc) / 2))]
            canvas = canvas.resize((512, 512), Image.LANCZOS)
            canvas.save(os.path.join(AQUI, '..', 'ex', q['arq']), quality=88)
            print(q['arq'], 'escala', round(sc, 3))
    json.dump(M, open(os.path.join(AQUI, 'frames.json'), 'w'), indent=1, ensure_ascii=False)

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'build': build(sys.argv[2])
    else: sys.exit(1 if check() else 0)
