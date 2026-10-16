#!/bin/sh
# Fail if any site script does not parse as an ES module. Runs before every deploy.
status=0
for f in $(find site/assets/js -name '*.js'); do
  if ! node --input-type=module --check < "$f"; then
    echo "Syntax error in $f"
    status=1
  fi
done
[ $status -eq 0 ] && echo "All site scripts parse."
exit $status
