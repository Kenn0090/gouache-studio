#!/bin/bash
# Runs every end-to-end test against dist-web/ (run `npm run build` in the repo root first).
# Results go to regress.log; a test prints "ALL PASSED" (or "no errors" for t4/t5/t7) when it passes.
# JOBS=n runs n tests at once (default 2; the heavy bake tests are started first).
cd "$(dirname "$0")"; : > regress.log
one(){ echo "== $1: $(timeout 1200 node $1.cjs 2>&1 | grep -E 'FAIL|ALL PASSED|ERR|no errors' | tail -3 | tr '\n' ' ')" >> regress.log; }
export -f one
printf '%s\n' id28 fix2802 cfx29 fold30 perf30 mask30 p3perf30 link31 mode31 tip32 id32 dec32 dec32b view32 nav33 vp35 shelf36 obj36 fix371 fix372 fix40 post401 anim41 tex38 fix381 lv39 slope39 altpick36 env36 rep34 recol29 mat29 menu29 cover281 ui28 tess28 emb28 comp28 tex28 lib28 dec28 tabs262 fix27 mimport filters27 export27 libdrag cvmat astabs mwatch esend stretch27 ui261 bakeperf bakecurv canvas19 ui20 p3d p3d2 bakep3 idbake mats mstack livemask matconv projxf smart sm34 anchor heal p3bake ui25 welcome25 shape25 looks26 bigobj bake baketab bake2 bake3 hp2 cage v3 convtab conv2 quickwins brushtab specgloss dock gallery filters17 fxl conv fx perf maps maps2 maps3 gfile tex xf sel sel2 prefs fill anim t4 t5 t7 \
  | grep -vx dock | xargs -P "${JOBS:-2}" -I{} bash -c 'one {}'
one dock  # opens windows of its own: run it alone
echo DONE >> regress.log
