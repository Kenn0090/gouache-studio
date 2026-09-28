#!/bin/bash
# Runs every end-to-end test against dist-web/ (run `npm run build` in the repo root first).
# Results go to regress.log; a test prints "ALL PASSED" (or "no errors" for t4/t5/t7) when it passes.
cd "$(dirname "$0")"; : > regress.log
for t in convtab conv2 quickwins brushtab specgloss dock gallery filters17 bigobj hp2 baketab cage bake bake2 bake3 bakeperf v3 fxl conv fx perf maps maps2 maps3 gfile tex xf sel sel2 prefs fill anim t4 t5 t7; do
  echo "== $t: $(timeout 900 node $t.cjs 2>&1 | grep -E 'FAIL|ALL PASSED|ERR|no errors' | tail -3 | tr '\n' ' ')" >> regress.log
done
echo DONE >> regress.log
