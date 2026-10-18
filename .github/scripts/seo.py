#!/usr/bin/env python3
"""SEO automático de Sunaely.

Cada ejecución (push, a diario y a mano):
 1. noindex automático: las páginas ocultas con el ojo del índice (colección 'paginas' de Firestore)
    reciben <meta name="robots" content="noindex, nofollow" data-auto>. Un noindex manual se respeta siempre.
 2. Bloque SEO gestionado entre <!-- seo:start --> y <!-- seo:end --> en cada página pública:
    canonical, hreflang, Open Graph, Twitter Card, theme-color y JSON-LD (WebSite/Organization en la portada;
    WebPage + BreadcrumbList en el resto). Lee el <title> y la meta description de cada página (esas las escribes tú).
 3. sitemap.xml (con lastmod desde git) y robots.txt, con la URL correcta según el repositorio.
 4. Auditoría (--check): avisos/errores de título, descripción, h1, alt, lang, viewport, enlaces rotos y duplicados.
Ignora google*.html y 404.html. Ajustes globales en seo.json.
"""
import glob, html as H, json, os, re, subprocess, sys, urllib.request
from collections import Counter

REPO = os.environ.get('GITHUB_REPOSITORY', '')
PROJECT = os.environ.get('FIREBASE_PROJECT', '')
IGNORE = re.compile(r'^(google[0-9a-f]+\.html|404\.html)$', re.I)
AUTO_RE = re.compile(r'[ \t]*<meta name="robots" content="[^"]*" data-auto>[ \t]*\n?', re.I)
MANUAL_RE = re.compile(r'<meta\s+name="robots"[^>]*noindex(?![^>]*data-auto)[^>]*>', re.I)
AUTO_TAG = '<meta name="robots" content="noindex, nofollow" data-auto>'
BLOCK_RE = re.compile(r'[ \t]*<!-- seo:start -->.*?<!-- seo:end -->[ \t]*\n?', re.S)
CFG = json.load(open('seo.json', encoding='utf-8')) if os.path.exists('seo.json') else {}


def site_url():
    owner, _, repo = REPO.partition('/')
    if not owner:
        sys.exit('Falta GITHUB_REPOSITORY (formato dueño/repo)')
    owner = owner.lower()
    return f'https://{owner}.github.io/' + ('' if repo.lower() == f'{owner}.github.io' else repo + '/')


def private_pages():
    if 'SEO_PRIVATE' in os.environ:
        return {x for x in os.environ['SEO_PRIVATE'].split(',') if x}
    if not PROJECT:
        print('FIREBASE_PROJECT sin configurar: no se tocan los noindex')
        return None
    url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/paginas?pageSize=300'
    out, token = set(), None
    try:
        while True:
            with urllib.request.urlopen(url + (f'&pageToken={token}' if token else ''), timeout=30) as r:
                data = json.load(r)
            for d in data.get('documents', []):
                if d.get('fields', {}).get('private', {}).get('booleanValue') is True:
                    out.add(d['name'].rsplit('/', 1)[-1])
            token = data.get('nextPageToken')
            if not token:
                return out
    except Exception as e:
        print('No se pudo leer Firestore, no se tocan los noindex:', e)
        return None


def lastmod(path):
    try:
        r = subprocess.run(['git', 'log', '-1', '--format=%cI', '--', path], capture_output=True, text=True)
        return r.stdout.strip() or None
    except Exception:
        return None


def set_auto_noindex(src, want):
    has = bool(AUTO_RE.search(src))
    if want and not has:
        m = re.search(r'</title>[ \t]*\n?', src, re.I) or re.search(r'<head[^>]*>[ \t]*\n?', src, re.I)
        if not m:
            return src
        return src[:m.end()] + ('' if m.group(0).endswith('\n') else '\n') + AUTO_TAG + '\n' + src[m.end():]
    return AUTO_RE.sub('', src) if (has and not want) else src


def get(src, pat):
    m = re.search(pat, src, re.I | re.S)
    return H.unescape(m.group(1)).strip() if m else ''


