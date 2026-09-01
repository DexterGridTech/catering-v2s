import type {
  ActorExecutionRecord,
  CommandAggregateStatus,
  CommandExecutionObservation,
} from '../types/execution'

const isFailure = (record: ActorExecutionRecord): boolean =>
  record.status === 'error' || record.status === 'timed-out'

export const aggregateCommandStatus = (
  observation: Pick<CommandExecutionObservation, 'actorResults' | 'allowNoActor' | 'completedAt'>,
): CommandAggregateStatus => {
  if (
    observation.completedAt === null
    || observation.actorResults.some(record => record.status === 'running')
  ) {
    return 'running'
  }

  if (observation.actorResults.length === 0) {
    return observation.allowNoActor ? 'completed' : 'error'
  }

  const failures = observation.actorResults.filter(isFailure)
  if (failures.length === 0) return 'completed'
  if (failures.length === observation.actorResults.length) {
    return failures.every(record => record.status === 'timed-out')
      ? 'timed-out'
      : 'error'
  }
  return 'partial-failed'
}
