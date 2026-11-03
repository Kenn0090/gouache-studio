#!/bin/bash
# renders each saved scene body in the new viewer (software GPU) at the same size and compares it with the old 3D view's picture
cd /home/user/gouache-studio/src-tauri/render
for n in "$@"; do
  GOUACHE_CAPTURE=/home/user/gouache-studio/tests/e2e/out/parity/${n}_new.png CAP_W=1100 CAP_H=760 xvfb-run -a -s "-screen 0 1280x900x24" ./target/debug/examples/from_file /home/user/gouache-studio/tests/e2e/out/parity/$n.bin 2>&1 | grep -E "CAPTURE|ERROR"
done
