# index.template.html の __WT__ を source/width-table.txt で埋めて index.html を作る。実行: python source/build.py
import os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
t = open(os.path.join(root, 'index.template.html'), encoding='utf-8').read()
wt = open(os.path.join(root, 'source', 'width-table.txt'), encoding='utf-8').read().strip()
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8', newline='\n').write(t.replace('__WT__', wt))
