export function idleMinutesToSeconds(minutes: number): number {
  return Math.round(minutes * 60);
}

export function idleSecondsToMinutes(seconds: number): number {
  return seconds / 60;
}
