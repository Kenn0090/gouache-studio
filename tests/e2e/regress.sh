#!/bin/bash
# Runs every end-to-end test against dist-web/ (run `npm run build` in the repo root first).
# Results go to regress.log; a test prints "ALL PASSED" (or "no errors" for t4/t5/t7) when it passes.
# JOBS=n runs n tests at once (default 2; the heavy bake tests are started first).
cd "$(dirname "$0")"; : > regress.log
one(){ echo "== $1: $(timeout 1200 node $1.cjs 2>&1 | grep -E 'FAIL|ALL PASSED|ERR|no errors' | tail -3 | tr '\n' ' ')" >> regress.log; }
export -f one
printf '%s\n' bakeperf bakecurv canvas19 ui20 p3d p3d2 bakep3 idbake mats mstack livemask matconv projxf smart anchor bigobj bake baketab bake2 bake3 hp2 cage v3 convtab conv2 quickwins brushtab specgloss dock gallery filters17 fxl conv fx perf maps maps2 maps3 gfile tex xf sel sel2 prefs fill anim t4 t5 t7 \
  | grep -vx dock | xargs -P "${JOBS:-2}" -I{} bash -c 'one {}'
one dock  # opens windows of its own: run it alone
echo DONE >> regress.log
