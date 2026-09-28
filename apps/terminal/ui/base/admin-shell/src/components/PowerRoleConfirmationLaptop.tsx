import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import {adminTestIds} from '../foundations/adminTestIds';
import {usePowerRoleConfirmation} from '../hooks/usePowerRoleConfirmation';

const layerFrameStyle = Object.freeze({flex: 1, minHeight: 0, padding: 24});
const confirmationCardStyle = Object.freeze({width: '100%'});

/** Laptop confirmation presentation; command lifecycle is owned by usePowerRoleConfirmation. */
export const PowerRoleConfirmationLaptop = () => {
  const confirmation = usePowerRoleConfirmation();
  return (
    <PrimitiveCenter testID={adminTestIds.topology.powerConfirmation.root} style={layerFrameStyle}>
      {confirmation.pending === undefined || confirmation.pending === null ? null : (
        <PrimitiveContainer
          testID={adminTestIds.topology.powerConfirmation.card}
          layout="card"
          bounded
          style={confirmationCardStyle}
        >
          <PrimitiveHeading testID={adminTestIds.topology.powerConfirmation.title}>确认显示角色切换</PrimitiveHeading>
          <PrimitiveText testID={adminTestIds.topology.powerConfirmation.message}>
            电源状态变化将把当前显示角色切换为 {confirmation.pending.targetRole}，是否继续？
          </PrimitiveText>
          <PrimitiveActions testID={adminTestIds.topology.powerConfirmation.actions}>
            <PrimitiveButton
              testID={adminTestIds.topology.powerConfirmation.confirm}
              accessibilityLabel="确认显示角色切换"
              tone="info"
              onPress={confirmation.confirm}
            >
              确认
            </PrimitiveButton>
            <PrimitiveButton
              testID={adminTestIds.topology.powerConfirmation.cancel}
              accessibilityLabel="取消显示角色切换"
              onPress={confirmation.cancel}
            >
              取消
            </PrimitiveButton>
          </PrimitiveActions>
        </PrimitiveContainer>
      )}
    </PrimitiveCenter>
  );
};
