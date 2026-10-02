import re, io, os

def inv(page, label):
    p = '.tmp/t1/' + page
    if not os.path.exists(p):
        print(page, 'MISSING'); return
    s = io.open(p, encoding='utf8').read()
    pat = re.compile(r'(?:src|href)=(["\'])(/[^"\']+?\.(?:css|js|png|jpe?g|webp|mp3|mp4|glb|woff2?|ttf|otf|json|svg))(\?[^"\']*)?\1')
    res = {m[1] for m in pat.findall(s)}
    res |= set(re.findall(r'(?:src|href)=/js/[^ >]+?\.js', s) and [])
    res |= {m for m in re.findall(r'(?:src|href)=([^\s">]+\.js)', s) if m.startswith('/js/')}
    total = 0; rows = []
    for r in sorted(res):
        r0 = r.split('?')[0]
        fp = '.tmp/t1' + r0
        sz = os.path.getsize(fp) if os.path.exists(fp) else -1
        total += max(sz, 0); rows.append((sz, r0))
    print('==', label, 'refs:', len(res), 'total:', round(total / 1024), 'KB')
    for sz, r in sorted(rows, reverse=True)[:10]:
        if sz >= 0:
            print(f'  {sz//1024:6d} KB  {r}')

inv('start/index.html', 'start 启动页')
inv('home/index.html', 'home 平板屏')
inv('posts/hello-world/index.html', '博客文章页')
inv('world/01/index.html', '世界观档案页')
