#!/bin/bash
set -e
set -x
URL=${1:-http://localhost:5000}
COOKIE=${2:-'session="69b2a09c-62a7-4469-9bc5-89e6ce1cd18d!ltdjyZ3W6313kito8ytCWScuZh0="'}

TIME_FORMAT='\nreal-%esec\n'
COMMAND="time -f ${TIME_FORMAT} curl -i --cookie ${COOKIE}"

${COMMAND} -I -v --header "Range:bytes=48-" ${URL}/api/v1.0/template/test/storage/current/file/output/768x576.mp4
#exit

${COMMAND} $URL/api/v1.0/runners

${COMMAND} $URL/api/v1.0/templates
${COMMAND} $URL/api/v1.0/template/test
${COMMAND} --request POST $URL/api/v1.0/template/test/fork

#public workspaces
#${COMMAND} $URL/api/v1.0/workspaces

${COMMAND} $URL/api/v1.0/workspace/test
${COMMAND} $URL/api/v1.0/workspace/test/storage/current
${COMMAND} $URL/api/v1.0/workspace/test/storage/0
${COMMAND} --request POST $URL/api/v1.0/workspace/test/fork
# DONE 
${COMMAND} \
  --request PUT \
  --form description="it is smoke test workspace" \
  --form name="smoke test" \
  $URL/api/v1.0/workspace/test
${COMMAND} \
  --request PUT \
  --form code=@../../data/workspaces/test/commit_0/src/main.cpp \
  $URL/api/v1.0/workspace/test/storage/current
# DONE
${COMMAND} --request POST $URL/api/v1.0/workspace/test/commit

# upload input file
${COMMAND} --request POST $URL/api/v1.0/workspace/test/storage/current/upload

${COMMAND} --request POST $URL/api/v1.0/workspace/test/storage/current/run
#${COMMAND} $URL/api/v1.0/workspace/test/storage/current/status
