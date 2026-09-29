export const memberJourneyCustomerSurfaceReady = xml => {
  const text = String(xml ?? '')
  return text.includes('resource-id="sample.desk.customer-welcome"') &&
    !text.includes('resource-id="ui-base-render:layer:admin.console.layer"')
}

export const prepareMemberJourneySurface = async ({master, slave, closeAdmin, assertCustomerSurface}) => {
  await closeAdmin(master)
  await closeAdmin(slave)
  await assertCustomerSurface(slave)
}
