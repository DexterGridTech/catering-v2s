#!/usr/bin/env bash
set -uo pipefail

run_root="${1:-}"
results="${2:-}"
if [[ ! "$run_root" =~ ^/tmp/r5-tc-[0-9]+-[0-9]+$ ]] || [[ "$results" != "$run_root/results" ]] || [[ ! -d "$results" ]]; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_ARGUMENT_INVALID' >&2
  exit 2
fi

run_id="${run_root##*/}"
trace_file="$results/process-signal-trace.log"
status_file="$results/process-signal-trace.status"
ready_file="$results/process-signal-trace.ready"
reader_error_file="$results/process-signal-trace-reader.stderr"
tracefs_root=''
trace_instance=''
reader_pid=''
event_enabled=false
capture_status=PENDING
cleanup_status=PASS
self_test_target_pid=NONE
self_test_target_comm=NONE
self_test_sender_pid="$$"

write_status() {
  printf 'runId=%s status=%s cleanup=%s tool=linux-tracefs-signal-generate kernel=%s selfTestTargetPid=%s selfTestTargetComm=%s selfTestSenderPid=%s readerPid=%s\n' \
    "$run_id" "$capture_status" "$cleanup_status" "$(uname -r 2>/dev/null || printf unavailable)" \
    "$self_test_target_pid" "$self_test_target_comm" "$self_test_sender_pid" "${reader_pid:-NONE}" > "$status_file"
}

cleanup() {
  local original_status=$?
  trap - EXIT INT TERM HUP
  if [[ "$capture_status" == PENDING ]]; then capture_status=UNAVAILABLE; fi
  if [[ -n "$trace_instance" && -d "$trace_instance" ]]; then
    if [[ "$event_enabled" == true ]]; then
      printf '0\n' > "$trace_instance/events/signal/signal_generate/enable" || cleanup_status=FAIL
      event_enabled=false
    fi
    if [[ -w "$trace_instance/tracing_on" ]]; then
      printf '0\n' > "$trace_instance/tracing_on" || cleanup_status=FAIL
    fi
    if [[ -n "$reader_pid" ]] && kill -0 "$reader_pid" 2>/dev/null; then
      kill -TERM "$reader_pid" 2>/dev/null || cleanup_status=FAIL
      wait "$reader_pid" 2>/dev/null || true
    elif [[ -n "$reader_pid" ]]; then
      wait "$reader_pid" 2>/dev/null || true
    fi
    rmdir -- "$trace_instance" 2>/dev/null || cleanup_status=FAIL
  fi
  if [[ -f "$trace_file" ]]; then
    if [[ -s "$reader_error_file" ]]; then
      printf 'readerDiagnosticBegin\n' >> "$trace_file"
      cat -- "$reader_error_file" >> "$trace_file"
      printf 'readerDiagnosticEnd\n' >> "$trace_file"
    fi
    printf 'captureFinishedUtc=%s status=%s cleanup=%s\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || printf unavailable)" \
      "$capture_status" "$cleanup_status" >> "$trace_file"
  fi
  write_status
  rm -f -- "$ready_file"
  return "$original_status"
}

trap cleanup EXIT
trap 'exit 0' TERM INT HUP

  printf 'runId=%s captureStartedUtc=%s status=STARTING scope=remote-host tracepoint=signal:signal_generate filter="sig == 15" eventPrefix=sender-comm-pid eventFields=target-comm-pid\n' \
  "$run_id" "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || printf unavailable)" > "$trace_file"
write_status

for candidate in /sys/kernel/tracing /sys/kernel/debug/tracing; do
  if [[ -d "$candidate/events/signal/signal_generate" && -d "$candidate/instances" ]]; then
    tracefs_root="$candidate"
    break
  fi
done
if [[ -z "$tracefs_root" || ! -w "$tracefs_root/instances" ]]; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_TRACEFS_UNAVAILABLE' >&2
  exit 1
fi

trace_instance="$tracefs_root/instances/codex-$run_id"
if ! mkdir -- "$trace_instance"; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_INSTANCE_CREATE_FAILED' >&2
  exit 1
fi
if [[ -f "$trace_instance/trace_options" ]]; then
  if grep -qx 'norecord-cmd' "$trace_instance/trace_options"; then
    if ! printf 'record-cmd\n' > "$trace_instance/trace_options"; then
      printf '%s\n' 'REMOTE_SIGNAL_TRACE_COMMAND_RECORDING_ENABLE_FAILED' >&2
      exit 1
    fi
  fi
  if ! grep -qx 'record-cmd' "$trace_instance/trace_options"; then
    printf '%s\n' 'REMOTE_SIGNAL_TRACE_COMMAND_RECORDING_UNAVAILABLE' >&2
    exit 1
  fi