def seo_block(f, src, base):
    title = get(src, r'<title>(.*?)</title>')
    desc = get(src, r'<meta\s+name="description"\s+content="([^"]*)"')
    url = base if f == 'index.html' else base + f
    name, lang = CFG.get('site_name', 'Sitio'), CFG.get('lang', 'es')
    img = CFG.get('image') or {}
    img_url = base + img['file'] if img.get('file') and os.path.exists(img['file']) else ''
    big = img.get('width', 0) >= 1200
    e = lambda s: H.escape(s, quote=True)
    L = ['<!-- seo:start -->', f'<link rel="canonical" href="{e(url)}">',
         f'<link rel="alternate" hreflang="{lang}" href="{e(url)}">', f'<link rel="alternate" hreflang="x-default" href="{e(url)}">',
         f'<meta name="theme-color" content="{e(CFG.get("theme_color", "#000000"))}">',
         f'<meta property="og:type" content="website">', f'<meta property="og:site_name" content="{e(name)}">',
         f'<meta property="og:locale" content="{e(CFG.get("locale", "es_ES"))}">',
         f'<meta property="og:title" content="{e(title)}">', f'<meta property="og:description" content="{e(desc)}">',
         f'<meta property="og:url" content="{e(url)}">']
    if img_url:
        L += [f'<meta property="og:image" content="{e(img_url)}">', f'<meta property="og:image:alt" content="{e(name)}">']
        if img.get('width'):
            L += [f'<meta property="og:image:width" content="{img["width"]}">', f'<meta property="og:image:height" content="{img["height"]}">']
    L += [f'<meta name="twitter:card" content="{"summary_large_image" if big else "summary"}">',
          f'<meta name="twitter:title" content="{e(title)}">', f'<meta name="twitter:description" content="{e(desc)}">']
    if img_url:
        L.append(f'<meta name="twitter:image" content="{e(img_url)}">')
    org = {'@type': 'Organization', '@id': base + '#org', 'name': name, 'url': base}
    if img_url:
        org['logo'] = img_url
    if f == 'index.html':
        graph = [{'@type': 'WebSite', '@id': base + '#website', 'name': name, 'alternateName': CFG.get('alternate_names', []),
                  'url': base, 'inLanguage': lang, 'publisher': {'@id': base + '#org'}}, org]
    else:
        page = {'@type': CFG.get('schema_types', {}).get(f, 'WebPage'), '@id': url + '#page', 'url': url, 'name': title,
                'description': desc, 'inLanguage': lang, 'isPartOf': {'@id': base + '#website'}, 'publisher': {'@id': base + '#org'}}
        if lastmod(f):
            page['dateModified'] = lastmod(f)
        crumbs = {'@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': CFG.get('names', {}).get('index.html', 'Inicio'), 'item': base},
            {'@type': 'ListItem', 'position': 2, 'name': title.split(' · ')[0].split(' — ')[0], 'item': url}]}
        graph = [page, crumbs, {'@type': 'WebSite', '@id': base + '#website', 'name': name, 'url': base}, org]
    L.append('<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False, separators=(',', ':')) + '</script>')
    L.append('<!-- seo:end -->')
    return '\n'.join(L)


def put_block(src, block):
    if BLOCK_RE.search(src):
        return BLOCK_RE.sub(lambda m: block + '\n', src, count=1)
    m = re.search(r'<meta\s+name="description"[^>]*>[ \t]*\n?', src, re.I) or re.search(r'</title>[ \t]*\n?', src, re.I)
    return src if not m else src[:m.end()] + ('' if m.group(0).endswith('\n') else '\n') + block + '\n' + src[m.end():]


def audit(f, src, files):
    err, warn = [], []
    title, desc = get(src, r'<title>(.*?)</title>'), get(src, r'<meta\s+name="description"\s+content="([^"]*)"')
    if not title: err.append('falta <title>')
    elif not 15 <= len(title) <= 65: warn.append(f'título de {len(title)} caracteres (ideal 15-65)')
    if not desc: err.append('falta meta description')
    elif not 70 <= len(desc) <= 160: warn.append(f'description de {len(desc)} caracteres (ideal 70-160)')
    if len(re.findall(r'<h1[\s>]', src, re.I)) != 1: err.append('debe haber exactamente un <h1>')
    if not re.search(r'<html[^>]*\slang="', src, re.I): err.append('falta lang en <html>')
    if not re.search(r'name="viewport"', src, re.I): err.append('falta meta viewport')
    n = len([i for i in re.findall(r'<img\b[^>]*>', src, re.I) if 'alt=' not in i.lower()])
    if n: warn.append(f'{n} imagen(es) sin alt')
    for href in set(re.findall(r'href="([\w\-]+\.html)(?:#[^"]*)?"', src)):
        if href not in files and not os.path.exists(href): err.append(f'enlace roto: {href}')
    return err, warn


def main():
    check = '--check' in sys.argv
    base = site_url()
    private = None if check else private_pages()
    files = sorted(f for f in glob.glob('*.html') if not IGNORE.match(f))
    urls, report, titles = [], [], {}
    for f in files:
        src = open(f, encoding='utf-8').read()
        if private is not None:
            new = set_auto_noindex(src, f in private)
            if new != src:
                print('noindex', 'añadido a' if f in private else 'quitado de', f); src = new
        hidden = bool(MANUAL_RE.search(src) or AUTO_RE.search(src))
        if hidden:
            new = BLOCK_RE.sub('', src)   # una página oculta no necesita canonical ni OG
        else:
            new = put_block(src, seo_block(f, src, base))
            urls.append((f, lastmod(f)))
            titles.setdefault(get(src, r'<title>(.*?)</title>'), []).append(f)
        if not check and new != src:
            open(f, 'w', encoding='utf-8').write(new); print('bloque SEO actualizado:', f)
        if not hidden:
            e, w = audit(f, new if not check else src, files)
            report.append((f, e, w))
    for t, fs in titles.items():
        if len(fs) > 1: report.append((', '.join(fs), [], [f'título duplicado: «{t}»']))
    if check:
        bad = False
        lines = ['## Auditoría SEO', '']
        for f, e, w in report:
            if e or w: lines.append(f'- **{f}**: ' + '; '.join([f'❌ {x}' for x in e] + [f'⚠️ {x}' for x in w]))
            bad |= bool(e)
        if len(lines) == 2: lines.append('✅ Todo correcto')
        out = '\n'.join(lines); print(out)
        if os.environ.get('GITHUB_STEP_SUMMARY'): open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8').write(out + '\n')
        sys.exit(1 if bad else 0)
    urls.sort(key=lambda x: (x[0] != 'index.html', x[0]))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for f, lm in urls:
        xml.append(f'  <url><loc>{base if f == "index.html" else base + f}</loc>' + (f'<lastmod>{lm}</lastmod>' if lm else '') + '</url>')
    xml.append('</urlset>')
    for path, text in (('sitemap.xml', '\n'.join(xml) + '\n'), ('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {base}sitemap.xml\n')):
        if not os.path.exists(path) or open(path, encoding='utf-8').read() != text:
            open(path, 'w', encoding='utf-8').write(text); print(path, 'actualizado')


if __name__ == '__main__':
    main()
