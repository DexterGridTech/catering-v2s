export const memberFinancialProbeId = 'sample.desk.member-form:keyboard-financial-probe'
export const virtualKeyboardCompleteId = 'ui.base.input:virtual-keyboard:complete'
export const memberSubmitId = 'sample.desk.member-form:submit'

export const submitMemberFormWithClosedKeyboard = async ({tap, waitForKeyboardClosed}) => {
  await tap(memberFinancialProbeId)
  await tap(virtualKeyboardCompleteId)
  await waitForKeyboardClosed()
  await tap(memberSubmitId)
}