else
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_OPTIONS_UNAVAILABLE' >&2
  exit 1
fi
if ! printf 'sig == 15\n' > "$trace_instance/events/signal/signal_generate/filter"; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_FILTER_INSTALL_FAILED' >&2
  exit 1
fi
if ! printf '1\n' > "$trace_instance/events/signal/signal_generate/enable"; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_EVENT_ENABLE_FAILED' >&2
  exit 1
fi
event_enabled=true
if ! printf '1\n' > "$trace_instance/tracing_on"; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_INSTANCE_START_FAILED' >&2
  exit 1
fi

(
  trap ':' EXIT
  trap - INT TERM HUP
  exec 3< "$trace_instance/trace_pipe" || exit 1
  : > "$ready_file"
  trace_comm_pattern='^[[:alnum:]_.+ -]{1,16}$'
  while IFS= read -r trace_line <&3; do
    printf '%s\n' "$trace_line" >> "$trace_file" || exit 1
    read -r trace_task_header _ <<< "$trace_line"
    trace_sender_pid="${trace_task_header##*-}"
    trace_sender_comm="${trace_task_header%-*}"
    trace_sender_source=trace_event
    if [[ "$trace_sender_comm" == '<...>' ]]; then
      if [[ "$trace_sender_pid" =~ ^[0-9]+$ ]] && IFS= read -r trace_sender_comm < "/proc/$trace_sender_pid/comm"; then
        trace_sender_source=proc_at_read
      else
        trace_sender_comm=unavailable
        trace_sender_source=unavailable
      fi
    fi
    trace_sender_parent_pid=unavailable
    trace_sender_parent_comm=unavailable
    if [[ "$trace_sender_pid" =~ ^[0-9]+$ && -r "/proc/$trace_sender_pid/status" ]]; then
      while IFS=$' \t' read -r status_key status_value _; do
        if [[ "$status_key" == PPid: && "$status_value" =~ ^[0-9]+$ ]]; then
          trace_sender_parent_pid="$status_value"
          break
        fi
      done < "/proc/$trace_sender_pid/status"
      if [[ "$trace_sender_parent_pid" =~ ^[0-9]+$ ]]; then
        if ! IFS= read -r trace_sender_parent_comm < "/proc/$trace_sender_parent_pid/comm"; then
          trace_sender_parent_comm=unavailable
        fi
      fi
    fi
    if [[ ! "$trace_sender_comm" =~ $trace_comm_pattern ]]; then
      trace_sender_comm=unavailable
      trace_sender_source=unavailable
    fi
    if [[ ! "$trace_sender_parent_comm" =~ $trace_comm_pattern ]]; then
      trace_sender_parent_comm=unavailable
    fi
    printf 'senderIdentity pid=%s comm=%s source=%s ppid=%s parentComm=%s\n' \
      "$trace_sender_pid" "$trace_sender_comm" "$trace_sender_source" \
      "$trace_sender_parent_pid" "$trace_sender_parent_comm" >> "$trace_file" || exit 1
    trace_ancestor_pid="$trace_sender_pid"
    if [[ ! "$trace_ancestor_pid" =~ ^[0-9]+$ || ! -r "/proc/$trace_ancestor_pid/status" ]]; then
      trace_ancestor_pid="$trace_sender_parent_pid"
    fi
    for trace_ancestor_depth in 0 1 2 3 4 5 6 7; do
      if [[ ! "$trace_ancestor_pid" =~ ^[0-9]+$ || ! -r "/proc/$trace_ancestor_pid/status" ]]; then
        printf 'senderAncestor depth=%s pid=%s status=UNAVAILABLE\n' \
          "$trace_ancestor_depth" "${trace_ancestor_pid:-unavailable}" >> "$trace_file" || exit 1
        break
      fi
      trace_ancestor_ppid=unavailable
      while IFS=$' \t' read -r status_key status_value _; do
        if [[ "$status_key" == PPid: && "$status_value" =~ ^[0-9]+$ ]]; then
          trace_ancestor_ppid="$status_value"
          break
        fi
      done < "/proc/$trace_ancestor_pid/status"
      trace_ancestor_comm=unavailable
      IFS= read -r trace_ancestor_comm < "/proc/$trace_ancestor_pid/comm" || true
      trace_ancestor_exe=unavailable
      trace_ancestor_exe_path="$(readlink "/proc/$trace_ancestor_pid/exe" 2>/dev/null || true)"
      case "$trace_ancestor_exe_path" in
        /home/*) trace_ancestor_exe_path="HOME/${trace_ancestor_exe_path##*/}" ;;
        /root/*) trace_ancestor_exe_path="ROOT/${trace_ancestor_exe_path##*/}" ;;
      esac
      if [[ "$trace_ancestor_exe_path" =~ ^[[:alnum:]_./+@:-]{1,256}$ ]]; then
        trace_ancestor_exe="$trace_ancestor_exe_path"
      fi
      if [[ ! "$trace_ancestor_comm" =~ $trace_comm_pattern ]]; then
        trace_ancestor_comm=unavailable
      fi
      printf 'senderAncestor depth=%s pid=%s ppid=%s comm=%s exe=%s\n' \
        "$trace_ancestor_depth" "$trace_ancestor_pid" "$trace_ancestor_ppid" \
        "$trace_ancestor_comm" "$trace_ancestor_exe" >> "$trace_file" || exit 1
      if [[ ! "$trace_ancestor_ppid" =~ ^[0-9]+$ || "$trace_ancestor_ppid" == 0 || "$trace_ancestor_ppid" == "$trace_ancestor_pid" ]]; then
        break
      fi
      trace_ancestor_pid="$trace_ancestor_ppid"
    done
  done
) 2> "$reader_error_file" &
reader_pid=$!
reader_open=false
ready_deadline=$((SECONDS + 5))
while [[ "$reader_open" != true ]]; do
  if ! kill -0 "$reader_pid" 2>/dev/null || (( SECONDS >= ready_deadline )); then
    printf '%s\n' 'REMOTE_SIGNAL_TRACE_READER_START_FAILED' >&2
    exit 1
  fi
  for reader_fd in /proc/"$reader_pid"/fd/*; do
    reader_target="$(readlink "$reader_fd" 2>/dev/null || true)"
    if [[ "$reader_target" == "$trace_instance/trace_pipe" ]]; then
      reader_open=true
      break
    fi
  done
  [[ "$reader_open" == true ]] || sleep 0.05
done

sleep 15 &
self_test_target_pid=$!
self_test_exec_deadline=$((SECONDS + 3))
while [[ "$self_test_target_comm" != sleep ]]; do
  if ! IFS= read -r self_test_target_comm < "/proc/$self_test_target_pid/comm"; then
    self_test_target_comm=unavailable
  fi
  if [[ "$self_test_target_comm" == sleep ]]; then break; fi
  if ! kill -0 "$self_test_target_pid" 2>/dev/null || (( SECONDS >= self_test_exec_deadline )); then
    printf '%s\n' 'REMOTE_SIGNAL_TRACE_SELF_TEST_TARGET_NOT_READY' >&2
    exit 1
  fi
  sleep 0.05
done
if ! kill -TERM "$self_test_target_pid" 2>/dev/null; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_SELF_TEST_SIGNAL_FAILED' >&2
  exit 1
fi
wait "$self_test_target_pid" 2>/dev/null
self_test_exit=$?
if [[ "$self_test_exit" != 143 ]]; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_SELF_TEST_EXIT_INVALID' >&2
  exit 1
fi
self_test_deadline=$((SECONDS + 3))
while ! grep -Eq "signal_generate: sig=15 .* pid=${self_test_target_pid} " "$trace_file"; do
  if (( SECONDS >= self_test_deadline )); then
    printf '%s\n' 'REMOTE_SIGNAL_TRACE_SELF_TEST_EVENT_MISSING' >&2
    exit 1
  fi
  sleep 0.05
done
if ! grep -Eq "senderIdentity pid=${self_test_sender_pid} comm=[[:alnum:]_.+-]+ source=(trace_event|proc_at_read)" "$trace_file"; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_SELF_TEST_SENDER_COMM_MISSING' >&2
  exit 1
fi
if ! grep -Eq "senderIdentity pid=${self_test_sender_pid} comm=[[:alnum:]_.+-]+ source=(trace_event|proc_at_read) ppid=[0-9]+ parentComm=[[:alnum:]_.+-]+" "$trace_file"; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_SELF_TEST_PARENT_IDENTITY_MISSING' >&2
  exit 1
fi
if ! grep -Eq "senderAncestor depth=0 pid=${self_test_sender_pid} ppid=[0-9]+ comm=[[:alnum:]_.+ -]+ exe=[[:alnum:]_./+@:-]+" "$trace_file"; then
  printf '%s\n' 'REMOTE_SIGNAL_TRACE_SELF_TEST_ANCESTRY_MISSING' >&2
  exit 1
fi

capture_status=CAPTURED
printf 'listenerReadyUtc=%s status=READY tracefsInstance=%s readerPid=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || printf unavailable)" \
  "${trace_instance##*/}" "$reader_pid" >> "$trace_file"
write_status
printf '%s\n' 'READY' > "$ready_file"
rm -f -- "$reader_error_file"
wait "$reader_pid"
