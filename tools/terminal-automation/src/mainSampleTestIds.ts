import {sampleMemberDeskTestId} from '@catering-v2s/ui-feature-sample-member-desk/test-ids';
import {sampleStaffAuthTestIds} from '@catering-v2s/ui-feature-sample-staff-auth/test-ids';
import {
  wallpaperPickerTestIds,
  wallpaperOptionTestId,
  wallpaperContentTestIds,
} from '@catering-v2s/ui-feature-sample-wallpaper-picker/test-ids';

/** Re-exports owner-authored IDs for the two sample journeys without duplicating their values. */
export const mainSampleTestIds = Object.freeze({
  staffOperatorName: sampleStaffAuthTestIds.operatorName,
  staffPasscode: sampleStaffAuthTestIds.passcode,
  staffLoginSubmit: sampleStaffAuthTestIds.loginSubmit,
  memberFormName: sampleMemberDeskTestId('sample.desk.member-form:name'),
  memberFormPhone: sampleMemberDeskTestId('sample.desk.member-form:phone'),
  memberFormSubmit: sampleMemberDeskTestId('sample.desk.member-form:submit'),
  memberListEmptyAction: sampleMemberDeskTestId('sample.desk.member-list:empty-action'),
  memberReject: sampleMemberDeskTestId('sample.desk.customer-member:reject'),
  memberRetry: sampleMemberDeskTestId('sample.desk.registry-notice:retry'),
  memberAbandon: sampleMemberDeskTestId('sample.desk.registry-notice:abandon'),
  memberWithdraw: sampleMemberDeskTestId('sample.desk.waiting-confirm:withdraw'),
  memberWithdrawConfirm: sampleMemberDeskTestId('sample.desk.withdraw-confirm:withdraw'),
  memberAge: sampleMemberDeskTestId('sample.desk.customer-member:age'),
  memberConfirm: sampleMemberDeskTestId('sample.desk.customer-member:confirm'),
  wallpaperOptionW2: wallpaperOptionTestId('w2'),
  wallpaperConfirm: wallpaperPickerTestIds.confirm,
  wallpaperAssetLoadStatus: wallpaperContentTestIds.updateAssetLoadStatus,
});
